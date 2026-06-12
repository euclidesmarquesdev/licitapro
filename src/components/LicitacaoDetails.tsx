import React, { useState } from "react";
import { Licitacao, LicitacaoChecklistItem, SupplierContact, CompetitorBid, CompanySetting } from "../types";
import { STATUS_LICITACAO, MOCK_CATALOG_SUPPLIERS } from "../data";
import ConfettiCelebration from "./ConfettiCelebration";

// Import Refactored Tab Components
import TabDados from "./TabDados";
import TabDocs from "./TabDocs";
import TabSuppliers from "./TabSuppliers";
import TabCompetitors from "./TabCompetitors";
import TabPredict from "./TabPredict";
import TabCompliance from "./TabCompliance";
import TabAlerts from "./TabAlerts";
import TabReport from "./TabReport";

import { 
  ArrowLeft, FileText, CheckSquare, Users, Sparkles, Bell, 
  Printer, AlertTriangle, Scale, Landmark
} from "lucide-react";

interface LicitacaoDetailsProps {
  licitacao: Licitacao;
  companySettings: CompanySetting;
  onUpdate: (updated: Licitacao) => void;
  onBack: () => void;
  onUpdateCompanySettings: (settings: CompanySetting) => void;
}

export default function LicitacaoDetails({
  licitacao,
  companySettings,
  onUpdate,
  onBack,
  onUpdateCompanySettings
}: LicitacaoDetailsProps) {
  const [activeTab, setActiveTab] = useState<"dados" | "docs" | "suppliers" | "competitors" | "predict" | "alerts" | "report" | "compliance">("dados");
  const activeSuppliers = (licitacao.suppliers || []).filter(s => s && s.name && !s.name.startsWith("[PNCP]"));
  
  // Scraper options
  const [scrapeOverwriteCore, setScrapeOverwriteCore] = useState(false);
  const [scrapeOverwriteLocation, setScrapeOverwriteLocation] = useState(false);
  const [scrapeImportDocs, setScrapeImportDocs] = useState(true);
  
  // General editing fields
  const [edital, setEdital] = useState(licitacao.edital);
  const [orgao, setOrgao] = useState(licitacao.orgao);
  const [objeto, setObjeto] = useState(licitacao.objeto);
  const [modalidade, setModalidade] = useState(licitacao.modalidade);
  const [valorEstimado, setValorEstimado] = useState(licitacao.valorEstimado);
  const [dataSessao, setDataSessao] = useState(licitacao.dataSessao);
  const [cidade, setCidade] = useState(licitacao.cidade);
  const [estado, setEstado] = useState(licitacao.estado);
  const [categoria, setCategoria] = useState(licitacao.categoria);
  const [url, setUrl] = useState(licitacao.url || "");
  const [unidadeCompradora, setUnidadeCompradora] = useState(licitacao.unidadeCompradora || "");
  const [amparoLegal, setAmparoLegal] = useState(licitacao.amparoLegal || "");
  const [idContratacaoPncp, setIdContratacaoPncp] = useState(licitacao.idContratacaoPncp || "");
  const [modoDisputa, setModoDisputa] = useState(licitacao.modoDisputa || "");
  const [dataInicioPropostas, setDataInicioPropostas] = useState(licitacao.dataInicioPropostas || "");
  const [dataFimPropostas, setDataFimPropostas] = useState(licitacao.dataFimPropostas || "");

  // Link parsing inputs
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState("");

  // Docs inputs
  const [newDocName, setNewDocName] = useState("");
  const [newDocObs, setNewDocObs] = useState("");

  // AI Predictive status
  const [isPredicting, setIsPredicting] = useState(false);

  // Status Change State
  const [statusNote, setStatusNote] = useState("");

  // Form saving notification
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Document drafts
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);

  // Celebration modal state
  const [celebration, setCelebration] = useState<{
    isOpen: boolean;
    type: "items" | "docs" | null;
  }>({
    isOpen: false,
    type: null
  });

  // Reusable confirmation modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "document" | "supplier" | "competitor";
    itemId: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "document",
    itemId: ""
  });

  const checkCelebration = (
    newChecklist?: LicitacaoChecklistItem[],
    newSuppliers?: SupplierContact[]
  ) => {
    if (newChecklist) {
      const prevAll = licitacao.checklist.length > 0 && licitacao.checklist.every(d => d.status === "validado" || d.status === "documento_pronto");
      const nextAll = newChecklist.length > 0 && newChecklist.every(d => d.status === "validado" || d.status === "documento_pronto");
      if (nextAll && !prevAll) {
        setCelebration({ isOpen: true, type: "docs" });
      }
    }
    if (newSuppliers) {
      const activeNew = newSuppliers.filter(s => s && s.name && !s.name.startsWith("[PNCP]"));
      const activeOld = (licitacao.suppliers || []).filter(s => s && s.name && !s.name.startsWith("[PNCP]"));
      const prevAll = activeOld.length > 0 && activeOld.every(s => s.status === "cotado");
      const nextAll = activeNew.length > 0 && activeNew.every(s => s.status === "cotado");
      if (nextAll && !prevAll) {
        setCelebration({ isOpen: true, type: "items" });
      }
    }
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm.type === "document") {
      handleDeleteDoc(deleteConfirm.itemId);
    } else if (deleteConfirm.type === "supplier") {
      handleDeleteSupplier(deleteConfirm.itemId);
    } else if (deleteConfirm.type === "competitor") {
      handleDeleteCompetitor(deleteConfirm.itemId);
    }
    setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);
  };

  const handleSaveMainDetails = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Licitacao = {
      ...licitacao,
      edital,
      orgao,
      objeto,
      modalidade,
      valorEstimado: Number(valorEstimado),
      dataSessao,
      cidade,
      estado,
      categoria,
      url,
      unidadeCompradora,
      amparoLegal,
      idContratacaoPncp,
      modoDisputa,
      dataInicioPropostas,
      dataFimPropostas,
      updatedAt: new Date().toISOString()
    };
    onUpdate(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleStatusChange = (newStatus: Licitacao["status"]) => {
    const historyItem = {
      status: newStatus,
      timestamp: new Date().toISOString(),
      notes: statusNote || `Status alterado manualmente para ${newStatus}`,
      userId: licitacao.userId
    };

    const updated: Licitacao = {
      ...licitacao,
      status: newStatus,
      historicStatus: [historyItem, ...licitacao.historicStatus],
      updatedAt: new Date().toISOString()
    };
    onUpdate(updated);
    setStatusNote("");
  };

  // Scraper implementation
  const handleScrapeWithIA = async () => {
    if (!scrapeUrl && !pasteText) {
      setScrapeError("Por favor informe uma URL ou cole o texto do edital na caixa abaixo.");
      return;
    }

    setIsScraping(true);
    setScrapeError("");

    try {
      const response = await fetch("/api/licitacoes/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scrapeUrl, rawText: pasteText })
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Ocorreu um erro desconhecido durante o parsing da IA.");
      }

      if (body.success && body.data) {
        const extracted = body.data;
        
        // Update states respecting selected options
        if (scrapeOverwriteCore) {
          setEdital(extracted.edital || edital);
          setOrgao(extracted.orgao || orgao);
          setObjeto(extracted.objeto || objeto);
          setModalidade(extracted.modalidade || modalidade);
          setValorEstimado(extracted.valorEstimado || valorEstimado);
          setDataSessao(extracted.dataSessao || dataSessao);
          setCategoria(extracted.categoria || categoria);
        } else {
          if (!edital && extracted.edital) setEdital(extracted.edital);
          if (!orgao && extracted.orgao) setOrgao(extracted.orgao);
          if (!objeto && extracted.objeto) setObjeto(extracted.objeto);
          if (!modalidade && extracted.modalidade) setModalidade(extracted.modalidade);
          if ((!valorEstimado || valorEstimado === 0) && extracted.valorEstimado) setValorEstimado(extracted.valorEstimado);
          if (!dataSessao && extracted.dataSessao) setDataSessao(extracted.dataSessao);
          if (!categoria && extracted.categoria) setCategoria(extracted.categoria);
        }

        if (scrapeOverwriteLocation) {
          setCidade(extracted.cidade || cidade);
          setEstado(extracted.estado || estado);
        } else {
          if (!cidade && extracted.cidade) setCidade(extracted.cidade);
          if (!estado && extracted.estado) setEstado(extracted.estado);
        }

        let finalUnidadeCompradora = unidadeCompradora;
        let finalAmparoLegal = amparoLegal;
        let finalIdPncp = idContratacaoPncp;
        let finalModoDisputa = modoDisputa;
        let finalDataInicio = dataInicioPropostas;
        let finalDataFim = dataFimPropostas;
        let finalItens = licitacao.itensPncp || [];
        let finalArquivos = [...(licitacao.arquivosPncp || [])];
        
        // Merge from AI-extracted arquivosPncp if any
        if (extracted.arquivosPncp && extracted.arquivosPncp.length > 0) {
          extracted.arquivosPncp.forEach((file: any) => {
            if (!finalArquivos.some((a: any) => a.nome.toLowerCase() === file.nome.toLowerCase())) {
              finalArquivos.push({
                id: file.id || "pncp-doc-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
                nome: file.nome,
                descricao: file.descricao || "Documento oficial do edital",
                linkUrl: file.linkUrl || "https://pncp.gov.br/app/editais?pagina=1",
                tamanho: file.tamanho || "Indisponível"
              });
            }
          });
        }

        // Populate checklists if recommended and allowed
        let updatedChecklist = [...licitacao.checklist];
        if (scrapeImportDocs && extracted.checklistRecomendado) {
          extracted.checklistRecomendado.forEach((name: string, idx: number) => {
            if (!updatedChecklist.some(item => item.name.toLowerCase() === name.toLowerCase())) {
              updatedChecklist.push({
                id: `c-ext-${idx}-${Date.now()}`,
                name,
                status: "pendente" as const,
                updatedAt: new Date().toISOString(),
                obs: "Recomendado pela IA"
              });
            }
          });
        }

        // Unique competitors list
        let updatedCompetitors = [...licitacao.competitors];
        if (scrapeImportDocs && extracted.competitorsEstimated) {
          extracted.competitorsEstimated.forEach((name: string, idx: number) => {
            if (!updatedCompetitors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
              updatedCompetitors.push({
                id: `cp-ext-${idx}-${Date.now()}`,
                name,
                bidValue: 0,
                status: "perdeu" as const
              });
            }
          });
        }

        // Map parsed items into supplier contacts if any are empty
        let updatedSuppliers = [...licitacao.suppliers];
        if (finalItens && finalItens.length > 0 && updatedSuppliers.length === 0) {
          updatedSuppliers = finalItens.map((item, idx) => ({
            id: "pncp-item-" + idx + "-" + Date.now(),
            name: "[PNCP] Item " + item.numero,
            product: item.descricao,
            value: item.valorUnitario,
            contact: "(Disputa/Cotação)",
            status: "aguardando",
            notes: `Lote extraído: Qtd ${item.quantidade} | Valor Unitário Estimado: R$ ${item.valorUnitario.toFixed(2)} | Total: R$ ${item.valorTotal.toFixed(2)}`
          }));
        }

        onUpdate({
          ...licitacao,
          edital: scrapeOverwriteCore ? (extracted.edital || edital) : (edital || extracted.edital),
          orgao: scrapeOverwriteCore ? (extracted.orgao || orgao) : (orgao || extracted.orgao),
          objeto: scrapeOverwriteCore ? (extracted.objeto || objeto) : (objeto || extracted.objeto),
          modalidade: scrapeOverwriteCore ? (extracted.modalidade || modalidade) : (modalidade || extracted.modalidade),
          valorEstimado: scrapeOverwriteCore ? Number(extracted.valorEstimado || valorEstimado) : Number(valorEstimado || extracted.valorEstimado || 0),
          dataSessao: scrapeOverwriteCore ? (extracted.dataSessao || dataSessao) : (dataSessao || extracted.dataSessao),
          cidade: scrapeOverwriteLocation ? (extracted.cidade || cidade) : (cidade || extracted.cidade),
          estado: scrapeOverwriteLocation ? (extracted.estado || estado) : (estado || extracted.estado),
          categoria: scrapeOverwriteCore ? (extracted.categoria || categoria) : (categoria || extracted.categoria),
          checklist: updatedChecklist,
          competitors: updatedCompetitors,
          suppliers: updatedSuppliers,
          
          unidadeCompradora: finalUnidadeCompradora,
          amparoLegal: finalAmparoLegal,
          idContratacaoPncp: finalIdPncp,
          modoDisputa: finalModoDisputa,
          dataInicioPropostas: finalDataInicio,
          dataFimPropostas: finalDataFim,
          itensPncp: finalItens,
          arquivosPncp: finalArquivos,

          updatedAt: new Date().toISOString()
        });

        setScrapeUrl("");
        setPasteText("");
        alert("Preenchimento automático via IA realizado com sucesso! Verifique os dados nas abas.");
      }
    } catch (err: any) {
      setScrapeError(err.message || "Erro de conexão com o servidor de IA.");
    } finally {
      setIsScraping(false);
    }
  };

  // Add Document Checklist
  const handleAddDoc = () => {
    if (!newDocName.trim()) return;
    const newItem: LicitacaoChecklistItem = {
      id: "doc-" + Date.now(),
      name: newDocName,
      status: "pendente",
      obs: newDocObs,
      updatedAt: new Date().toISOString()
    };
    onUpdate({
      ...licitacao,
      checklist: [...licitacao.checklist, newItem],
      updatedAt: new Date().toISOString()
    });
    setNewDocName("");
    setNewDocObs("");
  };

  // Attach reference file from PNCP to official checklist
  const handleAttachPncpFile = (file: { id: string; nome: string; descricao?: string; linkUrl?: string; tamanho?: string; }) => {
    if (licitacao.checklist.some(item => item.name.toLowerCase() === file.nome.toLowerCase() || (item.obs && item.obs.toLowerCase().includes(file.nome.toLowerCase())))) {
      alert(`O arquivo "${file.nome}" já está anexado ao seu checklist.`);
      return;
    }
    
    const newItem: LicitacaoChecklistItem = {
      id: "doc-pncp-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      name: file.nome,
      status: "validado",
      obs: `Documento extraído do PNCP: ${file.descricao || "Sem descrição"}. Tamanho: ${file.tamanho || "Indeterminado"}. Link: ${file.linkUrl || "https://pncp.gov.br/app/editais?pagina=1"}`,
      updatedAt: new Date().toISOString()
    };
    
    onUpdate({
      ...licitacao,
      checklist: [...licitacao.checklist, newItem],
      updatedAt: new Date().toISOString()
    });
    alert(`Arquivo "${file.nome}" anexado com sucesso ao seu checklist de documentos habilitados!`);
  };

  const handleToggleDocStatus = (id: string, newStatus: LicitacaoChecklistItem["status"]) => {
    const updatedChecklist = licitacao.checklist.map(doc => 
      doc.id === id ? { ...doc, status: newStatus, updatedAt: new Date().toISOString() } : doc
    );
    checkCelebration(updatedChecklist, undefined);
    onUpdate({
      ...licitacao,
      checklist: updatedChecklist,
      updatedAt: new Date().toISOString()
    });
  };

  const handleDeleteDoc = (id: string) => {
    onUpdate({
      ...licitacao,
      checklist: licitacao.checklist.filter(d => d.id !== id),
      updatedAt: new Date().toISOString()
    });
  };

  // Suppliers Management with Global Catalog Synced to localStorage
  const handleAddSupplier = (name: string, product: string, contact: string) => {
    if (!name.trim()) return;

    // Assign a mock discount of 4% to 14% to make comparison data active & realistic
    const selectedDiscount = 0.05 + (Math.random() * 0.08); 
    const itemPrices: { [itemNumero: string]: number } = {};
    let totalValue = 0;

    (licitacao.itensPncp || []).forEach(item => {
      const unitPrice = Math.round((item.valorUnitario * (1 - selectedDiscount)) * 100) / 100;
      itemPrices[item.numero] = unitPrice;
      totalValue += unitPrice * (item.quantidade || 1);
    });

    const newItem: SupplierContact = {
      id: "sup-" + Date.now(),
      name,
      product: product || "Produto Geral",
      value: totalValue || 0,
      contact: contact || "comercial@empresa.com.br",
      status: totalValue > 0 ? "cotado" : "aguardando",
      itemPrices
    };

    const updatedSuppliers = [...licitacao.suppliers, newItem];
    checkCelebration(undefined, updatedSuppliers);

    onUpdate({
      ...licitacao,
      suppliers: updatedSuppliers,
      updatedAt: new Date().toISOString()
    });

    // Save newly added manual supplier to the global database as well!
    try {
      const saved = localStorage.getItem("licitacoes_general_suppliers");
      let currentList = saved ? JSON.parse(saved) : [...MOCK_CATALOG_SUPPLIERS];
      if (!currentList.some((s: any) => s.name.toLowerCase() === name.toLowerCase())) {
        const globalSup = {
          name,
          product: product || "Produto Geral",
          value: totalValue || 0,
          contact: contact || "comercial@empresa.com.br",
          phone: "(11) 99999-9999",
          categoryKeywords: [
            product ? product.toLowerCase() : "geral", 
            licitacao.categoria ? licitacao.categoria.toLowerCase() : "geral"
          ]
        };
        currentList = [globalSup, ...currentList];
        localStorage.setItem("licitacoes_general_suppliers", JSON.stringify(currentList));
      }
    } catch (e) {
      console.error("Local sync fail for global suppliers:", e);
    }
  };

  const handleUpdateSupplierStatus = (id: string, newStatus: SupplierContact["status"], priceValue?: number) => {
    const updatedSuppliers = licitacao.suppliers.map(s => 
      s.id === id ? { 
        ...s, 
        status: newStatus, 
        value: priceValue !== undefined ? priceValue : s.value 
      } : s
    );
    checkCelebration(undefined, updatedSuppliers);
    onUpdate({
      ...licitacao,
      suppliers: updatedSuppliers,
      updatedAt: new Date().toISOString()
    });
  };

  const handleDeleteSupplier = (id: string) => {
    onUpdate({
      ...licitacao,
      suppliers: licitacao.suppliers.filter(s => s.id !== id),
      updatedAt: new Date().toISOString()
    });
  };

  const getCompatibleSuppliers = () => {
    const textPool = [
      licitacao.objeto || "",
      licitacao.edital || "",
      licitacao.categoria || "",
      ...(licitacao.itensPncp || []).map(item => item.descricao || "")
    ].join(" ").toLowerCase();

    return MOCK_CATALOG_SUPPLIERS.filter(sup => {
      return sup.categoryKeywords.some(keyword => textPool.includes(keyword));
    });
  };

  const handleImportCatalogSupplier = (sup: typeof MOCK_CATALOG_SUPPLIERS[0]) => {
    const existingIndex = licitacao.suppliers.findIndex(s => s.name.toLowerCase() === sup.name.toLowerCase());
    
    if (existingIndex !== -1) {
      const updatedSuppliers = licitacao.suppliers.filter((_, idx) => idx !== existingIndex);
      onUpdate({
        ...licitacao,
        suppliers: updatedSuppliers,
        updatedAt: new Date().toISOString()
      });
      return;
    }

    const selectedDiscount = 0.05 + (Math.random() * 0.08); 
    const itemPrices: { [itemNumero: string]: number } = {};
    let totalValue = 0;

    (licitacao.itensPncp || []).forEach(item => {
      const unitPrice = Math.round((item.valorUnitario * (1 - selectedDiscount)) * 100) / 100;
      itemPrices[item.numero] = unitPrice;
      totalValue += unitPrice * (item.quantidade || 1);
    });

    const newItem: SupplierContact = {
      id: "catalog-sup-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      name: sup.name,
      product: sup.product,
      value: totalValue || sup.value,
      contact: sup.phone ? `${sup.phone} • ${sup.contact}` : sup.contact,
      status: "cotado",
      notes: `Parceiro compatível do catálogo. Desconto proposto de ${(selectedDiscount * 100).toFixed(0)}%.`,
      itemPrices
    };

    const updatedSuppliers = [...licitacao.suppliers, newItem];
    checkCelebration(undefined, updatedSuppliers);
    onUpdate({
      ...licitacao,
      suppliers: updatedSuppliers,
      updatedAt: new Date().toISOString()
    });
  };

  const handleImportAllCompatible = (matching: typeof MOCK_CATALOG_SUPPLIERS) => {
    let count = 0;
    const currentSuppliers = [...licitacao.suppliers];

    matching.forEach(sup => {
      if (!currentSuppliers.some(s => s.name.toLowerCase() === sup.name.toLowerCase())) {
        const selectedDiscount = 0.05 + (Math.random() * 0.08);
        const itemPrices: { [itemNumero: string]: number } = {};
        let totalValue = 0;

        (licitacao.itensPncp || []).forEach(item => {
          const unitPrice = Math.round((item.valorUnitario * (1 - selectedDiscount)) * 100) / 100;
          itemPrices[item.numero] = unitPrice;
          totalValue += unitPrice * (item.quantidade || 1);
        });

        currentSuppliers.push({
          id: "catalog-sup-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6) + "-" + count,
          name: sup.name,
          product: sup.product,
          value: totalValue || sup.value,
          contact: sup.phone ? `${sup.phone} • ${sup.contact}` : sup.contact,
          status: "cotado",
          notes: `Parceiro compatível do catálogo. Desconto proposto de ${(selectedDiscount * 100).toFixed(0)}%.`,
          itemPrices
        });
        count++;
      }
    });

    if (count === 0) {
      alert("Todos os fornecedores compatíveis já estão presentes na lista.");
      return;
    }

    checkCelebration(undefined, currentSuppliers);
    onUpdate({
      ...licitacao,
      suppliers: currentSuppliers,
      updatedAt: new Date().toISOString()
    });
  };

  // Competitors Management
  const handleAddCompetitor = (name: string, cnpj: string, bid: number) => {
    if (!name.trim()) return;
    const newItem: CompetitorBid = {
      id: "comp-" + Date.now(),
      name,
      cnpj,
      bidValue: Number(bid),
      status: "perdeu"
    };
    onUpdate({
      ...licitacao,
      competitors: [...licitacao.competitors, newItem],
      updatedAt: new Date().toISOString()
    });
  };

  const handleUpdateCompetitorStatus = (id: string, newStatus: CompetitorBid["status"], val?: number) => {
    const updatedCompetitors = licitacao.competitors.map(c => 
      c.id === id ? { 
        ...c, 
        status: newStatus,
        bidValue: val !== undefined ? val : c.bidValue
      } : c
    );
    onUpdate({
      ...licitacao,
      competitors: updatedCompetitors,
      updatedAt: new Date().toISOString()
    });
  };

  const handleDeleteCompetitor = (id: string) => {
    onUpdate({
      ...licitacao,
      competitors: licitacao.competitors.filter(c => c.id !== id),
      updatedAt: new Date().toISOString()
    });
  };

  // AI Predictive Analysis API call
  const handleAIPredict = async () => {
    setIsPredicting(true);
    try {
      const response = await fetch("/api/licitacoes/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licitacao: {
            orgao,
            edital,
            objeto,
            modalidade,
            valorEstimado,
            cidade,
            estado,
            categoria
          },
          competitors: licitacao.competitors,
          historicalPrices: licitacao.competitors.map(c => ({ name: c.name, bid: c.bidValue }))
        })
      });

      const body = await response.json();
      if (body.success && body.prediction) {
        onUpdate({
          ...licitacao,
          predictiveCache: {
            ...body.prediction,
            generatedAt: new Date().toISOString()
          },
          updatedAt: new Date().toISOString()
        });
        alert("Análise preditiva de concorrentes realizada com sucesso!");
      }
    } catch (err) {
      alert("Houve uma falha ao tentar conexão com o modelo preditivo Gemini.");
    } finally {
      setIsPredicting(false);
    }
  };

  // Custom Item creation inside bidding
  const handleCreateCustomItem = (desc: string, qty: number, val: number) => {
    if (!desc.trim()) return;
    const currentItens = licitacao.itensPncp || [];
    let maxNum = 0;
    currentItens.forEach(it => {
      const n = parseInt(it.numero, 10);
      if (!isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    });
    const nextNumero = (maxNum + 1).toString();
    const newItem = {
      numero: nextNumero,
      descricao: desc,
      quantidade: Number(qty) || 1,
      valorUnitario: Number(val) || 0,
      valorTotal: (Number(qty) || 1) * (Number(val) || 0)
    };

    onUpdate({
      ...licitacao,
      itensPncp: [...currentItens, newItem],
      updatedAt: new Date().toISOString()
    });
  };

  const handleDeleteItemPncp = (numero: string) => {
    const currentItens = licitacao.itensPncp || [];
    const updatedItens = currentItens.filter(it => it.numero !== numero);

    const updatedSuppliers = licitacao.suppliers.map(s => {
      const nextPrices = { ...(s.itemPrices || {}) };
      delete nextPrices[numero];

      let computedTotal = 0;
      updatedItens.forEach(it => {
        const itemPrice = nextPrices[it.numero] || 0;
        computedTotal += itemPrice * (it.quantidade || 1);
      });

      return {
        ...s,
        itemPrices: nextPrices,
        value: computedTotal
      };
    });

    onUpdate({
      ...licitacao,
      itensPncp: updatedItens,
      suppliers: updatedSuppliers,
      updatedAt: new Date().toISOString()
    });
  };

  const handleUpdateSupplierItemPrice = (supplierId: string, itemNumero: string, price: number) => {
    const updatedSuppliers = licitacao.suppliers.map(s => {
      if (s.id === supplierId) {
        const itemPrices = { ...(s.itemPrices || {}), [itemNumero]: price };

        const rawItems = licitacao.itensPncp || [];
        let computedTotal = 0;
        rawItems.forEach(it => {
          const itemPrice = it.numero === itemNumero ? price : (itemPrices[it.numero] || 0);
          computedTotal += itemPrice * (it.quantidade || 1);
        });

        const nextStatus = computedTotal > 0 ? "cotado" as const : s.status;

        return {
          ...s,
          itemPrices,
          value: computedTotal,
          status: nextStatus
        };
      }
      return s;
    });

    checkCelebration(undefined, updatedSuppliers);
    onUpdate({
      ...licitacao,
      suppliers: updatedSuppliers,
      updatedAt: new Date().toISOString()
    });
  };

  // Generate Document template via API
  const handleGenerateDocTemplate = async (docType: string) => {
    setIsGeneratingDoc(true);
    try {
      const response = await fetch("/api/licitacoes/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType: docType,
          licitacao: {
            orgao,
            edital,
            objeto,
            modalidade,
            cidade,
            estado
          },
          ourCompanyDetails: companySettings
        })
      });

      const body = await response.json();
      if (body.success && body.data) {
        return { success: true, data: body.data };
      }
    } catch (err) {
      alert("Falha ao gerar o documento.");
    } finally {
      setIsGeneratingDoc(false);
    }
    return { success: false };
  };

  const activeQuoteSum = activeSuppliers
    .filter(s => s.status === "cotado")
    .reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="bg-slate-50 min-h-screen p-4 md:p-6 pb-24">
      {/* Upper Navigation Bar */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition text-slate-700 shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                L-ID: {licitacao.id}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Último ajuste: {new Date(licitacao.updatedAt).toLocaleString("pt-BR")}
              </span>
            </div>
            <h1 className="font-extrabold text-slate-900 text-xl md:text-2xl mt-0.5 font-sans">
              {licitacao.edital}
            </h1>
          </div>
        </div>

        {/* Change status action bar */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-bold text-slate-500 uppercase">Status Geral:</span>
            <select
              className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
              value={licitacao.status}
              onChange={(e) => handleStatusChange(e.target.value as Licitacao["status"])}
            >
              {STATUS_LICITACAO.map(st => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden md:block w-px h-6 bg-slate-200 mx-1" />

          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="text"
              placeholder="Adicionar nota de status..."
              className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6 items-start font-sans">
        {/* Left Side Tab Bar */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-250 p-4 shadow-sm flex flex-col gap-1.5">
          <button
            onClick={() => setActiveTab("dados")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition flex items-center gap-3 cursor-pointer ${
              activeTab === "dados" ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            Dados Iniciais & Scraper
          </button>

          <button
            onClick={() => setActiveTab("docs")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition flex items-center justify-between cursor-pointer ${
              activeTab === "docs" ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <CheckSquare className="w-4 h-4 shrink-0" />
              <span className="truncate">Checklist / Documentos</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              activeTab === "docs" ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-705"
            }`}>
              {licitacao.checklist.filter(d => d.status === "validado").length}/{licitacao.checklist.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("suppliers")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition flex items-center justify-between cursor-pointer ${
              activeTab === "suppliers" ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Users className="w-4 h-4 shrink-0" />
              <span className="truncate">Fornecedores & Cotações</span>
            </div>
            {activeSuppliers.length > 0 && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === "suppliers" ? "bg-blue-500 text-white" : "bg-emerald-50 text-emerald-800"
              }`}>
                {activeSuppliers.filter(s => s.status === "cotado").length}/{activeSuppliers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("competitors")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition flex items-center gap-3 cursor-pointer ${
              activeTab === "competitors" ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Landmark className="w-4 h-4 shrink-0" />
            Concorrentes
          </button>

          <button
            onClick={() => setActiveTab("predict")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition flex items-center gap-3 cursor-pointer ${
              activeTab === "predict" ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-emerald-700 hover:bg-emerald-50 bg-emerald-50/40"
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-650" />
            Análise Preditiva IA
          </button>

          <button
            onClick={() => setActiveTab("compliance")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition flex items-center gap-3 cursor-pointer ${
              activeTab === "compliance" ? "bg-amber-600 text-white shadow-md shadow-amber-150" : "text-amber-800 hover:bg-amber-50 bg-amber-50/40"
            }`}
          >
            <Scale className="w-4 h-4 shrink-0 text-amber-500" />
            Compliance & Leis 14.133
          </button>

          <button
            onClick={() => setActiveTab("alerts")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition flex items-center justify-between cursor-pointer ${
              activeTab === "alerts" ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Bell className="w-4 h-4 shrink-0 text-amber-500" />
              <span className="truncate">Prazos & Notificações</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              activeTab === "alerts" ? "bg-blue-500 text-white" : "bg-amber-100 text-amber-800"
            }`}>
              {licitacao.alerts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("report")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition flex items-center gap-3 cursor-pointer ${
              activeTab === "report" ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Printer className="w-4 h-4 shrink-0" />
            Gerador Proposta & Docs
          </button>

          {/* Mini Historic Summary on Sidebar */}
          <div className="border-t border-slate-100 mt-4 pt-4">
            <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest px-2 mb-2">Linha do Tempo Status</h4>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {licitacao.historicStatus.map((hist, i) => (
                <div key={i} className="text-xs px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg font-sans">
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span className="font-extrabold uppercase text-blue-600">{hist.status}</span>
                    <span>{new Date(hist.timestamp).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <p className="text-slate-650 mt-1 leading-normal text-[11px] font-medium">{hist.notes}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Active Workspace Panel */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-250 shadow-sm min-h-[550px] overflow-hidden flex flex-col font-sans">
          
          {activeTab === "dados" && (
            <TabDados
              licitacao={licitacao}
              saveSuccess={saveSuccess}
              handleSaveMainDetails={handleSaveMainDetails}
              edital={edital}
              setEdital={setEdital}
              modalidade={modalidade}
              setModalidade={setModalidade}
              orgao={orgao}
              setOrgao={setOrgao}
              objeto={objeto}
              setObjeto={setObjeto}
              valorEstimado={valorEstimado}
              setValorEstimado={setValorEstimado}
              dataSessao={dataSessao}
              setDataSessao={setDataSessao}
              cidade={cidade}
              setCidade={setCidade}
              estado={estado}
              setEstado={setEstado}
              categoria={categoria}
              setCategoria={setCategoria}
              url={url}
              setUrl={setUrl}
              idContratacaoPncp={idContratacaoPncp}
              setIdContratacaoPncp={setIdContratacaoPncp}
              unidadeCompradora={unidadeCompradora}
              setUnidadeCompradora={setUnidadeCompradora}
              amparoLegal={amparoLegal}
              setAmparoLegal={setAmparoLegal}
              modoDisputa={modoDisputa}
              setModoDisputa={setModoDisputa}
              dataInicioPropostas={dataInicioPropostas}
              setDataInicioPropostas={setDataInicioPropostas}
              dataFimPropostas={dataFimPropostas}
              setDataFimPropostas={setDataFimPropostas}
              handleAttachPncpFile={handleAttachPncpFile}
              scrapeUrl={scrapeUrl}
              setScrapeUrl={setScrapeUrl}
              pasteText={pasteText}
              setPasteText={setPasteText}
              scrapeOverwriteCore={scrapeOverwriteCore}
              setScrapeOverwriteCore={setScrapeOverwriteCore}
              scrapeOverwriteLocation={scrapeOverwriteLocation}
              setScrapeOverwriteLocation={setScrapeOverwriteLocation}
              scrapeImportDocs={scrapeImportDocs}
              setScrapeImportDocs={setScrapeImportDocs}
              scrapeError={scrapeError}
              isScraping={isScraping}
              handleScrapeWithIA={handleScrapeWithIA}
            />
          )}

          {activeTab === "docs" && (
            <TabDocs
              licitacao={licitacao}
              newDocName={newDocName}
              setNewDocName={setNewDocName}
              newDocObs={newDocObs}
              setNewDocObs={setNewDocObs}
              handleAddDoc={handleAddDoc}
              handleToggleDocStatus={handleToggleDocStatus}
              handleAttachPncpFile={handleAttachPncpFile}
              setDeleteConfirm={setDeleteConfirm}
            />
          )}

          {activeTab === "suppliers" && (
            <TabSuppliers
              licitacao={licitacao}
              activeSuppliers={activeSuppliers}
              formatCurrency={formatCurrency}
              handleAddSupplier={handleAddSupplier}
              getCompatibleSuppliers={getCompatibleSuppliers}
              handleImportAllCompatible={handleImportAllCompatible}
              handleImportCatalogSupplier={handleImportCatalogSupplier}
              handleCreateCustomItem={handleCreateCustomItem}
              handleDeleteItemPncp={handleDeleteItemPncp}
              handleUpdateSupplierItemPrice={handleUpdateSupplierItemPrice}
              handleUpdateSupplierStatus={handleUpdateSupplierStatus}
              setDeleteConfirm={setDeleteConfirm}
            />
          )}

          {activeTab === "competitors" && (
            <TabCompetitors
              licitacao={licitacao}
              formatCurrency={formatCurrency}
              handleAddCompetitor={handleAddCompetitor}
              handleUpdateCompetitorStatus={handleUpdateCompetitorStatus}
              setDeleteConfirm={setDeleteConfirm}
            />
          )}

          {activeTab === "predict" && (
            <TabPredict
              licitacao={licitacao}
              isPredicting={isPredicting}
              handleAIPredict={handleAIPredict}
            />
          )}

          {activeTab === "compliance" && (
            <TabCompliance
              licitacao={licitacao}
              activeSuppliers={activeSuppliers}
              valorEstimado={valorEstimado}
              formatCurrency={formatCurrency}
              activeQuoteSum={activeQuoteSum}
            />
          )}

          {activeTab === "alerts" && (
            <TabAlerts
              licitacao={licitacao}
            />
          )}

          {activeTab === "report" && (
            <TabReport
              companySettings={companySettings}
              onUpdateCompanySettings={onUpdateCompanySettings}
              isGeneratingDoc={isGeneratingDoc}
              handleGenerateDocTemplate={handleGenerateDocTemplate}
            />
          )}

        </div>
      </div>

      {/* Reusable elegant confirmation modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99]" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4" style={{ animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-red-50 text-red-600 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-extrabold text-slate-900">{deleteConfirm.title}</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed font-semibold mt-0.5">
                  {deleteConfirm.message}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-red-500/10 transition-colors cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Celebration Success Congratulations Overlay */}
      <ConfettiCelebration
        isOpen={celebration.isOpen}
        onClose={() => setCelebration({ isOpen: false, type: null })}
        type={celebration.type}
        orgao={licitacao.orgao}
        edital={licitacao.edital}
      />
    </div>
  );
}
