import { useState, useEffect } from "react";
import { Licitacao, CompanySetting, SmartNotification } from "../types";
import { MOCK_LICITACOES, MOCK_COMPANY_DETAILS } from "../data";
import { auth, db } from "../firebase";
import { 
  collection, doc, setDoc, deleteDoc, onSnapshot, query, where 
} from "firebase/firestore";
import { 
  getLocalLicitacoes, saveLocalLicitacao, deleteLocalLicitacao, 
  getLocalCompanySettings, saveLocalCompanySettings, bulkSaveLocalLicitacoes 
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

export function useLicitacoes(user: any | null, authLoading: boolean, isGuestMode: boolean) {
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedLicitacaoId, setSelectedLicitacaoId] = useState<string | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySetting>(MOCK_COMPANY_DETAILS);
  const [toast, setToast] = useState<ToastState | null>(null);

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

  // Sync data with storage or Firestore
  useEffect(() => {
    if (authLoading) return;

    if (isGuestMode || (user && user.isVirtual)) {
      setLoadingList(true);
      const userId = user ? user.uid : "guest-user";
      
      async function syncLocalDb() {
        try {
          const items = await getLocalLicitacoes(userId);
          if (items && items.length > 0) {
            setLicitacoes(items);
          } else {
            // Retrocompatibility check
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

    if (!user) {
      setLicitacoes([]);
      return;
    }

    setLoadingList(true);
    
    // Real-time Firestore sync query for current user
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
          "Não conseguimos obter permissões totais de sincronização na nuvem para buscar as licitações. Contate o administrador do banco de dados.",
          "error"
        );
      }
      setLoadingList(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, isGuestMode]);

  // Handler for updates (both local and Firestore)
  const handleUpdateLicitacao = async (updated: Licitacao) => {
    // 1. Update state first for instant UX feel
    setLicitacoes(prev => {
      const newList = prev.map(item => item.id === updated.id ? updated : item);
      if (isGuestMode || (user && user.isVirtual)) {
        const storageKey = user ? `LICI_TRACK_V1_data_${user.uid}` : "LICI_TRACK_V1_guest_data";
        localStorage.setItem(storageKey, JSON.stringify(newList));
        
        // Save to IndexedDB
        saveLocalLicitacao(updated);
      }
      return newList;
    });

    if (isGuestMode || (user && user.isVirtual)) {
      return;
    }

    if (!user) return;

    // 2. Persist to Firestore
    try {
      try {
        const docRef = doc(db, "licitacoes", updated.id);
        await setDoc(docRef, {
          ...updated,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `licitacoes/${updated.id}`);
      }
    } catch (thrownError) {
      showToast(
        "Erro de Regras/Security no Firestore ao atualizar o edital. As alterações continuam salvas no seu navegador local.",
        "error"
      );
    }
  };

  // Create/Add a newly registered bidding
  const handleSaveNewLicitacao = async (newItem: Licitacao) => {
    const updatedList = [newItem, ...licitacoes];
    setLicitacoes(updatedList);

    if (isGuestMode || (user && user.isVirtual)) {
      const storageKey = user ? `LICI_TRACK_V1_data_${user.uid}` : "LICI_TRACK_V1_guest_data";
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
      
      // Save item to IndexedDB
      saveLocalLicitacao(newItem);
    } else if (user) {
      try {
        try {
          await setDoc(doc(db, "licitacoes", newItem.id), newItem);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `licitacoes/${newItem.id}`);
        }
      } catch (thrownError) {
        showToast(
          "Falha de permissão no Firestore para salvar esta nova licitação na nuvem. Ela ficará apenas na sessão temporária.",
          "error"
        );
      }
    }
  };

  const handleDeleteLicitacao = async (id: string) => {
    const updatedList = licitacoes.filter(item => item.id !== id);
    setLicitacoes(updatedList);

    if (isGuestMode || (user && user.isVirtual)) {
      const storageKey = user ? `LICI_TRACK_V1_data_${user.uid}` : "LICI_TRACK_V1_guest_data";
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
      
      // Delete item from IndexedDB
      await deleteLocalLicitacao(id);
      if (selectedLicitacaoId === id) setSelectedLicitacaoId(null);
    } else {
      try {
        try {
          await deleteDoc(doc(db, "licitacoes", id));
          if (selectedLicitacaoId === id) setSelectedLicitacaoId(null);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `licitacoes/${id}`);
        }
      } catch (thrownError) {
        showToast(
          "Seu perfil não possui permissão para apagar esse registro no Firestore. A exclusão afetará somente a tela do usuário atual.",
          "error"
        );
      }
    }
  };

  // Trigger simulated alerts instant Delivery
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

  return {
    licitacoes,
    setLicitacoes,
    loadingList,
    selectedLicitacaoId,
    setSelectedLicitacaoId,
    companySettings,
    toast,
    showToast,
    handleUpdateLicitacao,
    handleSaveNewLicitacao,
    handleDeleteLicitacao,
    handleTriggerAlertNow,
    handleDeleteAlert,
    handleAddAlert,
    handleUpdateCompanySettings,
    handleRestoreComplete
  };
}
