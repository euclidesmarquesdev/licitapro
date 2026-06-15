import React, { useState, useEffect } from "react";
import { Licitacao } from "../types";
import { ESTADOS_BRASIL } from "../data";
import { getClientAuthToken } from "../firebase";
import { 
  Search, ShieldCheck, Download, ExternalLink, Calendar, 
  MapPin, RefreshCw, ChevronLeft, ChevronRight, Check,
  AlertTriangle, Info, FileText, LayoutList, Sparkles, Building2,
  X, FileSpreadsheet
} from "lucide-react";

interface RastreadorPncpProps {
  licitacoes: Licitacao[];
  onSaveNewLicitacao: (newItem: Licitacao) => Promise<void>;
  onOpenLicitacao: (id: string) => void;
  user: any;
  isGuestMode: boolean;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  selectedUf: string;
  setSelectedUf: (val: string) => void;
  selectedModality: string;
  setSelectedModality: (val: string) => void;
  dateRange: string;
  setDateRange: (val: string) => void;
  currentPage: number;
  setCurrentPage: (val: number) => void;
  results: any[];
  setResults: (val: any[]) => void;
  totalRecords: number;
  setTotalRecords: (val: number) => void;
  totalPages: number;
  setTotalPages: (val: number) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
  hasSearched: boolean;
  setHasSearched: (val: boolean) => void;
  runAIEnhanceForImport: boolean;
  setRunAIEnhanceForImport: (val: boolean) => void;
  setActiveMainView?: (view: "editais" | "fornecedores" | "rastreador") => void;
}

export default function RastreadorPncp({
  licitacoes,
  onSaveNewLicitacao,
  onOpenLicitacao,
  user,
  isGuestMode,
  searchTerm,
  setSearchTerm,
  selectedUf,
  setSelectedUf,
  selectedModality,
  setSelectedModality,
  dateRange,
  setDateRange,
  currentPage,
  setCurrentPage,
  results,
  setResults,
  totalRecords,
  setTotalRecords,
  totalPages,
  setTotalPages,
  isLoading,
  setIsLoading,
  hasSearched,
  setHasSearched,
  runAIEnhanceForImport,
  setRunAIEnhanceForImport,
  setActiveMainView
}: RastreadorPncpProps) {
  const [errorMsg, setErrorMsg] = useState("");

  // Loading/feedback indicators for specific items imports
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);

  // Smart state validator to prevent unneeded re-fetching when changing tab back & forth
  const [lastSearchedFilters, setLastSearchedFilters] = useState({
    uf: selectedUf,
    modality: selectedModality,
    dateRange: dateRange
  });

  // Predefined PNCP modalities (Mapped with precise backend codes in 14.133 context)
  const modalitiesList = [
    { value: "Todos", label: "Todas" },
    { value: "6", label: "Pregão" },
    { value: "8", label: "Dispensa de Licitação" },
    { value: "4", label: "Concorrência" },
    { value: "9", label: "Inexigibilidade" },
    { value: "1", label: "Leilão" },
    { value: "2", label: "Diálogo Competitivo" }
  ];

  // Quick keywords search helper
  const quickKeywords = [
    { label: "Tecnologia", query: "tecnologia" },
    { label: "Computadores", query: "computador" },
    { label: "Engenharia", query: "engenharia" },
    { label: "Limpeza", query: "limpeza" },
    { label: "Merenda", query: "merenda" },
    { label: "Saúde", query: "saude" },
    { label: "Medicamentos", query: "medicamento" }
  ];

  // Convert number of days to PNCP YYYYMMDD format
  const getCalculatedDates = (daysAgo: string) => {
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - parseInt(daysAgo));

    const fmt = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    return {
      start: fmt(past),
      end: fmt(today)
    };
  };

  // Perform PNCP searching fetch
  const fetchPncpTenders = async (pageToFetch = 1, forceSearchTerm?: string) => {
    setIsLoading(true);
    setErrorMsg("");
    setImportSuccessMessage(null);

    try {
      const token = await getClientAuthToken();
      const dates = getCalculatedDates(dateRange);
      const termToUse = forceSearchTerm !== undefined ? forceSearchTerm : searchTerm;

      const params = new URLSearchParams({
        pagina: String(pageToFetch),
        dataInicial: dates.start,
        dataFinal: dates.end,
        uf: selectedUf,
        codigoModalidade: selectedModality,
        termo: termToUse
      });

      let data: any;

      try {
        const response = await fetch(`/api/pncp/search?${params.toString()}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        const textResponse = await response.text();
        if (response.ok) {
          data = JSON.parse(textResponse);
        } else {
          try {
            const parsedErr = JSON.parse(textResponse);
            throw new Error(parsedErr.error || `Servidor de busca retornou erro ${response.status}`);
          } catch (e: any) {
            throw new Error(e.message || `Servidor de busca retornou erro ${response.status}`);
          }
        }
      } catch (backendErr: any) {
        console.warn("[PNCP Client] Falha na busca pelo backend (bloqueio de nuvem GCP). Tentando conexão direta do navegador para PNCP...", backendErr.message);
        
        const directParams = new URLSearchParams({
          dataInicial: dates.start,
          dataFinal: dates.end,
          tamanhoPagina: "50",
          pagina: String(pageToFetch)
        });

        if (selectedModality && selectedModality !== "Todos" && selectedModality !== "") {
          directParams.append("codigoModalidadeContratacao", selectedModality);
        }
        if (selectedUf && selectedUf !== "Todos" && selectedUf !== "") {
          directParams.append("uf", selectedUf);
        }

        const directUrls = [
          `https://dadosabertos.pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${directParams.toString()}`,
          `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${directParams.toString()}`
        ];

        let directRawData: any = null;
        let lastDirectErr: any = null;

        for (const url of directUrls) {
          try {
            console.log(`[PNCP Client] Tentando conexão direta para: ${url}`);
            const directRes = await fetch(url, {
              headers: {
                "Accept": "application/json"
              }
            });
            if (directRes.ok) {
              directRawData = await directRes.json();
              console.log("[PNCP Client] Conexão direta com sucesso usando origin:", url);
              break;
            } else {
              lastDirectErr = new Error(`HTTP ${directRes.status}`);
            }
          } catch (err: any) {
            console.warn(`[PNCP Client] Falha de conexão na URL ${url}:`, err.message);
            lastDirectErr = err;
          }
        }

        if (!directRawData) {
          throw new Error(`Falha de conexão com o PNCP Governamental (Erro: ${lastDirectErr?.message || "Servidor indetectável"}). O portal nacional de compras públicas pode estar fora do ar ou bloqueando conexões directas.`);
        }

        let rawList = directRawData.data || [];

        // Apply client-side keyword filtering matching the backend strategy
        if (termToUse && termToUse.trim().length > 0) {
          const cleanSearch = (str: string) => (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          const keyword = cleanSearch(termToUse);
          rawList = rawList.filter((item: any) => {
            const orgaoName = cleanSearch(item.orgaoEntidade?.razaoSocial || "");
            const objeto = cleanSearch(item.objetoCompra || item.objeto || "");
            const numPncp = cleanSearch(item.numeroControlePNCP || "");
            return orgaoName.includes(keyword) || objeto.includes(keyword) || numPncp.includes(keyword);
          });
        }

        data = {
          success: true,
          data: {
            data: rawList.slice(0, 15),
            totalRegistros: termToUse && termToUse.trim().length > 0 ? rawList.length : (directRawData.totalRegistros || rawList.length),
            totalPaginas: termToUse && termToUse.trim().length > 0 ? Math.max(1, Math.ceil(rawList.length / 15)) : (directRawData.totalPaginas || 1),
            isMock: false
          }
        };
      }

      if (data.success && data.data) {
        const payload = data.data;
        setResults(payload.data || payload.resultado || []);
        setTotalRecords(payload.totalRegistros || 0);
        setTotalPages(payload.totalPaginas || 1);
        setCurrentPage(pageToFetch);
        setIsOfflineFallback(!!payload.isMock);
      } else {
        setResults([]);
        setTotalRecords(0);
        setTotalPages(1);
        setIsOfflineFallback(false);
      }
    } catch (err: any) {
      console.error("[PNCP Tracker Client] Search error:", err);
      setErrorMsg(err.message || "Erro de rede ao conectar-se à API Provedora do PNCP.");
    } finally {
      setIsLoading(false);
    }
  };

  // Run search only under correct triggers, avoiding mount noise
  useEffect(() => {
    if (!hasSearched) {
      fetchPncpTenders(1);
      setHasSearched(true);
      setLastSearchedFilters({ uf: selectedUf, modality: selectedModality, dateRange: dateRange });
      return;
    }

    const didFiltersChange =
      selectedUf !== lastSearchedFilters.uf ||
      selectedModality !== lastSearchedFilters.modality ||
      dateRange !== lastSearchedFilters.dateRange;

    if (didFiltersChange) {
      fetchPncpTenders(1);
      setLastSearchedFilters({ uf: selectedUf, modality: selectedModality, dateRange: dateRange });
    }
  }, [selectedUf, selectedModality, dateRange]);

  const handleKeyboardSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      fetchPncpTenders(1);
    }
  };

  // Import selected tender from PNCP directly
  const handleImportTender = async (pncpId: string) => {
    if (importingId) return; // ignore double clicks
    setImportingId(pncpId);
    setErrorMsg("");
    setImportSuccessMessage(null);

    try {
      const token = await getClientAuthToken();
      // Hit existing import endpoint
      const response = await fetch("/api/pncp/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          urlOrCode: pncpId,
          runAIEnhance: runAIEnhanceForImport
        })
      });

      let body: any;
      const importText = await response.text();
      try {
        body = JSON.parse(importText);
      } catch (jsonErr) {
        if (!response.ok) {
          throw new Error(`Erro do servidor de importação (Status ${response.status}). O sistema federal PNCP pode estar sobrecarregado.`);
        } else {
          throw new Error("Resposta incompreensível do servidor de importação.");
        }
      }

      if (!response.ok) {
        throw new Error(body.error || "Erro de extração de tabelas no portal PNCP.");
      }

      if (body.success && body.data) {
        const d = body.data;

        // Build checklist items
        const rawChecklist = d.checklistRecomendado || [
          "Certidão de Débito Federal",
          "FGTS Regularidade CRF",
          "CNDT Trabalhista",
          "Balanço Patrimonial Simplificado"
        ];

        const finalChecklist = rawChecklist.map((name: string, index: number) => ({
          id: `c-track-${index}-${Date.now()}`,
          name,
          status: "pendente" as const,
          updatedAt: new Date().toISOString(),
          obs: "Vínculo regulador PNCP"
        }));

        // Build suppliers list from items
        const rawItems = d.itensPncp || [];
        const finalSuppliers = rawItems.map((it: any, index: number) => ({
          id: `pncp-sup-tr-${index}-${Date.now()}`,
          name: `[PNCP] Item ${it.numero}`,
          product: it.descricao,
          value: it.valorUnitario,
          contact: "(Lances / Cotação)",
          status: "aguardando" as const,
          notes: `Quantidade solicitada: ${it.quantidade} | Unitário Máximo: R$ ${it.valorUnitario?.toFixed(2)} | Total estimado: R$ ${it.valorTotal?.toFixed(2)}`
        }));

        // Build estimated competitors
        const rawCompetitors = d.competitorsEstimated || ["Distribuidor Especializado S.A.", "GovTech Soluções de Escopo"];
        const finalCompetitors = rawCompetitors.map((name: string, index: number) => ({
          id: `cp-track-${index}-${Date.now()}`,
          name,
          bidValue: 0,
          status: "perdeu" as const
        }));

        // Save a clean, premium Licitacao object
        const newLicitacao: Licitacao = {
          id: `pncp-${d.idContratacaoPncp || pncpId.replace(/\D/g, "")}-${Date.now()}`,
          userId: user ? user.uid : "guest-user",
          url: `https://pncp.gov.br/app/editais/${d.idContratacaoPncp || pncpId.replace(/-/g, "/")}`,
          edital: d.edital,
          orgao: d.orgao,
          modalidade: d.modalidade,
          objeto: d.objeto,
          valorEstimado: Number(d.valorEstimado || 0),
          dataSessao: d.dataSessao || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().substring(0, 16),
          cidade: d.cidade || "Brasília",
          estado: d.estado || "DF",
          categoria: d.categoria || "Materiais & Equipamentos",
          status: "Triagem",
          
          checklist: finalChecklist,
          suppliers: finalSuppliers,
          competitors: finalCompetitors,
          alerts: [
            {
              id: `al-init-tr-${Date.now()}`,
              type: "email",
              title: "Abertura do Certame - Sessão Pública",
              content: `A sessão do edital ${d.edital} (${d.orgao}) se iniciará em breve! Realizar upload da proposta definitiva.`,
              triggerDate: d.dataSessao ? new Date(new Date(d.dataSessao).getTime() - 24 * 60 * 60 * 1000).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10),
              sent: false
            }
          ],
          historicStatus: [
            {
              status: "Triagem",
              timestamp: new Date().toISOString(),
              notes: "Importado diretamente do Portal Nacional de Contratações Públicas (PNCP)",
              userId: user ? user.uid : "guest-user"
            }
          ],
          
          idContratacaoPncp: d.idContratacaoPncp || pncpId,
          amparoLegal: d.amparoLegal,
          unidadeCompradora: d.unidadeCompradora,
          modoDisputa: d.modoDisputa || "Aberto",
          dataInicioPropostas: d.dataInicioPropostas,
          dataFimPropostas: d.dataFimPropostas,
          itensPncp: rawItems,
          arquivosPncp: d.arquivosPncp || [],
          
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await onSaveNewLicitacao(newLicitacao);

        // Open the imported bidding notice immediately
        onOpenLicitacao(newLicitacao.id);
        if (setActiveMainView) {
          setActiveMainView("editais");
        }

        setImportSuccessMessage(
          `🚀 Sucesso absoluto! O edital "${d.edital}" do órgão "${d.orgao}" foi importado com todos os seus ${rawItems.length} lotes/itens oficiais e ${d.arquivosPncp?.length || 0} arquivos originais para download.`
        );

        // Scroll up to show success feedback
        window.scrollTo({ top: 300, behavior: "smooth" });
      }
    } catch (err: any) {
      console.error("[PNCP Import Button Failed]:", err);
      setErrorMsg(`Falha na extração de dados do edital: ${err.message}`);
    } finally {
      setImportingId(null);
    }
  };

  const handleKeywordClick = (word: string) => {
    setSearchTerm(word);
    fetchPncpTenders(1, word);
  };

  // Format beautiful state / city location string
  const formatLocation = (item: any): string => {
    const uf = item.unidadeOrgao?.ufSigla || item.ufSigla || item.orgaoEntidade?.ufSigla || "BR";
    const mun = item.unidadeOrgao?.municipioNome || item.orgaoEntidade?.municipioNome || item.municipioNome || "";
    
    if (mun) {
      // Capitalize city name nicely
      const cleanMun = mun.toLowerCase().replace(/(^\w{1})|(\s+\w{1})/g, (letter: string) => letter.toUpperCase());
      return `${cleanMun} - ${uf}`;
    }
    return `Estado: ${uf}`;
  };

  // Format humanized title of a tender (e.g., Pregão Eletrônico SRP 12/2026)
  const formatHumanizedTitle = (item: any): string => {
    const mod = item.modalidadeNome || "Licitação";
    let cleanMod = mod.replace(/\s*-\s*/, " ").trim();
    
    if (cleanMod.toLowerCase().startsWith("pregão")) {
      cleanMod = "Pregão Eletrônico";
    } else if (cleanMod.toLowerCase().startsWith("dispensa")) {
      cleanMod = "Dispensa de Licitação";
    }

    const isSrp = item.srp === true;
    const num = item.numeroCompra || item.sequencialCompra || "";
    const ano = item.anoCompra || "";
    
    let title = cleanMod;
    if (isSrp) {
      title += " SRP";
    }
    
    const cleanNumber = (numStr: any) => {
      if (!numStr) return "";
      const parsed = parseInt(String(numStr), 10);
      return isNaN(parsed) ? String(numStr) : String(parsed);
    };

    if (num) {
      title += ` ${cleanNumber(num)}`;
      if (ano) {
        title += `/${ano}`;
      }
    } else if (ano) {
      title += ` ${ano}`;
    }
    return title;
  };

  // Dynamic category detector matching filter options exactly
  const getCategoryForPncpItem = (item: any): string => {
    const rawObjeto = item.objetoCompra || item.objeto || "";
    const objLower = rawObjeto.toLowerCase();
    
    if (objLower.includes("tecnologia") || objLower.includes("software") || objLower.includes("hardware") || objLower.includes("computador") || objLower.includes("nuvem") || objLower.includes("cloud") || objLower.includes("sistema") || objLower.includes("internet") || objLower.includes("fibra") || objLower.includes("telecom") || objLower.includes("informatica") || objLower.includes("informática") || objLower.includes("ti ") || objLower.includes("link")) {
      return "Tecnologia da Informação";
    }
    if (objLower.includes("obra") || objLower.includes("reforma") || objLower.includes("constru") || objLower.includes("engenharia") || objLower.includes("asfalto") || objLower.includes("calçamento") || objLower.includes("pavimentação") || objLower.includes("saneamento") || objLower.includes("edificação") || objLower.includes("infraestrutura")) {
      return "Obras & Engenharia";
    }
    if (objLower.includes("saude") || objLower.includes("medica") || objLower.includes("hospitalar") || objLower.includes("remedio") || objLower.includes("insumo") || objLower.includes("medicamento") || objLower.includes("clínica") || objLower.includes("odontológico") || objLower.includes("farmácia") || objLower.includes("vacina")) {
      return "Saúde & Medicamentos";
    }
    if (objLower.includes("consultoria") || objLower.includes("treinamento") || objLower.includes("assessoria") || objLower.includes("pesquisa") || objLower.includes("auditoria") || objLower.includes("parecer") || objLower.includes("estudo") || objLower.includes("planejamento")) {
      return "Consultoria";
    }
    if (objLower.includes("limpeza") || objLower.includes("vigilancia") || objLower.includes("seguranca") || objLower.includes("servico") || objLower.includes("conservação") || objLower.includes("portaria") || objLower.includes("coleta") || objLower.includes("desentupimento") || objLower.includes("jardinagem") || objLower.includes("manutenção")) {
      return "Serviços Gerais";
    }
    if (objLower.includes("merenda") || objLower.includes("alimento") || objLower.includes("refeicao") || objLower.includes("padaria") || objLower.includes("gênero alimentício") || objLower.includes("fome") || objLower.includes("cozinha") || objLower.includes("nutrição")) {
      return "Alimentação & Merenda";
    }
    return "Materiais & Equipamentos";
  };

  const getCategoryTheme = (cat: string) => {
    switch (cat) {
      case "Tecnologia da Informação":
        return "bg-blue-50 text-blue-700 border-blue-150";
      case "Obras & Engenharia":
        return "bg-amber-50 text-amber-850 border-amber-200";
      case "Serviços Gerais":
        return "bg-teal-50 text-teal-700 border-teal-200";
      case "Materiais & Equipamentos":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "Consultoria":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "Saúde & Medicamentos":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Alimentação & Merenda":
        return "bg-orange-50 text-orange-700 border-orange-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  // Helpers to format dates and currencies elegantly
  const formatValue = (val: number) => {
    if (!val || val === 0) return "Valor sob cotação / Não informado";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);
  };

  const formatPncpDateString = (isoStr: string) => {
    if (!isoStr) return "Indisponível";
    try {
      const dt = new Date(isoStr);
      if (isNaN(dt.getTime())) return isoStr;
      return dt.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }) + "h";
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Search Header Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-lg border border-slate-800">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Building2 className="w-48 h-48 text-white" />
        </div>
        
        <div className="relative z-10 max-w-4xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-bold uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-blue-400" />
            Rastreador de Oportunidades GovTech
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Consultas em Tempo Real no PNCP
          </h2>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl leading-relaxed">
            Navegue por toda a base de dados oficial do Brasil no <strong>Portal Nacional de Contratações Públicas</strong>. Filtre por localidade, ramo de atividade e importe compras federais, estaduais e municipais com arquivos, itens e IA!
          </p>
        </div>
      </div>

      {/* Control Search Panel Filters */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Text keyword input */}
          <div className="lg:col-span-4">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Palavra-Chave ou Objeto
            </label>
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Ex: tecnologia, software, asfalto, limpeza..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyboardSearch}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    fetchPncpTenders(1, "");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-450 hover:text-red-500 hover:bg-slate-150 rounded-full transition cursor-pointer"
                  title="Limpar pesquisa e resetar filtro"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Estado Selector */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Estado UF
            </label>
            <select
              className="w-full text-xs font-bold text-gray-700 bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer"
              value={selectedUf}
              onChange={(e) => {
                setSelectedUf(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="Todos">Brasil Inteiro (Todos)</option>
              {ESTADOS_BRASIL.map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>

          {/* Modalidade Selector */}
          <div className="lg:col-span-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Modalidade
            </label>
            <select
              className="w-full text-xs font-bold text-gray-700 bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer"
              value={selectedModality}
              onChange={(e) => {
                setSelectedModality(e.target.value);
                setCurrentPage(1);
              }}
            >
              {modalitiesList.map(item => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          {/* Date Window */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Publicado Há
            </label>
            <select
              className="w-full text-xs font-bold text-gray-700 bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer"
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="15">Últimos 15 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="60">Últimos 60 dias (Recomendado)</option>
              <option value="90">Últimos 90 dias</option>
              <option value="180">Últimos 6 meses</option>
            </select>
          </div>

          {/* Search Trigger and Refresh Buttons */}
          <div className="lg:col-span-1 flex items-end gap-2">
            <button
              onClick={() => fetchPncpTenders(1)}
              className="flex-1 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 transition flex items-center justify-center cursor-pointer"
              title="Buscar Editais"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchPncpTenders(currentPage || 1)}
              disabled={isLoading}
              className="p-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 transition flex items-center justify-center cursor-pointer"
              title="Atualizar Página Atual"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick keywords suggestions */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-bold block pr-1 uppercase text-[10px] tracking-wider">Atalhos de Temas:</span>
          {quickKeywords.map((kw, i) => (
            <button
              key={i}
              onClick={() => handleKeywordClick(kw.query)}
              className={`px-3 py-1.5 border rounded-lg text-xs font-medium cursor-pointer transition ${
                searchTerm === kw.query 
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-sm" 
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {kw.label}
            </button>
          ))}
        </div>

        {/* AI toggle settings right in page */}
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-150">
          <input
            type="checkbox"
            id="ai-enhance-tracker"
            className="w-4.5 h-4.5 text-blue-600 border-slate-300 rounded cursor-pointer"
            checked={runAIEnhanceForImport}
            onChange={(e) => setRunAIEnhanceForImport(e.target.checked)}
          />
          <label htmlFor="ai-enhance-tracker" className="text-xs text-slate-700 leading-relaxed cursor-pointer font-medium">
            🧬 <strong className="text-indigo-950">Com Enriquecimento Estratégico IA:</strong> Ao importar, analisar o edital com Gemini para identificar documentos cruciais requeridos de habilitação e predizer potenciais competidores comerciais.
          </label>
        </div>
      </div>

      {/* Success / Error Messages Block */}
      {importSuccessMessage && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 flex gap-3 shadow-xs">
          <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
          <div className="space-y-2">
            <p className="text-xs font-bold leading-normal">{importSuccessMessage}</p>
            <div className="flex items-center gap-3">
              <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-black font-mono">PNCP SUCESS_OK</span>
              <p className="text-[10px] text-emerald-800">Tabelas de itens e download de PDFs de termos unificados!</p>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-950 flex gap-3 text-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <strong className="block font-bold">Problema de Conexão ou Consulta:</strong>
            <p className="mt-0.5 text-slate-600 leading-normal">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Tracker Status Bar Summary */}
      <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 font-sans">
        <div className="flex items-center gap-2">
          <Info className="w-4.5 h-4.5 text-blue-500" />
          <span>Filtros ativos retornando o total de <strong className="text-slate-800">{totalRecords}</strong> contratações públicas no PNCP.</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://pncp.gov.br/app/editais"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-slate-950 text-white rounded-xl font-extrabold flex items-center gap-1.5 hover:bg-slate-850 hover:shadow-md transition text-[10px]"
            title="Acessar o portal oficial do governo"
          >
            <ExternalLink className="w-3.5 h-3.5 text-blue-400" /> Acessar Portal Oficial PNCP
          </a>
          {isOfflineFallback ? (
            <span className="px-2 py-0.5 bg-amber-500 text-white rounded font-bold font-mono text-[10px] animate-pulse">CONTINGÊNCIA ATIVA</span>
          ) : (
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-bold font-mono text-[10px]">100% Conectado</span>
          )}
          <span className="text-slate-400">{isOfflineFallback ? "Servido pelo LicitaPro" : "Portal PNCP Oficial"}</span>
        </div>
      </div>

      {isOfflineFallback && (
        <div className="p-5 bg-amber-50 border border-amber-200 text-amber-950 rounded-2xl flex gap-3.5 shadow-xs">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
          <div className="space-y-1">
            <h4 className="font-bold text-xs" id="contingency-title">🛡️ Modo Inteligente de Contingência Ativo</h4>
            <p className="text-xs text-amber-900 leading-relaxed max-w-4xl" id="contingency-text">
              Detectamos que o Portal Federal do PNCP está temporariamente instável ou bloqueando transações. Para manter sua produtividade ininterrupta e ágil de simulação, o sistema ativou o barramento inteligente de contingência local que responde instantaneamente! Você pode realizar buscas completas por palavras-chave (ex: "computador", "saúde", "engenharia", "merenda"), filtrar Estados e simular importações com IA normalmente.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid View list of results */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 4, 5, 6].map((it) => (
            <div key={it} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-4 bg-slate-200 rounded w-1/12"></div>
              </div>
              <div className="space-y-2">
                <div className="h-5 bg-slate-200 rounded w-4/5"></div>
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              </div>
              <div className="h-20 bg-slate-100 rounded"></div>
              <div className="flex items-center justify-between">
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                <div className="h-10 bg-blue-200 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white border border-slate-200/80 p-16 rounded-3xl text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base">Nenhum resultado retornado do PNCP</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            Experimente reduzir os termos de pesquisa, trocar o Estado de pesquisa para "Todos" ou aumentar a janela de datas de publicação do edital!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {results.map((item) => {
            const alreadyImported = licitacoes.some(l => l.idContratacaoPncp === item.numeroControlePNCP);
            const isImportingThis = importingId === item.numeroControlePNCP;

            return (
              <div 
                key={item.numeroControlePNCP} 
                className={`bg-white border rounded-3xl p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition duration-200 ${
                  alreadyImported ? "bg-slate-50 border-emerald-100 opacity-90" : "border-slate-200/80"
                }`}
              >
                <div className="space-y-4">
                  {/* Card head metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full font-bold text-[10px] uppercase">
                        {item.modalidadeNome || "Licitação Pública"}
                      </span>
                      <span className={`px-2.5 py-1 border rounded-full font-bold text-[10px] uppercase ${getCategoryTheme(getCategoryForPncpItem(item))}`} title="Segmento de Categoria">
                        {getCategoryForPncpItem(item)}
                      </span>
                      <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-100 rounded-full font-extrabold text-[10px] uppercase flex items-center gap-1" title="Unidade da Federação">
                        <MapPin className="w-3 h-3 text-rose-600" />
                        {item.unidadeOrgao?.ufSigla || item.ufSigla || item.orgaoEntidade?.ufSigla || "BR"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj || "000000"}/${item.anoCompra || "2024"}/${item.sequencialCompra || item.sequencialContratacao || "1"}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-full font-bold text-[9px] flex items-center gap-1 transition"
                        title="Abrir diretamente no Portal Oficial"
                      >
                        <ExternalLink className="w-3 h-3 text-blue-500" /> Ver Portal
                      </a>
                    </div>
                  </div>

                  {/* Aesthetic Bidding Humanized Title */}
                  <div className="space-y-1">
                    <div className="flex items-start gap-1.5 text-slate-800">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <h3 className="font-extrabold text-slate-900 text-sm md:text-base leading-snug">
                        {formatHumanizedTitle(item)}
                      </h3>
                    </div>
                  </div>

                  {/* ID / Name Copy block - Now cleanly labeled for search/reference only */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 bg-slate-50 rounded-xl p-2.5 border border-slate-150">
                    <span className="truncate max-w-[280px]" title="ID para Pesquisa">
                      <strong className="text-slate-400">ID Pesquisa:</strong> {item.numeroControlePNCP}
                    </span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(item.numeroControlePNCP || "");
                        alert("ID de contratação copiado para a área de transferência!");
                      }} 
                      className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer hover:underline shrink-0 px-1 ml-1"
                    >
                      Copiar
                    </button>
                  </div>

                  {/* Location (UF / Municipality) and Government Agency */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-100 rounded-full font-bold text-[10px] flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                        {formatLocation(item)}
                      </span>
                    </div>

                    <h4 className="font-extrabold text-slate-700 text-xs line-clamp-1 flex items-center gap-1.5 mt-1" title={item.orgaoEntidade?.razaoSocial}>
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {item.orgaoEntidade?.razaoSocial || "Órgão do Governo"}
                    </h4>
                    
                    <div className="bg-yellow-50/20 p-2.5 rounded-xl border border-yellow-105/40">
                      <label className="block text-[8px] font-bold text-yellow-800 uppercase tracking-widest mb-0.5">Objeto Desbravado</label>
                      <p className="text-xs text-slate-600 leading-normal line-clamp-3 overflow-hidden text-ellipsis" title={item.objetoCompra || item.objeto}>
                        {item.objetoCompra || item.objeto || "Sem objeto detalhado disponível."}
                      </p>
                    </div>
                  </div>

                  {/* Dates list (3-column, including Ultima Atualizacao) */}
                  <div className="grid grid-cols-3 gap-2 text-[10px] py-1 text-slate-500 font-sans border-t border-b border-slate-100">
                    <div>
                      <span className="block text-[8px] font-black uppercase text-slate-400">Publicação</span>
                      <p className="font-semibold text-slate-700 mt-0.5 truncate">{formatPncpDateString(item.dataPublicacaoPncp || item.dataEnvio)}</p>
                    </div>
                    <div>
                      <span className="block text-[8px] font-black uppercase text-slate-400">Sessão Pública</span>
                      <p className="font-black text-indigo-700 mt-0.5 truncate">{formatPncpDateString(item.dataAberturaProposta || item.dataAberturaSessaoPublica)}</p>
                    </div>
                    <div>
                      <span className="block text-[8px] font-black uppercase text-slate-400">Atualização</span>
                      <p className="font-bold text-emerald-700 mt-0.5 truncate">{formatPncpDateString(item.dataAtualizacao || item.dataAtualizacaoGlobal || item.dataPublicacaoPncp)}</p>
                    </div>
                  </div>
                </div>

                {/* Footer and trigger values */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-400">Valor Máximo Estimado</label>
                    <span className="text-sm font-black text-slate-900 block mt-0.5">
                      {formatValue(item.valorTotalEstimado || item.valorEstimado)}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {/* View external link */}
                    <a
                      href={`https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj || "000000"}/${item.anoCompra || "2024"}/${item.sequencialCompra || item.sequencialContratacao || "1"}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                      title="Ver Link do Edital Oficial no PNCP"
                    >
                      <ExternalLink className="w-4 h-4 text-slate-500" />
                    </a>

                    {/* Import Button with loader state triggers */}
                    {alreadyImported ? (
                      <button
                        disabled
                        className="px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-not-allowed"
                      >
                        <Check className="w-4 h-4" /> Importado
                      </button>
                    ) : (
                      <button
                        disabled={isImportingThis}
                        onClick={() => handleImportTender(item.numeroControlePNCP)}
                        className={`px-4 py-2.5 text-white rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-2 cursor-pointer transition ${
                          isImportingThis 
                            ? "bg-amber-500 hover:bg-amber-600 animate-pulse text-slate-950" 
                            : "bg-blue-600 hover:bg-blue-700 hover:shadow shadow-blue-500/10"
                        }`}
                      >
                        {isImportingThis ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Baixando Tabelas...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" /> Importar para o Painel
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination controls */}
      {!isLoading && results.length > 0 && (
        <div className="flex items-center justify-between bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs text-xs font-sans">
          <button
            disabled={currentPage <= 1}
            onClick={() => fetchPncpTenders(currentPage - 1)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1 font-bold text-slate-700"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>

          <span className="text-slate-500 font-medium">
            Página <strong className="text-slate-900">{currentPage}</strong> de <strong className="text-slate-900">{totalPages}</strong>
          </span>

          <button
            disabled={currentPage >= totalPages}
            onClick={() => fetchPncpTenders(currentPage + 1)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1 font-bold text-slate-700"
          >
            Próxima <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
