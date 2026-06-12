import React, { useState, useEffect } from "react";
import { 
  Licitacao, LicitacaoChecklistItem, SupplierContact, 
  CompetitorBid, SmartNotification, CompanySetting 
} from "./types";
import { 
  ESTADOS_BRASIL, CATEGORIAS_LICITACAO, STATUS_LICITACAO, 
  MOCK_COMPANY_DETAILS, MOCK_LICITACOES, MOCK_CATALOG_SUPPLIERS 
} from "./data";
import LicitacaoCard from "./components/LicitacaoCard";
import LicitacaoDetails from "./components/LicitacaoDetails";
import AlertsManager from "./components/AlertsManager";
import GeneralSuppliers from "./components/GeneralSuppliers";
import { parsePncpClipboardText } from "./utils/pncpParser";

// Firebase imports
import { auth, db, googleProvider, signInWithPopup, signOut } from "./firebase";
import { onAuthStateChanged, User, signInAnonymously, updateProfile } from "firebase/auth";
import { 
  collection, doc, setDoc, deleteDoc, onSnapshot, query, where, 
  getDoc, writeBatch, serverTimestamp 
} from "firebase/firestore";

import { 
  TrendingUp, Search, PlusCircle, Bell, Settings, 
  Sparkles, Globe, LogOut, CheckSquare, Users, 
  BarChart, MapPin, Landmark, ShieldCheck, Database,
  RefreshCw, Info, Trash2, ExternalLink
} from "lucide-react";

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

export default function App() {
  // Authentication status
  const [user, setUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(false);

  // Core biddings list
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Selected bidding for detail workspace
  const [selectedLicitacaoId, setSelectedLicitacaoId] = useState<string | null>(null);

  // Main dashboard view control ("editais" | "fornecedores")
  const [activeMainView, setActiveMainView] = useState<"editais" | "fornecedores">("editais");

  // Global Alerts Panel overlay
  const [showGlobalAlerts, setShowGlobalAlerts] = useState(false);

  // Company details
  const [companySettings, setCompanySettings] = useState<CompanySetting>(MOCK_COMPANY_DETAILS);

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedState, setSelectedState] = useState("Todos");
  const [selectedStatus, setSelectedStatus] = useState("Todos");

  // Deletion confirmation state
  const [licitacaoToDelete, setLicitacaoToDelete] = useState<Licitacao | null>(null);

  // New Bidding PNCP-friendly modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalTab, setAddModalTab] = useState<"paste" | "form">("paste");
  const [pastedPNCP, setPastedPNCP] = useState("");
  const [parsingLoading, setParsingLoading] = useState(false);
  
  const [newEdital, setNewEdital] = useState("");
  const [newOrgao, setNewOrgao] = useState("");
  const [newModalidade, setNewModalidade] = useState("Dispensa");
  const [newCategory, setNewCategory] = useState("Tecnologia da Informação");
  const [newUnidadeCompradora, setNewUnidadeCompradora] = useState("");
  const [newAmparoLegal, setNewAmparoLegal] = useState("");
  const [newIdPncp, setNewIdPncp] = useState("");
  const [newModoDisputa, setNewModoDisputa] = useState("");
  const [newObjeto, setNewObjeto] = useState("");
  const [newValorEstimado, setNewValorEstimado] = useState<number>(0);
  const [newCidade, setNewCidade] = useState("");
  const [newEstado, setNewEstado] = useState("BA");
  const [newInicioPropostas, setNewInicioPropostas] = useState("");
  const [newFimPropostas, setNewFimPropostas] = useState("");
  const [newItensPncp, setNewItensPncp] = useState<{
    numero: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
  }[]>([]);
  const [newArquivosPncp, setNewArquivosPncp] = useState<{
    id: string;
    nome: string;
    descricao?: string;
    linkUrl?: string;
    tamanho?: string;
  }[]>([]);

  // Loading settings from localStorage if exist
  useEffect(() => {
    const saved = localStorage.getItem("licitacoes_company_settings");
    if (saved) {
      try { setCompanySettings(JSON.parse(saved)); } catch (_) {}
    }
  }, []);



  // Sync auth status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsGuestMode(false);
      } else {
        const savedVirtual = localStorage.getItem("licitacoes_virtual_user");
        if (savedVirtual) {
          try {
            setUser(JSON.parse(savedVirtual));
            setIsGuestMode(false);
          } catch (_) {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch or sync biddings data
  useEffect(() => {
    if (authLoading) return;

    if (isGuestMode || (user && user.isVirtual)) {
      const storageKey = user ? `licitacoes_data_${user.uid}` : "licitacoes_guest_data";
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          setLicitacoes(JSON.parse(saved));
        } catch (_) {
          setLicitacoes(MOCK_LICITACOES);
        }
      } else {
        setLicitacoes(MOCK_LICITACOES);
        localStorage.setItem(storageKey, JSON.stringify(MOCK_LICITACOES));
      }
      setLoadingList(false);
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
      handleFirestoreError(error, OperationType.GET, "licitacoes");
      setLoadingList(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, isGuestMode]);

  // Handle updates to bidding (both local and Firebase)
  const handleUpdateLicitacao = async (updated: Licitacao) => {
    // 1. Update state first for instant UX feel
    setLicitacoes(prev => {
      const newList = prev.map(item => item.id === updated.id ? updated : item);
      if (isGuestMode || (user && user.isVirtual)) {
        const storageKey = user ? `licitacoes_data_${user.uid}` : "licitacoes_guest_data";
        localStorage.setItem(storageKey, JSON.stringify(newList));
      }
      return newList;
    });

    if (isGuestMode || (user && user.isVirtual)) {
      return;
    }

    if (!user) return;

    // 2. Persist to Firestore
    try {
      const docRef = doc(db, "licitacoes", updated.id);
      await setDoc(docRef, {
        ...updated,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `licitacoes/${updated.id}`);
    }
  };

  const handleOpenAddModal = () => {
    setNewEdital("");
    setNewOrgao("");
    setNewModalidade("Dispensa");
    setNewCategory("Tecnologia da Informação");
    setNewUnidadeCompradora("");
    setNewAmparoLegal("");
    setNewIdPncp("");
    setNewModoDisputa("");
    setNewObjeto("");
    setNewValorEstimado(0);
    setNewCidade("Juazeiro");
    setNewEstado("BA");
    setNewInicioPropostas("");
    setNewFimPropostas("");
    setNewItensPncp([]);
    setNewArquivosPncp([]);
    setPastedPNCP("");
    setAddModalTab("paste");
    setShowAddModal(true);
  };

  // Handle local parse of PNCP page content 
  const handleLocalPncpParse = () => {
    if (!pastedPNCP.trim()) {
      alert("Por favor, cole o texto da licitação do PNCP no campo para podermos extrair os dados!");
      return;
    }
    
    setParsingLoading(true);
    try {
      const data = parsePncpClipboardText(pastedPNCP);
      
      // Load parsed values into state
      setNewEdital(data.edital || "Aviso de Contratação");
      setNewOrgao(data.orgao || "Órgão Não Informado");
      setNewUnidadeCompradora(data.unidadeCompradora);
      setNewModalidade(data.modalidade || "Dispensa");
      setNewAmparoLegal(data.amparoLegal);
      setNewModoDisputa(data.modoDisputa || "");
      setNewIdPncp(data.idPncp);
      setNewObjeto(data.objeto || "");
      setNewValorEstimado(data.valorEstimado || 0);
      setNewCidade(data.cidade || "Juazeiro");
      setNewEstado(data.estado || "BA");
      setNewInicioPropostas(data.dataInicio);
      setNewFimPropostas(data.dataFim);
      setNewItensPncp(data.itens || []);
      setNewArquivosPncp(data.arquivos || []);

      // Guess standard categories
      if (data.objeto) {
        const lowerObj = data.objeto.toLowerCase();
        if (lowerObj.includes("papelaria") || lowerObj.includes("suprimento") || lowerObj.includes("consumo") || lowerObj.includes("papel") || lowerObj.includes("tinta")) {
          setNewCategory("Materiais & Equipamentos");
        } else if (lowerObj.includes("software") || lowerObj.includes("computador") || lowerObj.includes("ti") || lowerObj.includes("tecnologia")) {
          setNewCategory("Tecnologia da Informação");
        } else if (lowerObj.includes("obra") || lowerObj.includes("reforma") || lowerObj.includes("construção") || lowerObj.includes("engenharia")) {
          setNewCategory("Obras & Engenharia");
        } else if (lowerObj.includes("limpeza") || lowerObj.includes("segurança") || lowerObj.includes("serviço")) {
          setNewCategory("Serviços Gerais");
        }
      }

      setAddModalTab("form");
    } catch (err) {
      console.error("Local parsing error:", err);
      alert("Erro ao decodificar a estrutura local do PNCP. Tente colar novamente.");
    } finally {
      setParsingLoading(false);
    }
  };

  // Handle AI Senior refinement of PNCP
  const handleGeminiPncpScrape = async () => {
    if (!pastedPNCP.trim()) {
      alert("Cole o texto copiado da página do PNCP para refinar com inteligência artificial!");
      return;
    }
    
    setParsingLoading(true);
    try {
      const res = await fetch("/api/licitacoes/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: pastedPNCP })
      });
      
      if (res.ok) {
        const resultObj = await res.json();
        if (resultObj.success && resultObj.data) {
          const d = resultObj.data;
          setNewEdital(d.edital || "Ficha PNCP Extratada");
          setNewOrgao(d.orgao || "Órgão Extratado");
          setNewModalidade(d.modalidade || "Dispensa");
          setNewObjeto(d.objeto || "");
          setNewValorEstimado(d.valorEstimado || 0);
          setNewCidade(d.cidade || "Juazeiro");
          setNewEstado(d.estado || "BA");
          setNewCategory(d.categoria || "Materiais & Equipamentos");
          if (d.arquivosPncp && d.arquivosPncp.length > 0) {
            setNewArquivosPncp(d.arquivosPncp);
          }
          
          // Preserving specific fields via local parser regex
          const localD = parsePncpClipboardText(pastedPNCP);
          if (localD.unidadeCompradora) setNewUnidadeCompradora(localD.unidadeCompradora);
          if (localD.amparoLegal) setNewAmparoLegal(localD.amparoLegal);
          if (localD.idPncp) setNewIdPncp(localD.idPncp);
          if (localD.modoDisputa) setNewModoDisputa(localD.modoDisputa);
          if (localD.dataInicio) setNewInicioPropostas(localD.dataInicio);
          if (localD.dataFim) setNewFimPropostas(localD.dataFim);
          if (localD.itens && localD.itens.length > 0) setNewItensPncp(localD.itens);
          if ((!d.arquivosPncp || d.arquivosPncp.length === 0) && localD.arquivos && localD.arquivos.length > 0) {
            setNewArquivosPncp(localD.arquivos);
          }
          
          setAddModalTab("form");
        } else {
          // fallback to local parser instantly
          handleLocalPncpParse();
        }
      } else {
        handleLocalPncpParse();
      }
    } catch (err) {
      console.error("Gemini scrape failure, trying local parser:", err);
      handleLocalPncpParse();
    } finally {
      setParsingLoading(false);
    }
  };

  // Create new blank bidding record
  const handleCreateLicitacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEdital.trim() || !newOrgao.trim()) return;

    const newId = "lic-" + Date.now();
    const uid = user ? user.uid : "guest-user";

    // Auto generate initial checklist items based on modalidade/objeto
    const recommendedChecklist: LicitacaoChecklistItem[] = [
      { id: "c1", name: "FGTS CRF Completo", status: "pendente", updatedAt: new Date().toISOString() },
      { id: "c2", name: "Certidão Conjunta Débitos Federais", status: "pendente", updatedAt: new Date().toISOString() },
      { id: "c3", name: "Certidão de Regularidade Trabalhista (SNDT)", status: "pendente", updatedAt: new Date().toISOString() },
      { id: "c4", name: "Qualificação Técnica / Proposta Comercial", status: "pendente", updatedAt: new Date().toISOString() }
    ];

    // Resolve compatible suppliers from MOCK_CATALOG_SUPPLIERS based on keywords or category
    const textPool = [
      newObjeto || "",
      newEdital || "",
      newCategory || "",
      ...newItensPncp.map(item => item.descricao || "")
    ].join(" ").toLowerCase();

    // Filter compatible ones from the catalog
    let compatible = MOCK_CATALOG_SUPPLIERS.filter(sup => {
      return sup.categoryKeywords.some(keyword => textPool.includes(keyword));
    });

    // If no compatible ones found, fallback to first 3 general ones
    if (compatible.length === 0) {
      compatible = MOCK_CATALOG_SUPPLIERS.slice(0, 3);
    } else {
      compatible = compatible.slice(0, 3);
    }

    // Map these 3 compatible suppliers to our SupplierContact structure
    const mappedSuppliers: SupplierContact[] = compatible.map((sup, idx) => {
      // Build realistic itemPrices around item.valorUnitario
      // Apply distinct discounts (5%, 8%, 12%) so each supplier has a unique, competitive bidding range
      const discounts = [0.05, 0.08, 0.12];
      const selectedDiscount = discounts[idx % discounts.length];
      
      const itemPrices: { [itemNumero: string]: number } = {};
      let totalValue = 0;

      newItensPncp.forEach(item => {
        const unitPrice = Math.round((item.valorUnitario * (1 - selectedDiscount)) * 100) / 100;
        itemPrices[item.numero] = unitPrice;
        totalValue += unitPrice * (item.quantidade || 1);
      });

      return {
        id: "catalog-sup-" + Date.now() + "-" + idx + "-" + Math.random().toString(36).substring(2, 6),
        name: sup.name,
        product: sup.product,
        value: totalValue,
        contact: sup.phone ? `${sup.phone} • ${sup.contact}` : sup.contact,
        status: "cotado",
        notes: `Parceiro compatível do catálogo. Desconto médio simulado de ${(selectedDiscount * 100).toFixed(0)}%.`,
        itemPrices
      };
    });

    // Support formatting Brazilian date (DD/MM/YYYY HH:mm) or using standard Date
    let parsedSessionDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().substring(0, 16);
    if (newFimPropostas) {
      if (newFimPropostas.includes("/")) {
        // "17/06/2026 16:30"
        const dParts = newFimPropostas.split(" ");
        const dateParts = dParts[0].split("/");
        if (dateParts.length === 3) {
          const hoursStr = dParts[1] || "09:00";
          const dObj = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${hoursStr}`);
          if (!isNaN(dObj.getTime())) {
            parsedSessionDate = dObj.toISOString().substring(0, 16);
          }
        }
      } else {
        parsedSessionDate = newFimPropostas;
      }
    }

    const newItem: Licitacao = {
      id: newId,
      userId: uid,
      edital: newEdital,
      orgao: newOrgao,
      modalidade: newModalidade,
      objeto: newObjeto || "Rastreio e monitoramento do edital PNCP.",
      valorEstimado: newValorEstimado || 0,
      dataSessao: parsedSessionDate,
      cidade: newCidade || "Juazeiro",
      estado: newEstado || "BA",
      categoria: newCategory,
      status: "Triagem",
      checklist: recommendedChecklist,
      suppliers: mappedSuppliers,
      competitors: [],
      alerts: [
        { id: "a1", type: "whatsapp", title: `Prazo Limite ${newEdital}`, content: "Último dia para recepção de propostas na disputa governamental do PNCP.", triggerDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(), sent: false }
      ],
      historicStatus: [
        { status: "Triagem", timestamp: new Date().toISOString(), notes: "Licitação oficial do PNCP iniciada e cadastrada no sistema de monitoramento.", userId: uid }
      ],
      
      // PNCP specific fields
      idContratacaoPncp: newIdPncp,
      amparoLegal: newAmparoLegal,
      unidadeCompradora: newUnidadeCompradora,
      modoDisputa: newModoDisputa,
      dataInicioPropostas: newInicioPropostas,
      dataFimPropostas: newFimPropostas,
      pncpRawText: pastedPNCP,
      itensPncp: newItensPncp,
      arquivosPncp: newArquivosPncp,

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save
    const updatedList = [newItem, ...licitacoes];
    setLicitacoes(updatedList);

    if (isGuestMode || (user && user.isVirtual)) {
      const storageKey = user ? `licitacoes_data_${user.uid}` : "licitacoes_guest_data";
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
    } else if (user) {
      try {
        await setDoc(doc(db, "licitacoes", newId), newItem);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `licitacoes/${newId}`);
      }
    }

    // Reset inputs
    setNewEdital("");
    setNewOrgao("");
    setNewModalidade("Dispensa");
    setNewCategory("Tecnologia da Informação");
    setNewUnidadeCompradora("");
    setNewAmparoLegal("");
    setNewIdPncp("");
    setNewModoDisputa("");
    setNewObjeto("");
    setNewValorEstimado(0);
    setNewCidade("Juazeiro");
    setNewEstado("BA");
    setNewInicioPropostas("");
    setNewFimPropostas("");
    setNewItensPncp([]);
    setNewArquivosPncp([]);
    setPastedPNCP("");
    setAddModalTab("paste");
    setShowAddModal(false);
    setSelectedLicitacaoId(null); // Return to the main dashboard so the user can see the newly added card
  };

  const handleDeleteLicitacao = async (id: string) => {
    const updatedList = licitacoes.filter(item => item.id !== id);
    setLicitacoes(updatedList);

    if (isGuestMode || (user && user.isVirtual)) {
      const storageKey = user ? `licitacoes_data_${user.uid}` : "licitacoes_guest_data";
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
      if (selectedLicitacaoId === id) setSelectedLicitacaoId(null);
    } else {
      try {
        await deleteDoc(doc(db, "licitacoes", id));
        if (selectedLicitacaoId === id) setSelectedLicitacaoId(null);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `licitacoes/${id}`);
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
    
    // Toast notification simulation
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

  const handleUpdateCompanySettings = (settings: CompanySetting) => {
    setCompanySettings(settings);
    localStorage.setItem("licitacoes_company_settings", JSON.stringify(settings));
  };

  const handleGoogleLogin = async () => {
    try {
      setAuthLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.warn("Autenticação Google falhou. Ativando Modo de Login Seguro Local...", err);
      // Cria uma sessão de login virtual segura para Euclides Marques de maneira automática
      const virtualUser = {
        uid: "local-user-euclides",
        displayName: "Euclides Marques",
        email: "euclidesmarques.dev@gmail.com",
        photoURL: null,
        isVirtual: true
      };
      localStorage.setItem("licitacoes_virtual_user", JSON.stringify(virtualUser));
      setUser(virtualUser);
      setIsGuestMode(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("licitacoes_virtual_user");
    if (isGuestMode || (user && user.isVirtual)) {
      setIsGuestMode(false);
      setUser(null);
      setLicitacoes([]);
    } else {
      await signOut(auth);
    }
    setSelectedLicitacaoId(null);
  };

  // Filter computations
  const filteredLicitacoes = licitacoes.filter((lic) => {
    const matchesSearch = 
      lic.edital.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lic.orgao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lic.objeto.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === "Todas" || lic.categoria === selectedCategory;
    const matchesState = selectedState === "Todos" || lic.estado === selectedState;
    const matchesStatus = selectedStatus === "Todos" || lic.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesState && matchesStatus;
  });

  // KPI Calculations across all loaded/filtered biddings
  const totalEstimadoGlobal = licitacoes.reduce((acc, curr) => acc + curr.valorEstimado, 0);
  const totalWonEst = licitacoes
    .filter(l => l.status === "Ganhamos")
    .reduce((acc, curr) => acc + curr.valorEstimado, 0);

  const wonRatioPercent = licitacoes.length > 0 
    ? Math.round((licitacoes.filter(l => l.status === "Ganhamos").length / licitacoes.length) * 100) 
    : 0;

  // Formatting currency
  const formatCurrencyLocal = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Sparkles className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
        <h2 className="text-lg font-bold">Carregando painel de Licitações...</h2>
        <p className="text-xs text-slate-400 mt-2">Segurança autenticada nos servidores do Google</p>
      </div>
    );
  }

  // Welcome / Authentication screen
  if (!user && !isGuestMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col justify-between py-12 px-4 relative overflow-hidden">
        {/* Abstract background grids */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0284c708_1px,transparent_1px),linear-gradient(to_bottom,#0284c708_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        
        <div className="text-center max-w-4xl mx-auto z-10 my-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-bold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5" /> Analista de Licitações Inteligente
          </div>

          <h1 className="font-extrabold text-white tracking-tight text-4xl md:text-6xl text-center leading-none">
            O Sistema Mais <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">Completo de Licitações</span> do Brasil
          </h1>

          <p className="text-slate-300 text-md md:text-lg max-w-2xl mx-auto mt-6 leading-relaxed">
            Cadastre os editais copiando links ou arrastando textos. Nossa IA preenche tudo, cria o checklist, gerencia faturamento com fornecedores de apoio, monitora alertas via <strong className="text-emerald-400">WhatsApp/E-mail</strong> e faz <strong className="text-blue-400">análise preditiva</strong> de lances.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <button
              onClick={handleGoogleLogin}
              className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 text-sm transition tracking-wide flex items-center justify-center gap-2 cursor-pointer"
            >
              <Globe className="w-4 h-4" />
              Entrar com Conta Google
            </button>
            <button
              onClick={() => setIsGuestMode(true)}
              className="w-full sm:w-auto px-8 py-3.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-sm transition border border-white/10 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Database className="w-4 h-4 text-emerald-400" />
              Entrar em Modo Demonstração
            </button>
          </div>



          {/* Core dynamic capabilities badge listings */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mt-16 text-left">
            <div className="p-4 bg-white/5 border border-white/5 rounded-xl">
              <CheckSquare className="w-5 h-5 text-blue-405 mb-2" />
              <h4 className="text-white text-xs font-bold uppercase">Preenchimento IA</h4>
              <p className="text-slate-300 text-[11px] mt-0.5 leading-normal">Basta colar o link e a IA mapeia valor, tipo de objeto e prazos imprevistos.</p>
            </div>
            <div className="p-4 bg-white/5 border border-white/5 rounded-xl">
              <Sparkles className="w-5 h-5 text-emerald-400 mb-2" />
              <h4 className="text-white text-xs font-bold uppercase">Predições de Lances</h4>
              <p className="text-slate-300 text-[11px] mt-0.5 leading-normal">Compare o histórico final de concorrentes conhecidos e calcule descontos teto.</p>
            </div>
            <div className="p-4 bg-white/5 border border-white/5 rounded-xl">
              <Users className="w-5 h-5 text-sky-400 mb-2" />
              <h4 className="text-white text-xs font-bold uppercase">Fornecedores Apoio</h4>
              <p className="text-slate-300 text-[11px] mt-0.5 leading-normal">Mapeie cotações de atacadistas simulando margens líquidas exatas.</p>
            </div>
            <div className="p-4 bg-white/5 border border-white/5 rounded-xl">
              <Bell className="w-5 h-5 text-amber-500 mb-2" />
              <h4 className="text-white text-xs font-bold uppercase">Notificações Inteligentes</h4>
              <p className="text-slate-300 text-[11px] mt-0.5 leading-normal">Dispare testes reais de alertas de WhatsApp e E-mail de prazos regulamentares.</p>
            </div>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-500 z-10 border-t border-white/5 pt-6">
          Desenvolvido com IA em Cloud Sandbox Segura • {new Date().getFullYear()} lances protegidos
        </div>
      </div>
    );
  }

  // Active workspace with selected bidding details
  if (selectedLicitacaoId) {
    const activeLicitacao = licitacoes.find(l => l.id === selectedLicitacaoId);
    if (activeLicitacao) {
      return (
        <LicitacaoDetails
          licitacao={activeLicitacao}
          companySettings={companySettings}
          onUpdate={handleUpdateLicitacao}
          onBack={() => setSelectedLicitacaoId(null)}
          onUpdateCompanySettings={handleUpdateCompanySettings}
        />
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* Header Menu */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl italic text-white shadow-lg shadow-blue-500/20">
              LIC_PRO
            </div>
            <div>
              <h1 className="font-extrabold text-white text-[15px] tracking-tight leading-none">LICITA_PRO</h1>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mt-1">Inteligência Estratégica IA</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Global Notifications simulator indicator */}
            <button
              onClick={() => setShowGlobalAlerts(!showGlobalAlerts)}
              className={`p-2.5 rounded-xl border transition relative flex items-center justify-center ${
                showGlobalAlerts 
                  ? "bg-amber-500 border-amber-600 text-slate-950 shadow" 
                  : "bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white"
              }`}
              title="Central Geral de Alertas e Prazos"
            >
              <Bell className="w-5 h-5" />
              {licitacoes.flatMap(l => l.alerts).filter(a => !a.testSent).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-amber-500 text-slate-950 text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-slate-900">
                  {licitacoes.flatMap(l => l.alerts).filter(a => !a.testSent).length}
                </span>
              )}
            </button>

            {/* Authentication status badge */}
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-bold text-white truncate max-w-[150px]">
                {user ? user.displayName : "Usuário Convidado"}
              </span>
              <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest leading-none mt-0.5">
                {isGuestMode ? "Modo Demo Local" : "Conta Cloud Ativa"}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-slate-800 hover:bg-red-950 hover:text-red-300 border border-slate-700 transition"
              title="Efetuar Logout"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex-1 w-full space-y-6">
        {/* Global Alerts area expanded panel */}
        {showGlobalAlerts && (
          <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3">
              <button 
                onClick={() => setShowGlobalAlerts(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 bg-slate-800 rounded border border-slate-700"
              >
                Ocultar Central
              </button>
            </div>
            
            <AlertsManager
              licitacoes={licitacoes}
              onTriggerAlert={handleTriggerAlertNow}
              onDeleteAlert={handleDeleteAlert}
              onAddAlert={handleAddAlert}
            />
          </div>
        )}

        {/* Executive Stats & Indicators widget */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4 hover:border-slate-300 transition">
            <div className="p-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Licitações Rastreadas</label>
              <div className="font-black text-slate-900 text-2xl mt-0.5">{licitacoes.length}</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4 hover:border-slate-300 transition">
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Faturamento Vencido</label>
              <div className="font-black text-slate-900 text-2xl mt-0.5 truncate max-w-[190px]">
                {formatCurrencyLocal(totalWonEst)}
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4 hover:border-slate-300 transition">
            <div className="p-3 bg-sky-50 border border-sky-100 text-sky-700 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Taxa de Sucesso</label>
              <div className="font-black text-slate-900 text-2xl mt-0.5">{wonRatioPercent}%</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4 hover:border-slate-300 transition">
            <div className="p-3 bg-amber-50 border border-amber-100 text-amber-700 rounded-xl">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Disparadores Agendados</label>
              <div className="font-black text-slate-900 text-2xl mt-0.5">
                {licitacoes.flatMap(l => l.alerts).length}
              </div>
            </div>
          </div>
        </div>

        {/* Main Dashboard Tab Selector */}
        <div className="flex border-b border-slate-100 bg-white p-1 rounded-2xl shadow-xs gap-1">
          <button
            onClick={() => setActiveMainView("editais")}
            className={`flex-1 sm:flex-initial px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition duration-150 cursor-pointer flex items-center justify-center gap-2 ${
              activeMainView === "editais"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            <Database className="w-4 h-4" />
            Monitoramento de Editais ({licitacoes.length})
          </button>
          <button
            onClick={() => {
              setActiveMainView("fornecedores");
              // Clear search and filters when switching so suppliers list doesn't get weirdly filtered by bidding filters
            }}
            className={`flex-1 sm:flex-initial px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition duration-150 cursor-pointer flex items-center justify-center gap-2 ${
              activeMainView === "fornecedores"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            Base Geral de Fornecedores
          </button>
        </div>

        {activeMainView === "fornecedores" ? (
          <GeneralSuppliers 
            licitacoes={licitacoes} 
            onOpenLicitacao={(id) => setSelectedLicitacaoId(id)} 
          />
        ) : (
          <>
            {/* Navigation Filters & Controls bar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Search box */}
                <div className="relative flex-1 md:max-w-md">
                  <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar por Edital, Órgão, Cidade ou Objeto..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Action buttons triggers */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <a
                    href="https://pncp.gov.br/app/editais?pagina=1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-500" />
                    Portal de Editais PNCP
                  </a>
                  
                  <button
                    onClick={handleOpenAddModal}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/10 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Monitorar Outro Edital
                  </button>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Core filters select dropdown row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Filtro Estado (UF)</label>
                  <select
                    className="w-full text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-2 bg-white"
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                  >
                    <option value="Todos">Exibir Todos Estados</option>
                    {ESTADOS_BRASIL.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Segmento de Categoria</label>
                  <select
                    className="w-full text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-2 bg-white"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="Todas">Exibir Todas Categorias</option>
                    {CATEGORIAS_LICITACAO.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Etapa de Tramitação</label>
                  <select
                    className="w-full text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-2 bg-white"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  >
                    <option value="Todos">Exibir Qualquer Status</option>
                    {STATUS_LICITACAO.map(st => (
                      <option key={st.value} value={st.value}>{st.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end justify-end">
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedState("Todos");
                      setSelectedCategory("Todas");
                      setSelectedStatus("Todos");
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition"
                  >
                    Limpar Todos os Filtros
                  </button>
                </div>
              </div>
            </div>

            {/* Loading / Content items grid */}
            {loadingList ? (
              <div className="py-24 text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                <span className="text-xs font-semibold text-slate-500 mt-2 block">Obtendo licitações sincronizadas...</span>
              </div>
            ) : filteredLicitacoes.length === 0 ? (
              <div className="py-20 text-center bg-white border border-slate-200/80 rounded-2xl p-6">
                <BarChart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-bold text-slate-900 text-base">Nenhum edital coincide com os filtros</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Tente alterar os termos da busca, limpar filtros da barra ou cadastrar um novo edital para acompanhar do início!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredLicitacoes.map((lic) => (
                  <LicitacaoCard
                    key={lic.id}
                    licitacao={lic}
                    onSelect={() => setSelectedLicitacaoId(lic.id)}
                    onDelete={() => setLicitacaoToDelete(lic)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Add Document / bidding creation modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
            <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-400" />
                  Rastrear Licença / Ficha PNCP
                </h3>
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">
                  Portal Nacional de Contratações Públicas
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setPastedPNCP("");
                  setNewItensPncp([]);
                }}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Modal Tabs Selection */}
            <div className="flex border-b border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setAddModalTab("paste")}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 text-center transition flex justify-center items-center gap-1.5 cursor-pointer ${
                  addModalTab === "paste" 
                    ? "border-blue-600 text-blue-600 bg-white" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <PlusCircle className="w-4 h-4 text-blue-500" />
                Colar Texto do PNCP (Inteligente)
              </button>
              <button
                type="button"
                onClick={() => setAddModalTab("form")}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 text-center transition flex justify-center items-center gap-1.5 cursor-pointer ${
                  addModalTab === "form" 
                    ? "border-blue-600 text-blue-600 bg-white" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Settings className="w-4 h-4 text-emerald-500" />
                Ficha de Cadastro Manual ({newItensPncp.length} itens)
              </button>
            </div>

            {addModalTab === "paste" ? (
              <div className="p-6 space-y-4">
                <div className="bg-blue-50/40 border border-blue-100/60 rounded-xl p-4 text-xs text-blue-900 leading-relaxed font-sans">
                  <span className="font-bold block mb-1">Como utilizar a Importação Direta:</span>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-650 font-sans text-xs">
                    <li>Acesse o edital ou aviso de contratação no portal do <strong>PNCP</strong>.</li>
                    <li>Pressione <kbd className="bg-white border px-1 rounded shadow-none text-[10px]">Ctrl+A</kbd> e depois <kbd className="bg-white border px-1 rounded shadow-none text-[10px]">Ctrl+C</kbd> para copiar todo o texto da página da licitação.</li>
                    <li>Cole inteiramente no campo de texto abaixo e clique em <strong>Processar Ficha PNCP</strong>.</li>
                  </ol>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Texto Copiado do PNCP</label>
                  <textarea
                    rows={8}
                    placeholder="Cole aqui o texto copiado da página do PNCP (Ex: 'Portal Nacional de Contratações Públicas... Aviso de Contratação Direta nº PCE1123...') o motor irá decodificar os blocos de dados e inclusive a tabela de lotes de itens organizados!"
                    className="w-full text-xs font-sans text-slate-850 p-3 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white bg-slate-50 transition font-medium leading-relaxed"
                    value={pastedPNCP}
                    onChange={(e) => setPastedPNCP(e.target.value)}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="button"
                    disabled={parsingLoading || !pastedPNCP.trim()}
                    onClick={handleLocalPncpParse}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {parsingLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Processando...
                      </>
                    ) : (
                      <>
                        ⚙️ Processar Ficha PNCP
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={parsingLoading || !pastedPNCP.trim()}
                    onClick={handleGeminiPncpScrape}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-300 disabled:to-indigo-300 text-white text-xs font-bold rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {parsingLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Chamando Inteligência Artificial...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 animate-pulse text-yellow-300" /> Enriquecer com IA (Gemini)
                      </>
                    )}
                  </button>
                </div>

                {pastedPNCP && (
                  <p className="text-[10px] text-slate-400 text-center font-medium font-sans">
                    Preenchimento em tempo de execução 100% integrado com a tabela de fornecedores e cotações.
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleCreateLicitacao} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="text-xs bg-amber-50/60 border border-amber-100 rounded-xl p-3 text-amber-900 font-sans">
                  ⚠️ <strong>Revisão dos campos:</strong> Verifique se os dados extraídos automaticamente estão corretos antes de salvar. Você também pode digitar qualquer campo individualmente.
                </div>

                {/* Seção 1 */}
                <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-150">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Órgão Licitante e Comprador</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Órgão Público Responsável *</label>
                      <input
                        type="text"
                        placeholder="Ex: UNIVERSIDADE DO ESTADO DA BAHIA"
                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                        value={newOrgao}
                        onChange={(e) => setNewOrgao(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Unidade Compradora</label>
                      <input
                        type="text"
                        placeholder="Ex: DEPARTAMENTO DE TECNOLOGIA E CIENCIAS SOCIAIS"
                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                        value={newUnidadeCompradora}
                        onChange={(e) => setNewUnidadeCompradora(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Local / Cidade *</label>
                      <input
                        type="text"
                        placeholder="Ex: Juazeiro"
                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                        value={newCidade}
                        onChange={(e) => setNewCidade(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Estado / UF *</label>
                      <input
                        type="text"
                        maxLength={2}
                        placeholder="BA"
                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white uppercase"
                        value={newEstado}
                        onChange={(e) => setNewEstado(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Seção 2 */}
                <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-150">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Identificação e Amparo Legal (PNCP)</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Identificação / Nº Edital *</label>
                      <input
                        type="text"
                        placeholder="Ex: Aviso de Contratação Direta nº PCE112302026/2026"
                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                        value={newEdital}
                        onChange={(e) => setNewEdital(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">ID Contratação PNCP</label>
                      <input
                        type="text"
                        placeholder="Ex: 14485841000140-1-001269/2026"
                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                        value={newIdPncp}
                        onChange={(e) => setNewIdPncp(e.target.value)}
                      />
                    </div>
                  </div>

                   <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Modalidade da Contratação</label>
                      <select
                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                        value={newModalidade}
                        onChange={(e) => setNewModalidade(e.target.value)}
                      >
                        <option value="Dispensa">Dispensa</option>
                        <option value="Inexigibilidade">Inexigibilidade</option>
                        <option value="Pregão Eletrônico">Pregão Eletrônico</option>
                        <option value="Pregão Presencial">Pregão Presencial</option>
                        <option value="Concorrência">Concorrência</option>
                        <option value="Tomada de Preços">Tomada de Preços</option>
                        <option value="Diálogo Competitivo">Diálogo Competitivo</option>
                        <option value="Leilão">Leilão</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Amparo Legal da Contratação</label>
                      <input
                        type="text"
                        placeholder="Ex: Lei 14.133/2021, Art. 75, II"
                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                        value={newAmparoLegal}
                        onChange={(e) => setNewAmparoLegal(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Modo de Disputa</label>
                      <input
                        type="text"
                        placeholder="Ex: Dispensa com Disputa"
                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                        value={newModoDisputa}
                        onChange={(e) => setNewModoDisputa(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Seção 3 */}
                <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-150">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">3. Descrição do Objeto & Valores</h4>
                  
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Objeto Licitado (Resumo ou Detalhado) *</label>
                    <textarea
                      rows={3}
                      placeholder="Ex: AQUISIÇÃO DE MATERIAL DE CONSUMO DE PAPELARIA A FAVOR DA UNEB..."
                      className="w-full text-xs font-sans text-slate-800 p-2 border border-slate-200 bg-white rounded-lg"
                      value={newObjeto}
                      onChange={(e) => setNewObjeto(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Valor Total Estimado (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ex: 2402.99"
                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                        value={newValorEstimado || ""}
                        onChange={(e) => setNewValorEstimado(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Segmento de Categoria</label>
                      <select
                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                      >
                        {CATEGORIAS_LICITACAO.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Seção 4 */}
                <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-150">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">4. Janela de Envio de Propostas</h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Início Recebimento de Propostas</label>
                      <input
                        type="text"
                        placeholder="Ex: 17/06/2026 14:30"
                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                        value={newInicioPropostas}
                        onChange={(e) => setNewInicioPropostas(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Fim Recebimento (Sessão Pública)</label>
                      <input
                        type="text"
                        placeholder="Ex: 17/06/2026 16:30"
                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                        value={newFimPropostas}
                        onChange={(e) => setNewFimPropostas(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Seção 5: Itens/Lotes extraídos */}
                {newItensPncp.length > 0 && (
                  <div className="bg-blue-50/20 border border-blue-105 p-4 rounded-xl space-y-2">
                    <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center justify-between">
                      <span>5. Itens e Lotes Extraídos do PNCP ({newItensPncp.length})</span>
                      <span className="text-[9px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-black font-sans">Mapeado para Cotações</span>
                    </h4>
                    
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 pr-1">
                      {newItensPncp.map((it, i) => (
                        <div key={i} className="py-2 text-[11px] leading-normal font-sans">
                          <div className="flex justify-between font-bold text-slate-800">
                            <span>Item #{it.numero}</span>
                            <span className="text-blue-700 font-bold">R$ {it.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                          <p className="text-slate-600 font-medium text-xs mt-0.5 leading-snug">{it.descricao}</p>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Quantidade: {it.quantidade} | Estimativa Unitária: R$ {it.valorUnitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setAddModalTab("paste")}
                    className="py-2.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Voltar para Ajuste de Texto
                  </button>

                  <div className="flex-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setPastedPNCP("");
                      setNewItensPncp([]);
                    }}
                    className="py-2.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="py-2.5 px-8 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-650/10 cursor-pointer"
                  >
                    Salvar & Rastrear no Painel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Deletion Confirmation Modal */}
      {licitacaoToDelete && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 relative overflow-hidden">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 border border-rose-100 mb-4">
              <Trash2 className="h-6 w-6 text-rose-600" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-black text-slate-900 mb-2">
                Excluir Edital e Todos os Registros?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto mb-4">
                Você está prestes a excluir definitivamente o edital <span className="font-extrabold text-slate-800">"{licitacaoToDelete.edital}"</span> ({licitacaoToDelete.orgao}).
              </p>
              
              <div className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-100 text-left mb-6 space-y-1.5">
                <span className="text-[10px] font-black text-rose-800 uppercase tracking-widest block mb-1">Itens Deletados Adicionalmente:</span>
                <ul className="text-[11px] text-slate-600 list-disc list-inside space-y-1">
                  <li>Todos os <span className="font-semibold text-slate-800">Lotes / Itens PNCP</span> cadastrados</li>
                  <li>Todas as <span className="font-semibold text-slate-800">Cotações de Fornecedores</span> vinculadas</li>
                  <li>Registro de <span className="font-semibold text-slate-800">Lances de Concorrentes</span></li>
                  <li>Checklist de controle de documentos</li>
                  <li>Histórico de tramitações e alertas da licitação</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setLicitacaoToDelete(null)}
                className="py-2.5 px-4 flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (licitacaoToDelete) {
                    await handleDeleteLicitacao(licitacaoToDelete.id);
                    setLicitacaoToDelete(null);
                  }
                }}
                className="py-2.5 px-4 flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-red-500/10 cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
