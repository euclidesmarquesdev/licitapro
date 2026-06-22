import { useState, useEffect } from "react";
import { Licitacao, CompanySetting, SmartNotification } from "../types";
import { MOCK_LICITACOES, MOCK_COMPANY_DETAILS } from "../data";
import { auth, db } from "../firebase";
import { 
  collection, doc, setDoc, deleteDoc, onSnapshot, query, where,
  writeBatch
} from "firebase/firestore";
import { 
  getLocalLicitacoes, saveLocalLicitacao, deleteLocalLicitacao, 
  getLocalCompanySettings, saveLocalCompanySettings, bulkSaveLocalLicitacoes,
  clearLocalLicitacoes
} from "../utils/indexedDb";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

// ============================================================
// ✅ NOVA FUNÇÃO: Migração de dados do IndexedDB para o Firestore
// ============================================================
async function migrateLocalDataToFirestore(userId: string): Promise<{ migrated: number; message: string }> {
  try {
    // Busca TODOS os dados locais (independente do userId)
    const localItems = await getLocalLicitacoes("guest-user");
    
    if (localItems.length === 0) {
      return { migrated: 0, message: "Nenhum dado local para migrar." };
    }

    console.log(`[Migração] Encontrados ${localItems.length} itens locais para migrar.`);

    // Migra para o Firestore em lote (atômico)
    const batch = writeBatch(db);
    let migratedCount = 0;

    for (const item of localItems) {
      // Garante que o item tenha o userId correto
      const itemWithUserId = {
        ...item,
        userId: userId,
        migratedFromLocal: true,
        migratedAt: new Date().toISOString(),
        originalId: item.id // Mantém referência ao ID original
      };
      
      const docRef = doc(db, "licitacoes", item.id);
      batch.set(docRef, itemWithUserId);
      migratedCount++;
    }

    await batch.commit();
    console.log(`[Migração] ${migratedCount} itens migrados com sucesso para o Firestore.`);

    // ✅ Limpa o IndexedDB APÓS migração bem-sucedida
    await clearLocalLicitacoes();
    localStorage.removeItem("LICI_TRACK_V1_guest_data");
    
    return { 
      migrated: migratedCount, 
      message: `${migratedCount} licitação(ões) migrada(s) do modo convidado para sua conta.` 
    };
  } catch (error) {
    console.error("[Migração] Erro ao migrar dados:", error);
    return { 
      migrated: 0, 
      message: "Erro ao migrar dados. Seus dados locais permanecem salvos. Tente novamente." 
    };
  }
}

export function useLicitacoes(user: any | null, authLoading: boolean, isGuestMode: boolean) {
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedLicitacaoId, setSelectedLicitacaoId] = useState<string | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySetting>(MOCK_COMPANY_DETAILS);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  // Trigger temporary toasts
  const showToast = (message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  // Load company settings from IndexedDB (with localStorage fallback)
  useEffect(() => {
    async function loadSettings() {
      try {
        const savedDb = await getLocalCompanySettings();
        if (savedDb) {
          setCompanySettings(savedDb);
        } else {
          const savedLocal = localStorage.getItem("LICI_TRACK_V1_company_settings");
          if (savedLocal) {
            const parsed = JSON.parse(savedLocal);
            setCompanySettings(parsed);
            await saveLocalCompanySettings(parsed);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar as configurações de empresa:", err);
      }
    }
    loadSettings();
  }, []);

  // ============================================================
  // ✅ CORRIGIDO: Sincronização com migração automática
  // ============================================================
  useEffect(() => {
    if (authLoading) return;

    // --- MODO CONVIDADO ---
    if (isGuestMode || (user && user.isVirtual)) {
      setLoadingList(true);
      const userId = user ? user.uid : "guest-user";
      
      async function syncLocalDb() {
        try {
          const items = await getLocalLicitacoes(userId);
          if (items && items.length > 0) {
            setLicitacoes(items);
          } else {
            // Retrocompatibilidade com localStorage antigo
            const storageKey = user ? `LICI_TRACK_V1_data_${user.uid}` : "LICI_TRACK_V1_guest_data";
            const saved = localStorage.getItem(storageKey);
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                setLicitacoes(parsed);
                await bulkSaveLocalLicitacoes(parsed);
              } catch (_) {
                setLicitacoes(MOCK_LICITACOES);
                const initializedMock = MOCK_LICITACOES.map(item => ({ ...item, userId }));
                await bulkSaveLocalLicitacoes(initializedMock);
              }
            } else {
              setLicitacoes(MOCK_LICITACOES);
              const initializedMock = MOCK_LICITACOES.map(item => ({ ...item, userId }));
              await bulkSaveLocalLicitacoes(initializedMock);
            }
          }
        } catch (err) {
          console.error("Erro sincronizando banco de dados local IndexedDB:", err);
          setLicitacoes(MOCK_LICITACOES);
        } finally {
          setLoadingList(false);
        }
      }
      
      syncLocalDb();
      return;
    }

    // --- MODO AUTENTICADO ---
    if (!user) {
      setLicitacoes([]);
      return;
    }

    setLoadingList(true);

    // ✅ VERIFICA E MIGRA DADOS LOCAIS (se houver)
    async function checkAndMigrate() {
      try {
        const localItems = await getLocalLicitacoes("guest-user");
        if (localItems.length > 0) {
          setIsMigrating(true);
          showToast("🔃 Detectamos dados do modo convidado. Migrando para sua conta...", "info");
          
          const result = await migrateLocalDataToFirestore(user.uid);
          
          // Se migrou com sucesso, recarrega os dados do Firestore
          if (result.migrated > 0) {
            showToast(result.message, "success");
            // Força recarga da lista
            setLicitacoes([]); // Limpa para forçar reload
          } else {
            showToast(result.message, "info");
          }
          
          setIsMigrating(false);
        }
      } catch (error) {
        console.error("[Migração] Erro ao verificar dados locais:", error);
        setIsMigrating(false);
        showToast("Erro ao verificar dados locais para migração.", "error");
      }
    }

    // Executa migração apenas se:
    // 1. Estiver autenticado (não convidado)
    // 2. Não estiver em modo convidado
    // 3. Não estiver em modo virtual
    if (user && !isGuestMode && !user.isVirtual) {
      checkAndMigrate();
    }

    // --- FIRESTORE REAL-TIME SYNC ---
    const q = query(
      collection(db, "licitacoes"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Licitacao[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Licitacao);
      });
      
      setLicitacoes(items);
      setLoadingList(false);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, "licitacoes");
      } catch (thrown) {
        showToast(
          "Não conseguimos obter permissões de sincronização na nuvem. Verifique sua conexão.",
          "error"
        );
      }
      setLoadingList(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, isGuestMode]);

  // ============================================================
  // ✅ CORRIGIDO: Atualiza licitação (com fallback local)
  // ============================================================
  const handleUpdateLicitacao = async (updated: Licitacao) => {
    // Atualiza estado local imediatamente
    setLicitacoes(prev => {
      const newList = prev.map(item => item.id === updated.id ? updated : item);
      
      // Se for modo convidado, salva no IndexedDB
      if (isGuestMode || (user && user.isVirtual)) {
        saveLocalLicitacao(updated);
      }
      
      return newList;
    });

    // Se for autenticado, salva no Firestore
    if (user && !isGuestMode && !user.isVirtual) {
      try {
        const docRef = doc(db, "licitacoes", updated.id);
        await setDoc(docRef, {
          ...updated,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("[Firestore] Erro ao atualizar:", err);
        showToast("Erro ao salvar na nuvem. As alterações estão salvas localmente.", "error");
        // Salva localmente como fallback
        await saveLocalLicitacao(updated);
      }
    }
  };

  // ============================================================
  // ✅ CORRIGIDO: Cria nova licitação
  // ============================================================
  const handleSaveNewLicitacao = async (newItem: Licitacao) => {
    const updatedList = [newItem, ...licitacoes];
    setLicitacoes(updatedList);

    if (isGuestMode || (user && user.isVirtual)) {
      // Modo convidado: salva no IndexedDB
      await saveLocalLicitacao(newItem);
      // Também mantém no localStorage para retrocompatibilidade
      const storageKey = user ? `LICI_TRACK_V1_data_${user.uid}` : "LICI_TRACK_V1_guest_data";
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
    } else if (user) {
      try {
        // Modo autenticado: salva no Firestore
        await setDoc(doc(db, "licitacoes", newItem.id), newItem);
      } catch (err) {
        console.error("[Firestore] Erro ao criar:", err);
        showToast("Erro ao salvar na nuvem. A licitação foi salva localmente.", "error");
        // Salva localmente como fallback
        await saveLocalLicitacao(newItem);
      }
    }
  };

  // ============================================================
  // ✅ CORRIGIDO: Exclui licitação
  // ============================================================
  const handleDeleteLicitacao = async (id: string) => {
    const updatedList = licitacoes.filter(item => item.id !== id);
    setLicitacoes(updatedList);

    if (isGuestMode || (user && user.isVirtual)) {
      // Modo convidado: remove do IndexedDB
      await deleteLocalLicitacao(id);
      // Remove do localStorage
      const storageKey = user ? `LICI_TRACK_V1_data_${user.uid}` : "LICI_TRACK_V1_guest_data";
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
      if (selectedLicitacaoId === id) setSelectedLicitacaoId(null);
    } else if (user) {
      try {
        // Modo autenticado: remove do Firestore
        await deleteDoc(doc(db, "licitacoes", id));
        if (selectedLicitacaoId === id) setSelectedLicitacaoId(null);
      } catch (err) {
        console.error("[Firestore] Erro ao excluir:", err);
        showToast("Erro ao excluir da nuvem. A exclusão foi feita localmente.", "error");
        // Remove localmente como fallback
        await deleteLocalLicitacao(id);
        if (selectedLicitacaoId === id) setSelectedLicitacaoId(null);
      }
    }
  };

  // ============================================================
  // ✅ FUNÇÕES DE ALERTAS (mantidas iguais)
  // ============================================================
  const handleTriggerAlertNow = (licId: string, alertId: string) => {
    const lic = licitacoes.find(l => l.id === licId);
    if (!lic) return;

    const updatedAlerts = lic.alerts.map(a => 
      a.id === alertId ? { ...a, testSent: true, sent: true } : a
    );

    const updatedLic = {
      ...lic,
      alerts: updatedAlerts
    };

    handleUpdateLicitacao(updatedLic);
    
    const alertDetails = lic.alerts.find(a => a.id === alertId);
    if (alertDetails) {
      alert(`[SIMULAÇÃO DISPARO] Lembrete entregue via ${alertDetails.type === "whatsapp" ? "WhatsApp" : "E-mail"}!\n\nDestino: ${user?.email || "usuario@teste.com"}\nTítulo: ${alertDetails.title}\nMensagem: ${alertDetails.content}`);
    }
  };

  const handleDeleteAlert = (licId: string, alertId: string) => {
    const lic = licitacoes.find(l => l.id === licId);
    if (!lic) return;

    handleUpdateLicitacao({
      ...lic,
      alerts: lic.alerts.filter(a => a.id !== alertId)
    });
  };

  const handleAddAlert = (licId: string, alert: SmartNotification) => {
    const lic = licitacoes.find(l => l.id === licId);
    if (!lic) return;

    handleUpdateLicitacao({
      ...lic,
      alerts: [alert, ...lic.alerts]
    });
  };

  // ============================================================
  // ✅ FUNÇÕES DE CONFIGURAÇÃO (mantidas iguais)
  // ============================================================
  const handleUpdateCompanySettings = async (settings: CompanySetting) => {
    setCompanySettings(settings);
    localStorage.setItem("LICI_TRACK_V1_company_settings", JSON.stringify(settings));
    await saveLocalCompanySettings(settings);
    showToast("Configurações organizacionais salvas com sucesso!", "success");
  };

  const handleRestoreComplete = async () => {
    try {
      const userId = user ? user.uid : "guest-user";
      const refetched = await getLocalLicitacoes(userId);
      setLicitacoes(refetched);
      
      const savedDb = await getLocalCompanySettings();
      if (savedDb) {
        setCompanySettings(savedDb);
      }
      showToast("Backup local restaurado e integrado perfeitamente!", "success");
    } catch (err) {
      console.error("Erro ao aplicar o backup restaurado:", err);
      showToast("Falha ao reincorporar o backup armazenado.", "error");
    }
  };

  // ============================================================
  // ✅ NOVA FUNÇÃO: Forçar migração manual
  // ============================================================
  const forceMigrateLocalData = async (): Promise<{ migrated: number; message: string }> => {
    if (!user || isGuestMode || user.isVirtual) {
      return { migrated: 0, message: "Usuário não autenticado. Faça login para migrar dados." };
    }
    
    setIsMigrating(true);
    try {
      const result = await migrateLocalDataToFirestore(user.uid);
      if (result.migrated > 0) {
        // Recarrega os dados
        setLicitacoes([]);
        showToast(result.message, "success");
      } else {
        showToast(result.message, "info");
      }
      return result;
    } finally {
      setIsMigrating(false);
    }
  };

  return {
    // Dados
    licitacoes,
    setLicitacoes,
    loadingList,
    selectedLicitacaoId,
    setSelectedLicitacaoId,
    companySettings,
    
    // Toast
    toast,
    showToast,
    
    // Status de migração
    isMigrating,
    
    // Handlers principais
    handleUpdateLicitacao,
    handleSaveNewLicitacao,
    handleDeleteLicitacao,
    
    // Alertas
    handleTriggerAlertNow,
    handleDeleteAlert,
    handleAddAlert,
    
    // Configurações
    handleUpdateCompanySettings,
    handleRestoreComplete,
    
    // ✅ NOVO: Migração manual
    forceMigrateLocalData,
  };
}