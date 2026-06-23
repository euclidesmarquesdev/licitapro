import { useState, useEffect } from "react";
import { Licitacao, CompanySetting, SmartNotification } from "../types";
import { MOCK_LICITACOES, MOCK_COMPANY_DETAILS } from "../data";
import { auth, db } from "../firebase";
import { 
  collection, doc, setDoc, deleteDoc, onSnapshot, query, where,
  writeBatch
} from "firebase/firestore";
import { 
  getLocalLicitacoes, 
  saveLocalLicitacao, 
  deleteLocalLicitacao, 
  getLocalCompanySettings, 
  saveLocalCompanySettings, 
  bulkSaveLocalLicitacoes,
  clearLocalLicitacoes
} from "../utils/indexedDb";
import { showToast } from "../utils/toast";

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

// Função para migrar dados do IndexedDB para o Firestore
async function migrateLocalDataToFirestore(userId: string): Promise<{ migrated: number; message: string }> {
  try {
    const localItems = await getLocalLicitacoes("guest-user");
    
    if (localItems.length === 0) {
      return { migrated: 0, message: "Nenhum dado local para migrar." };
    }

    console.log(`[Migração] Encontrados ${localItems.length} itens locais para migrar.`);

    const batch = writeBatch(db);
    let migratedCount = 0;

    for (const item of localItems) {
      const itemWithUserId = {
        ...item,
        userId: userId,
        migratedFromLocal: true,
        migratedAt: new Date().toISOString(),
        originalId: item.id
      };
      
      const docRef = doc(db, "licitacoes", item.id);
      batch.set(docRef, itemWithUserId);
      migratedCount++;
    }

    await batch.commit();
    console.log(`[Migração] ${migratedCount} itens migrados com sucesso.`);

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

// ✅ EXPORTAÇÃO CORRETA DA FUNÇÃO useLicitacoes
export function useLicitacoes(user: any | null, authLoading: boolean, isGuestMode: boolean) {
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedLicitacaoId, setSelectedLicitacaoId] = useState<string | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySetting>(MOCK_COMPANY_DETAILS);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  const showToastMessage = (message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  // Load company settings
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
        console.error("Erro ao carregar configurações:", err);
      }
    }
    loadSettings();
  }, []);

  // Sync data
  useEffect(() => {
    if (authLoading) return;

    // Modo convidado
    if (isGuestMode || (user && user.isVirtual)) {
      setLoadingList(true);
      const userId = user ? user.uid : "guest-user";
      
      async function syncLocalDb() {
        try {
          const items = await getLocalLicitacoes(userId);
          if (items && items.length > 0) {
            setLicitacoes(items);
          } else {
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
          console.error("Erro sincronizando IndexedDB:", err);
          setLicitacoes(MOCK_LICITACOES);
        } finally {
          setLoadingList(false);
        }
      }
      
      syncLocalDb();
      return;
    }

    // Modo autenticado
    if (!user) {
      setLicitacoes([]);
      return;
    }

    setLoadingList(true);

    // Verifica migração
    async function checkAndMigrate() {
      try {
        const localItems = await getLocalLicitacoes("guest-user");
        if (localItems.length > 0) {
          setIsMigrating(true);
          showToastMessage("🔃 Detectamos dados do modo convidado. Migrando para sua conta...", "info");
          
          const result = await migrateLocalDataToFirestore(user.uid);
          
          if (result.migrated > 0) {
            showToastMessage(result.message, "success");
            setLicitacoes([]);
          } else {
            showToastMessage(result.message, "info");
          }
          
          setIsMigrating(false);
        }
      } catch (error) {
        console.error("[Migração] Erro:", error);
        setIsMigrating(false);
        showToastMessage("Erro ao verificar dados locais para migração.", "error");
      }
    }

    if (user && !isGuestMode && !user.isVirtual) {
      checkAndMigrate();
    }

    // Firestore real-time sync
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
        showToastMessage(
          "Não conseguimos obter permissões de sincronização na nuvem. Verifique sua conexão.",
          "error"
        );
      }
      setLoadingList(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, isGuestMode]);

  // Atualiza licitação
  const handleUpdateLicitacao = async (updated: Licitacao) => {
    setLicitacoes(prev => {
      const newList = prev.map(item => item.id === updated.id ? updated : item);
      
      if (isGuestMode || (user && user.isVirtual)) {
        saveLocalLicitacao(updated);
      }
      
      return newList;
    });

    if (user && !isGuestMode && !user.isVirtual) {
      try {
        const docRef = doc(db, "licitacoes", updated.id);
        await setDoc(docRef, {
          ...updated,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("[Firestore] Erro ao atualizar:", err);
        showToastMessage("Erro ao salvar na nuvem. As alterações estão salvas localmente.", "error");
        await saveLocalLicitacao(updated);
      }
    }
  };

  // Cria nova licitação
  const handleSaveNewLicitacao = async (newItem: Licitacao) => {
    const updatedList = [newItem, ...licitacoes];
    setLicitacoes(updatedList);

    if (isGuestMode || (user && user.isVirtual)) {
      await saveLocalLicitacao(newItem);
      const storageKey = user ? `LICI_TRACK_V1_data_${user.uid}` : "LICI_TRACK_V1_guest_data";
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
    } else if (user) {
      try {
        await setDoc(doc(db, "licitacoes", newItem.id), newItem);
      } catch (err) {
        console.error("[Firestore] Erro ao criar:", err);
        showToastMessage("Erro ao salvar na nuvem. A licitação foi salva localmente.", "error");
        await saveLocalLicitacao(newItem);
      }
    }
  };

  // Exclui licitação
  const handleDeleteLicitacao = async (id: string) => {
    const updatedList = licitacoes.filter(item => item.id !== id);
    setLicitacoes(updatedList);

    if (isGuestMode || (user && user.isVirtual)) {
      await deleteLocalLicitacao(id);
      const storageKey = user ? `LICI_TRACK_V1_data_${user.uid}` : "LICI_TRACK_V1_guest_data";
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
      if (selectedLicitacaoId === id) setSelectedLicitacaoId(null);
    } else if (user) {
      try {
        await deleteDoc(doc(db, "licitacoes", id));
        if (selectedLicitacaoId === id) setSelectedLicitacaoId(null);
      } catch (err) {
        console.error("[Firestore] Erro ao excluir:", err);
        showToastMessage("Erro ao excluir da nuvem. A exclusão foi feita localmente.", "error");
        await deleteLocalLicitacao(id);
        if (selectedLicitacaoId === id) setSelectedLicitacaoId(null);
      }
    }
  };

  // Alertas
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
      showToast.success(
        "Alerta disparado!",
        `${alertDetails.type === "whatsapp" ? "WhatsApp" : "E-mail"}: ${alertDetails.title}`
      );
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

  // Configurações
  const handleUpdateCompanySettings = async (settings: CompanySetting) => {
    setCompanySettings(settings);
    localStorage.setItem("LICI_TRACK_V1_company_settings", JSON.stringify(settings));
    await saveLocalCompanySettings(settings);
    showToast.success("Configurações salvas!", "Dados da empresa atualizados.");
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
      showToast.success("Backup restaurado!", "Dados recuperados com sucesso.");
    } catch (err) {
      console.error("Erro ao restaurar backup:", err);
      showToast.error("Falha ao restaurar backup.", "Tente novamente.");
    }
  };

  // Forçar migração manual
  const forceMigrateLocalData = async (): Promise<{ migrated: number; message: string }> => {
    if (!user || isGuestMode || user.isVirtual) {
      return { migrated: 0, message: "Usuário não autenticado. Faça login para migrar dados." };
    }
    
    setIsMigrating(true);
    try {
      const result = await migrateLocalDataToFirestore(user.uid);
      if (result.migrated > 0) {
        setLicitacoes([]);
        showToast.success("Migração concluída!", result.message);
      } else {
        showToast.info("Sem dados para migrar.", result.message);
      }
      return result;
    } finally {
      setIsMigrating(false);
    }
  };

  return {
    licitacoes,
    setLicitacoes,
    loadingList,
    selectedLicitacaoId,
    setSelectedLicitacaoId,
    companySettings,
    toast,
    showToast: showToastMessage,
    isMigrating,
    handleUpdateLicitacao,
    handleSaveNewLicitacao,
    handleDeleteLicitacao,
    handleTriggerAlertNow,
    handleDeleteAlert,
    handleAddAlert,
    handleUpdateCompanySettings,
    handleRestoreComplete,
    forceMigrateLocalData
  };
}