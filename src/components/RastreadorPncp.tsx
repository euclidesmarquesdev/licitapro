import React, { useState } from "react";
import { Licitacao } from "../types";
import { ESTADOS_BRASIL } from "../data";
import { getClientAuthToken } from "../firebase";
import { 
  Search, ShieldCheck, Download, ExternalLink, Calendar, 
  MapPin, RefreshCw, ChevronLeft, ChevronRight, Check,
  AlertTriangle, Info, FileText, Sparkles, Building2,
  X, FileSpreadsheet, Eye
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
  onSearch: (params: {
    searchTerm: string;
    uf: string;
    modality: string;
    dateRange: string;
    valorMinimo: string;
    valorMaximo: string;
    page?: number;
  }) => Promise<void>;
  valorMinimo: string;
  setValorMinimo: (val: string) => void;
  valorMaximo: string;
  setValorMaximo: (val: string) => void;
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
  setActiveMainView,
  onSearch,
  valorMinimo,
  setValorMinimo,
  valorMaximo,
  setValorMaximo
}: RastreadorPncpProps) {
  const [errorMsg, setErrorMsg] = useState("");
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  const modalitiesList = [
    { value: "Todos", label: "Todas" },
    { value: "6", label: "Pregão" },
    { value: "8", label: "Dispensa de Licitação" },
    { value: "4", label: "Concorrência" },
    { value: "9", label: "Inexigibilidade" },
    { value: "1", label: "Leilão" },
    { value: "2", label: "Diálogo Competitivo" }
  ];

  const quickKeywords = [
    { label: "Tecnologia", query: "tecnologia" },
    { label: "Computadores", query: "computador" },
    { label: "Engenharia", query: "engenharia" },
    { label: "Limpeza", query: "limpeza" },
    { label: "Merenda", query: "merenda" },
    { label: "Saúde", query: "saude" },
    { label: "Medicamentos", query: "medicamento" }
  ];

  // ✅ REMOVIDO useEffect - A BUSCA INICIAL É CONTROLADA PELO APP

  const handleSearch = () => {
    onSearch({
      searchTerm: searchTerm,
      uf: selectedUf,
      modality: selectedModality,
      dateRange: dateRange,
      valorMinimo: valorMinimo,
      valorMaximo: valorMaximo,
      page: 1
    });
  };

  const handleKeywordClick = (word: string) => {
    setSearchTerm(word);
    onSearch({
      searchTerm: word,
      uf: selectedUf,
      modality: selectedModality,
      dateRange: dateRange,
      valorMinimo: valorMinimo,
      valorMaximo: valorMaximo,
      page: 1
    });
  };

  const handleKeyboardSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedUf("Todos");
    setSelectedModality("Todos");
    setDateRange("15");
    setValorMinimo("");
    setValorMaximo("");
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    onSearch({
      searchTerm: searchTerm,
      uf: selectedUf,
      modality: selectedModality,
      dateRange: dateRange,
      valorMinimo: valorMinimo,
      valorMaximo: valorMaximo,
      page: newPage
    });
  };

  const handleImportTender = async (pncpId: string) => {
    if (importingId) return;
    setImportingId(pncpId);
    setErrorMsg("");
    setImportSuccessMessage(null);

    try {
      const token = await getClientAuthToken();
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
          throw new Error(`Erro do servidor de importação (Status ${response.status}).`);
        } else {
          throw new Error("Resposta incompreensível do servidor de importação.");
        }
      }

      if (!response.ok) {
        throw new Error(body.error || "Erro de extração de tabelas no portal PNCP.");
      }

      if (body.success && body.data) {
        const d = body.data;

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

        const rawCompetitors = d.competitorsEstimated || ["Distribuidor Especializado S.A.", "GovTech Soluções de Escopo"];
        const finalCompetitors = rawCompetitors.map((name: string, index: number) => ({
          id: `cp-track-${index}-${Date.now()}`,
          name,
          bidValue: 0,
          status: "perdeu" as const
        }));

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

        onOpenLicitacao(newLicitacao.id);
        if (setActiveMainView) {
          setActiveMainView("editais");
        }

        setImportSuccessMessage(
          `🚀 Sucesso absoluto! O edital "${d.edital}" do órgão "${d.orgao}" foi importado com todos os seus ${rawItems.length} lotes/itens oficiais.`
        );

        window.scrollTo({ top: 300, behavior: "smooth" });
      }
    } catch (err: any) {
      console.error("[PNCP Import Button Failed]:", err);
      setErrorMsg(`Falha na extração de dados do edital: ${err.message}`);
    } finally {
      setImportingId(null);
    }
  };

  // Funções de formatação (mantidas iguais)
  const formatLocation = (item: any): string => {
    const uf = item.unidadeOrgao?.ufSigla || item.ufSigla || item.orgaoEntidade?.ufSigla || "BR";
    const mun = item.unidadeOrgao?.municipioNome || item.orgaoEntidade?.municipioNome || item.municipioNome || "";
    
    if (mun) {
      const cleanMun = mun.toLowerCase().replace(/(^\w{1})|(\s+\w{1})/g, (letter: string) => letter.toUpperCase());
      return `${cleanMun} - ${uf}`;
    }
    return `Estado: ${uf}`;
  };

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
      {/* Header */}
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
            Navegue por toda a base de dados oficial do Brasil no <strong>Portal Nacional de Contratações Públicas</strong>.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Palavra-Chave</label>
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Ex: tecnologia, software, asfalto..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyboardSearch}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-450 hover:text-red-500 hover:bg-slate-150 rounded-full transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">UF</label>
            <select
              className="w-full text-xs font-bold text-gray-700 bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer"
              value={selectedUf}
              onChange={(e) => setSelectedUf(e.target.value)}
            >
              <option value="Todos">Todos</option>
              {ESTADOS_BRASIL.map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Modalidade</label>
            <select
              className="w-full text-xs font-bold text-gray-700 bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer"
              value={selectedModality}
              onChange={(e) => setSelectedModality(e.target.value)}
            >
              {modalitiesList.map(item => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Valor (R$)</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Mínimo"
                min="0"
                className="w-1/2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
                value={valorMinimo}
                onChange={(e) => setValorMinimo(e.target.value)}
              />
              <input
                type="number"
                placeholder="Máximo"
                min="0"
                className="w-1/2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
                value={valorMaximo}
                onChange={(e) => setValorMaximo(e.target.value)}
              />
            </div>
          </div>

          <div className="lg:col-span-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Período</label>
            <select
              className="w-full text-xs font-bold text-gray-700 bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="15">15 dias</option>
              <option value="30">30 dias</option>
              <option value="60">60 dias</option>
              <option value="90">90 dias</option>
              <option value="180">180 dias</option>
            </select>
          </div>

          <div className="lg:col-span-1 flex items-end gap-2">
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="flex-1 p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 transition flex items-center justify-center cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={handleClearFilters}
              className="p-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-bold block pr-1 uppercase text-[10px] tracking-wider">Atalhos:</span>
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

        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-150">
          <input
            type="checkbox"
            id="ai-enhance-tracker"
            className="w-4.5 h-4.5 text-blue-600 border-slate-300 rounded cursor-pointer"
            checked={runAIEnhanceForImport}
            onChange={(e) => setRunAIEnhanceForImport(e.target.checked)}
          />
          <label htmlFor="ai-enhance-tracker" className="text-xs text-slate-700 leading-relaxed cursor-pointer font-medium">
            🧬 <strong className="text-indigo-950">Enriquecimento IA:</strong> Analisar edital com Gemini
          </label>
        </div>
      </div>

      {/* Messages */}
      {importSuccessMessage && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 flex gap-3 shadow-xs">
          <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
          <p className="text-xs font-bold leading-normal">{importSuccessMessage}</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-950 flex gap-3 text-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <strong className="block font-bold">Erro:</strong>
            <p className="mt-0.5 text-slate-600">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Info className="w-4.5 h-4.5 text-blue-500" />
          <span>Total: <strong className="text-slate-800">{totalRecords}</strong> contratações</span>
        </div>
        <a
          href="https://pncp.gov.br/app/editais"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-slate-950 text-white rounded-xl font-extrabold flex items-center gap-1.5 hover:bg-slate-850 transition text-[10px]"
        >
          <ExternalLink className="w-3.5 h-3.5 text-blue-400" /> Portal PNCP
        </a>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((it) => (
            <div key={it} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/4"></div>
              <div className="h-5 bg-slate-200 rounded w-4/5"></div>
              <div className="h-20 bg-slate-100 rounded"></div>
              <div className="h-10 bg-blue-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white border border-slate-200/80 p-16 rounded-3xl text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base">Nenhum resultado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">Ajuste os filtros e tente novamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {results.map((item) => {
            const alreadyImported = licitacoes.some(l => l.idContratacaoPncp === item.numeroControlePNCP);
            const isImportingThis = importingId === item.numeroControlePNCP;
            const importedLicitacao = licitacoes.find(l => l.idContratacaoPncp === item.numeroControlePNCP);

            return (
              <div 
                key={item.numeroControlePNCP} 
                className={`bg-white border rounded-3xl p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition duration-200 ${
                  alreadyImported ? "bg-emerald-50/30 border-emerald-300" : "border-slate-200/80"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full font-bold text-[10px] uppercase">
                      {item.modalidadeNome || "Licitação"}
                    </span>
                    <span className={`px-2.5 py-1 border rounded-full font-bold text-[10px] uppercase ${getCategoryTheme(getCategoryForPncpItem(item))}`}>
                      {getCategoryForPncpItem(item)}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-slate-900 text-sm md:text-base leading-snug">
                    {formatHumanizedTitle(item)}
                  </h3>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 bg-slate-50 rounded-xl p-2 border border-slate-150">
                    <span className="truncate">ID: {item.numeroControlePNCP}</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(item.numeroControlePNCP || "");
                        alert("ID copiado!");
                      }} 
                      className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                    >
                      Copiar
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-red-500" />
                    <span className="text-xs font-bold text-slate-700">{formatLocation(item)}</span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2">
                    {item.objetoCompra || item.objeto || "Sem descrição"}
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-[10px] py-1 text-slate-500 border-t border-slate-100">
                    <div>
                      <span className="block text-[8px] font-black uppercase text-slate-400">Publicação</span>
                      <p className="font-semibold text-slate-700">{formatPncpDateString(item.dataPublicacaoPncp || item.dataEnvio)}</p>
                    </div>
                    <div>
                      <span className="block text-[8px] font-black uppercase text-slate-400">Sessão</span>
                      <p className="font-black text-indigo-700">{formatPncpDateString(item.dataAberturaProposta)}</p>
                    </div>
                    <div>
                      <span className="block text-[8px] font-black uppercase text-slate-400">Atualização</span>
                      <p className="font-bold text-emerald-700">{formatPncpDateString(item.dataAtualizacao)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-400">Valor</label>
                    <span className="text-sm font-black text-slate-900 block mt-0.5">
                      {formatValue(item.valorTotalEstimado || item.valorEstimado)}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={`https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj || "000000"}/${item.anoCompra || "2024"}/${item.sequencialCompra || item.sequencialContratacao || "1"}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                    >
                      <ExternalLink className="w-4 h-4 text-slate-500" />
                    </a>

                    {alreadyImported && importedLicitacao ? (
                      <button
                        onClick={() => {
                          onOpenLicitacao(importedLicitacao.id);
                          if (setActiveMainView) {
                            setActiveMainView("editais");
                          }
                        }}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-2 cursor-pointer transition"
                      >
                        <Eye className="w-4 h-4" />
                        Ver no Painel
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
                            Baixando...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" /> Importar
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

      {/* Pagination */}
      {!isLoading && results.length > 0 && (
        <div className="flex items-center justify-between bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs text-xs font-sans">
          <button
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 border border-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1 font-bold text-slate-700"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <span className="text-slate-500 font-medium">
            Página <strong className="text-slate-900">{currentPage}</strong> de <strong className="text-slate-900">{totalPages}</strong>
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 border border-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1 font-bold text-slate-700"
          >
            Próxima <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}