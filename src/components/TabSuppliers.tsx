import React, { useState } from "react";
import { Licitacao, SupplierContact } from "../types";
import { MOCK_CATALOG_SUPPLIERS } from "../data";
import { 
  Users, Plus, Mail, Phone, Tag, Calculator, Info, Trash2, Check, CheckSquare,
  Search, ChevronLeft, ChevronRight, Sparkles
} from "lucide-react";

interface TabProps {
  licitacao: Licitacao;
  activeSuppliers: SupplierContact[];
  formatCurrency: (val: number) => string;
  handleAddSupplier: (name: string, product: string, contact: string) => void;
  getCompatibleSuppliers: () => any[];
  handleImportAllCompatible: (matching: any[]) => void;
  handleImportCatalogSupplier: (sup: any) => void;
  handleCreateCustomItem: (desc: string, qty: number, val: number) => void;
  handleDeleteItemPncp: (numero: string) => void;
  handleUpdateSupplierItemPrice: (supplierId: string, itemNumero: string, price: number) => void;
  handleUpdateSupplierStatus: (id: string, status: SupplierContact["status"]) => void;
  setDeleteConfirm: (v: any) => void;
}

export default function TabSuppliers({
  licitacao,
  activeSuppliers,
  formatCurrency,
  handleAddSupplier,
  getCompatibleSuppliers,
  handleImportAllCompatible,
  handleImportCatalogSupplier,
  handleCreateCustomItem,
  handleDeleteItemPncp,
  handleUpdateSupplierItemPrice,
  handleUpdateSupplierStatus,
  setDeleteConfirm
}: TabProps) {
  // Local form inputs
  const [supName, setSupName] = useState("");
  const [supProduct, setSupProduct] = useState("");
  const [supContact, setSupContact] = useState("");

  const [showAllCatalog, setShowAllCatalog] = useState(false);

  // Local state for catalog search and pagination
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogPage, setCatalogPage] = useState(1);
  const catalogItemsPerPage = 3;

  const [customItemDesc, setCustomItemDesc] = useState("");
  const [customItemQty, setCustomItemQty] = useState(1);
  const [customItemValue, setCustomItemValue] = useState(0);

  // Pagination for the price matrix table
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const onSubmitSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;
    handleAddSupplier(supName, supProduct, supContact);
    setSupName("");
    setSupProduct("");
    setSupContact("");
  };

  const onSubmitCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemDesc.trim()) return;
    handleCreateCustomItem(customItemDesc, customItemQty, customItemValue);
    setCustomItemDesc("");
    setCustomItemQty(1);
    setCustomItemValue(0);
  };

  // Text pool to match and rank suppliers by affinity overlap
  const textPool = [
    licitacao.objeto || "",
    licitacao.edital || "",
    licitacao.categoria || "",
    ...(licitacao.itensPncp || []).map(item => item.descricao || "")
  ].join(" ").toLowerCase();

  const getSupplierAffinity = (sup: any) => {
    let score = 0;
    if (sup.categoryKeywords && Array.isArray(sup.categoryKeywords)) {
      sup.categoryKeywords.forEach((kw: string) => {
        const val = kw.toLowerCase().trim();
        if (val && textPool.includes(val)) {
          score += 1;
        }
      });
    }
    if (sup.name && textPool.includes(sup.name.toLowerCase())) score += 3;
    if (sup.product && textPool.includes(sup.product.toLowerCase())) score += 3;
    return score;
  };

  const compSups = getCompatibleSuppliers().map(sup => ({
    ...sup,
    affinityScore: getSupplierAffinity(sup)
  })).sort((a, b) => b.affinityScore - a.affinityScore);

  const displaySups = showAllCatalog 
    ? MOCK_CATALOG_SUPPLIERS.map(sup => ({
        ...sup,
        affinityScore: getSupplierAffinity(sup)
      })).sort((a, b) => b.affinityScore - a.affinityScore)
    : compSups;

  // Search filter
  const filteredCatalogSups = displaySups.filter(sup => {
    if (!catalogSearch.trim()) return true;
    const query = catalogSearch.toLowerCase();
    return (
      sup.name.toLowerCase().includes(query) ||
      sup.product.toLowerCase().includes(query) ||
      sup.contact.toLowerCase().includes(query) ||
      (sup.phone && sup.phone.includes(query)) ||
      (sup.categoryKeywords && sup.categoryKeywords.some(kw => kw.toLowerCase().includes(query)))
    );
  });

  const totalCatalogPages = Math.ceil(filteredCatalogSups.length / catalogItemsPerPage);
  const safeCatalogPage = Math.min(catalogPage, Math.max(1, totalCatalogPages));
  const paginatedCatalogSups = filteredCatalogSups.slice(
    (safeCatalogPage - 1) * catalogItemsPerPage,
    safeCatalogPage * catalogItemsPerPage
  );

  // Pagination computational helpers
  const matrixItems = licitacao.itensPncp || [];
  const matrixTotalPages = Math.ceil(matrixItems.length / itemsPerPage);
  const safeCurrentPage = Math.min(currentPage, Math.max(1, matrixTotalPages));
  const paginatedMatrixItems = matrixItems.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

  // Calculates row real average
  const getClippedSuppliers = (value: number) => value > 0;

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Central de Cotações & Matriz de Preços
          </h3>
          <p className="text-xs text-gray-500">Mapeie custos de cada item por fornecedor. Registre valores reais para calcular as médias reais e identificar a proposta mais competitiva.</p>
        </div>
        <div className="bg-white border border-gray-150 rounded-xl p-3 shadow-2xs flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Menor Custo Consolidado:</div>
            <div className="font-extrabold text-emerald-600 text-base">
              {(() => {
                const pricedSuppliers = activeSuppliers.filter(s => s.status === "cotado" && s.value > 0);
                if (pricedSuppliers.length === 0) return formatCurrency(0);
                const minVal = Math.min(...pricedSuppliers.map(s => s.value));
                return formatCurrency(minVal);
              })()}
            </div>
          </div>
          <div className="h-8 w-px bg-gray-200"></div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Média dos Fornecedores:</div>
            <div className="font-bold text-indigo-600 text-sm">
              {(() => {
                const pricedSuppliers = activeSuppliers.filter(s => s.value > 0);
                if (pricedSuppliers.length === 0) return formatCurrency(0);
                const avg = pricedSuppliers.reduce((acc, curr) => acc + curr.value, 0) / pricedSuppliers.length;
                return formatCurrency(avg);
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Form to add suppliers manually */}
      <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl mb-6">
        <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-indigo-600" />
          Cadastrar Novo Fornecedor Ofertante
        </h4>
        <form onSubmit={onSubmitSupplier} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Empresa Fornecedora</label>
            <input
              type="text"
              placeholder="Ex: Dell Computadores"
              className="w-full text-xs bg-white border border-gray-200 rounded p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800"
              value={supName}
              onChange={(e) => setSupName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Produto Principal</label>
            <input
              type="text"
              placeholder="Ex: Notebook Latitude"
              className="w-full text-xs bg-white border border-gray-200 rounded p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
              value={supProduct}
              onChange={(e) => setSupProduct(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Contato (E-mail/Telefone)</label>
            <input
              type="text"
              placeholder="Ex: comercial@dell.com"
              className="w-full text-xs bg-white border border-gray-200 rounded p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
              value={supContact}
              onChange={(e) => setSupContact(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
              disabled={!supName.trim()}
            >
              <Plus className="w-4 h-4" />
              Incluir Fornecedor
            </button>
          </div>
        </form>
      </div>

      {/* Suggested Suppliers Catalog Panel */}
      <div className="mb-6 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl shadow-2xs">
        <div className="flex flex-col gap-4 mb-4 pb-3 border-b border-indigo-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <div className="p-1 px-2.5 bg-indigo-650 text-white rounded-lg font-bold text-[9.5px] flex items-center gap-1 uppercase tracking-wider shadow-sm">
                👑 Sugestões Inteligentes ({catalogSearch ? filteredCatalogSups.length : compSups.length})
              </div>
              <span className="text-xs font-bold text-indigo-950">
                {compSups.length > 0 
                  ? `Recomendamos parceiros com mais afinidade para esta licitação!` 
                  : "Nenhuma empresa compatível por padrão. Use a busca ou o catálogo geral abaixo."}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2.5 font-sans">
              {compSups.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleImportAllCompatible(compSups)}
                  className="bg-white hover:bg-slate-50 text-indigo-750 border border-indigo-200 px-3 py-1.5 rounded-lg text-[10.5px] font-bold shadow-2xs transition duration-150 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Vincular Todos Compatíveis
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowAllCatalog(!showAllCatalog);
                  setCatalogPage(1);
                  setCatalogSearch("");
                }}
                className="bg-indigo-100 hover:bg-indigo-200 text-indigo-900 px-3 py-1.5 rounded-lg text-[10.5px] font-black tracking-wide transition duration-150 cursor-pointer"
              >
                {showAllCatalog ? "Ver Compatíveis" : "Ver Catálogo Completo"}
              </button>
            </div>
          </div>

          {/* Search bar & info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 p-2 rounded-xl border border-indigo-100/50">
            <div className="relative w-full sm:max-w-xs5">
              <Search className="w-3.5 h-3.5 text-indigo-500 absolute left-3 top-2.5 shrink-0" />
              <input
                type="text"
                placeholder="Pesquisar fornecedor ou produto..."
                className="pl-8.5 pr-3 py-1.5 w-full text-xs bg-white border border-indigo-150 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-sans text-slate-800 placeholder:text-slate-400"
                value={catalogSearch}
                onChange={(e) => {
                  setCatalogSearch(e.target.value);
                  setCatalogPage(1);
                }}
              />
            </div>
            <div className="text-[10px] text-indigo-900 font-bold font-sans">
              {showAllCatalog ? "🔍 Buscando no Catálogo Inteiro" : "⚡ Sugestões Ordenadas por Afinidade"}
            </div>
          </div>
        </div>

        {paginatedCatalogSups.length === 0 ? (
          <div className="text-center py-7 bg-white rounded-xl border border-dashed border-indigo-100 p-3">
            <p className="text-[11px] text-gray-500 font-bold">Nenhum fornecedor encontrado para a combinação selecionada.</p>
            <p className="text-[10px] text-gray-400 mt-0.5 leading-normal">
              Tente reajustar a sua pesquisa ou clique em <strong className="text-indigo-650">"Ver Catálogo Completo"</strong> acima para alternar as origens de dados.
            </p>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {paginatedCatalogSups.map((sup, idx) => {
                const supplierIndex = activeSuppliers.findIndex(s => s.name.toLowerCase() === sup.name.toLowerCase());
                const isAdded = supplierIndex !== -1;
                const matchesCount = sup.affinityScore || 0;

                return (
                  <div key={idx} className="bg-white p-3.5 rounded-xl border border-indigo-100/80 hover:border-indigo-300 transition shadow-2xs flex flex-col justify-between gap-2.5 font-sans relative">
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-1 flex-wrap">
                        <h4 className="text-xs font-black text-slate-800 truncate block max-w-[70%]" title={sup.name}>
                          {sup.name}
                        </h4>
                        <div className="flex items-center gap-1 shrink-0">
                          {matchesCount > 0 && (
                            <span className="text-[8.5px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 px-1 py-0.2 rounded border border-amber-200">
                              ⭐ Afinidade
                            </span>
                          )}
                          <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded ${
                            compSups.some(cs => cs.name === sup.name)
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-slate-100 text-slate-500"
                          }`}>
                            {compSups.some(cs => cs.name === sup.name) ? "Compatível" : "Catálogo"}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-tight">
                        <strong>Produto padrão:</strong> {sup.product}
                      </p>
                      
                      {matchesCount > 0 && (
                        <div className="text-[9.5px] bg-indigo-50/50 text-indigo-900 p-1 rounded border border-indigo-100/30 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span>Excelente afinidade com {licitacao.categoria || "o edital"}</span>
                        </div>
                      )}

                      <div className="space-y-0.5 mt-1 border-t border-slate-100 pt-1.5">
                        <div className="text-[10px] text-slate-600 flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-indigo-400 shrink-0" />
                          <span className="truncate">{sup.contact}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 flex items-center gap-1.5 font-sans">
                          <Phone className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span>{sup.phone || "(11) 4004-9123"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 shrink-0">
                      <span className="text-[10px] font-extrabold text-slate-500">
                        Custo Ref: {formatCurrency(sup.value)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleImportCatalogSupplier(sup)}
                        className={`py-1.5 px-3 rounded-lg text-[10px] font-bold border transition duration-150 flex items-center gap-1 cursor-pointer ${
                          isAdded
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white border-transparent"
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            Selecionado {supplierIndex + 1}
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            Selecionar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Catalog suggestions pagination footer */}
            {totalCatalogPages > 1 && (
              <div className="flex items-center justify-between border-t border-indigo-100/50 pt-3 mt-3.5 text-xs text-indigo-950 font-sans">
                <div className="text-slate-500 italic text-[10px]">
                  Exibindo sugestões <strong>{((safeCatalogPage - 1) * catalogItemsPerPage) + 1}</strong> a <strong>{Math.min(safeCatalogPage * catalogItemsPerPage, filteredCatalogSups.length)}</strong> de <strong>{filteredCatalogSups.length}</strong> cadastradas
                </div>
                <div className="flex items-center gap-1.5 font-sans">
                  <button
                    type="button"
                    disabled={safeCatalogPage === 1}
                    onClick={() => setCatalogPage(prev => Math.max(prev - 1, 1))}
                    className="flex items-center justify-center p-1.5 bg-white border border-indigo-150 rounded-lg text-indigo-700 disabled:opacity-50 hover:bg-indigo-50/50 transition cursor-pointer"
                    title="Anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-bold text-[10px] text-slate-700 px-2.5 py-1 bg-white border border-indigo-100 rounded-lg">
                    {safeCatalogPage} de {totalCatalogPages}
                  </span>
                  <button
                    type="button"
                    disabled={safeCatalogPage === totalCatalogPages}
                    onClick={() => setCatalogPage(prev => Math.min(prev + 1, totalCatalogPages))}
                    className="flex items-center justify-center p-1.5 bg-white border border-indigo-150 rounded-lg text-indigo-700 disabled:opacity-50 hover:bg-indigo-50/50 transition cursor-pointer"
                    title="Próxima"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Custom / Manual Bidding Item Form */}
      <div className="p-4 border border-dashed border-slate-200 rounded-2xl bg-white mb-6">
        <details className="group">
          <summary className="flex items-center justify-between font-bold text-slate-700 text-xs uppercase cursor-pointer select-none">
            <span className="flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-emerald-500" />
              Cadastrar Lote / Item Manual p/ Cotação ({licitacao.itensPncp?.length || 0})
            </span>
            <span className="text-indigo-600 group-open:hidden">+ Abrir Formulário</span>
            <span className="text-indigo-600 hidden group-open:block">- Ocultar Formulário</span>
          </summary>
          
          <form onSubmit={onSubmitCustomItem} className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 border-t border-slate-100 pt-4">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Descrição do Item / Lote</label>
              <input
                type="text"
                placeholder="Ex: Lote 1 - Licenciamento de software antivírus corporativo"
                className="w-full text-xs bg-slate-50 border border-gray-200 rounded p-2 outline-none focus:bg-white text-slate-850 font-medium"
                value={customItemDesc}
                onChange={(e) => setCustomItemDesc(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Quantidade</label>
              <input
                type="number"
                min="1"
                placeholder="Ex: 50"
                className="w-full text-xs bg-slate-50 border border-gray-200 rounded p-2 outline-none focus:bg-white text-slate-850"
                value={customItemQty || ""}
                onChange={(e) => setCustomItemQty(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Valor Unitário Ref. (R$)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 120.00"
                  className="w-full text-xs bg-slate-50 border border-gray-200 rounded p-2 outline-none focus:bg-white text-slate-855 font-bold"
                  value={customItemValue || ""}
                  onChange={(e) => setCustomItemValue(Number(e.target.value))}
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded shadow-sm transition cursor-pointer shrink-0"
                >
                  Salvar Item
                </button>
              </div>
            </div>
          </form>
        </details>
      </div>

      {/* Mobile-Friendly Notice for Matrix */}
      <div className="lg:hidden p-4 bg-indigo-50 border border-indigo-150 rounded-2xl mb-6 font-sans text-xs text-indigo-950 leading-relaxed shadow-sm">
        <div className="flex items-center gap-2 font-bold text-indigo-900 mb-1.5 uppercase tracking-wide">
          <Calculator className="w-4 h-4 text-indigo-600 shrink-0" />
          Central Comparativa Sincronizada
        </div>
        No celular, a matriz de comparação tabular foi ocultada para conforto visual. Use os cartões do <strong className="text-indigo-900">Dossiê de Detalhes dos Fornecedores</strong> logo abaixo para visualizar, auditar e preencher os status e valores de cotação tranquilamente!
      </div>

      {/* Interactive Pricing Grid Matrix */}
      <div className="hidden lg:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs mb-8">
        <div className="p-4 bg-slate-800 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-sm flex items-center gap-1.5 tracking-tight font-sans">
              <Calculator className="w-4 h-4 text-emerald-400" />
              MATRIZ DINÂMICA DE PREÇOS (ITENS X FORNECEDORES)
            </h3>
            <p className="text-[11px] text-slate-350">Digite o valor unitário fornecido por cada empresa em suas respectivas colunas para recalcular em tempo real.</p>
          </div>
          <span className="text-[10px] bg-slate-700 px-2.5 py-1 rounded-full font-bold text-emerald-400 uppercase tracking-wider">
            {activeSuppliers.length} Fornecedores Selecionados
          </span>
        </div>

        {!licitacao.itensPncp || licitacao.itensPncp.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/50">
            <Info className="w-8 h-8 text-slate-405 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-705">Sem itens disponíveis para cotação na matriz.</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
              Use a aba "Dados Principais" para colar o texto do PNCP ou use o botão <strong className="text-emerald-600">"Cadastrar Lote / Item Manual"</strong> logo acima para inserir itens.
            </p>
          </div>
        ) : activeSuppliers.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/50">
            <Users className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-705">Adicione ao menos um fornecedor para expor a matriz comparativa.</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Você pode usar o formulário superior "Incluir Fornecedor" ou selecionar parceiros diretamente do rodapé de recomendações.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[800px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="p-3 w-12 text-center text-slate-800">Nº</th>
                  <th className="p-3 min-w-[200px] text-slate-800">Descrição do Lote / Item</th>
                  <th className="p-3 w-16 text-center text-slate-800">Qtd</th>
                  <th className="p-3 w-32 text-right text-slate-800">Referência Gov</th>
                  
                  {/* Columns for each added supplier */}
                  {activeSuppliers.map(sup => (
                    <th key={sup.id} className="p-3 text-center border-l border-slate-200 bg-slate-50/50 min-w-[150px] relative group">
                      <div className="font-bold text-slate-900 truncate max-w-[140px] mx-auto block" title={sup.name}>
                        {sup.name}
                      </div>
                      <div className="text-[9px] text-indigo-600/80 font-medium truncate max-w-[140px] mx-auto font-sans">
                        {sup.product || "Sem prod."}
                      </div>
                    </th>
                  ))}

                  <th className="p-3 w-32 text-right border-l border-indigo-100 bg-indigo-50/30 text-indigo-900">Preço Médio (Real)</th>
                  <th className="p-3 w-40 text-right border-l border-emerald-100 bg-emerald-50/20 text-emerald-900">Melhor Lance (Vencedor)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedMatrixItems.map((it) => {
                  // Find any best supplier for this item
                  let bestPrice = Infinity;
                  let bestSupplierName = "";
                  activeSuppliers.forEach(s => {
                    const p = s.itemPrices?.[it.numero] || 0;
                    if (p > 0 && p < bestPrice) {
                      bestPrice = p;
                      bestSupplierName = s.name;
                    }
                  });

                  // Calculates row real average
                  let sum = 0;
                  let count = 0;
                  activeSuppliers.forEach(s => {
                    const p = s.itemPrices?.[it.numero] || 0;
                    if (p > 0) {
                      sum += p;
                      count++;
                    }
                  });
                  const itemRealAverage = count > 0 ? sum / count : 0;

                  return (
                    <tr key={it.numero} className="hover:bg-slate-50/60 transition duration-100">
                      <td className="p-3 text-center font-extrabold text-slate-500 bg-slate-50/30">{it.numero}</td>
                      <td className="p-3 font-medium text-slate-800">
                        <div className="line-clamp-2 leading-snug" title={it.descricao}>
                          {it.descricao}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => handleDeleteItemPncp(it.numero)}
                            className="text-[9px] text-red-500 hover:text-red-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                            title="Excluir este item da licitação"
                          >
                            <Trash2 className="w-2.5 h-2.5" /> Excluir Item
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-center font-bold text-slate-705">{it.quantidade}</td>
                      <td className="p-3 text-right text-slate-600 font-mono">
                        <div>{formatCurrency(it.valorUnitario)}/un</div>
                        <div className="text-[10px] text-slate-450">Total: {formatCurrency(it.valorTotal || (it.quantidade * it.valorUnitario) || 0)}</div>
                      </td>

                      {/* Quoted units input row for each supplier */}
                      {activeSuppliers.map(sup => {
                        const unitPriceInput = sup.itemPrices?.[it.numero] || "";
                        const supplierTotalForItem = (Number(unitPriceInput) || 0) * (it.quantidade || 1);
                        const isCheapestOnRow = bestPrice !== Infinity && Number(unitPriceInput) === bestPrice;

                        return (
                          <td key={sup.id} className={`p-2 border-l border-slate-200 text-center ${isCheapestOnRow ? "bg-emerald-50/40" : ""}`}>
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-[10px] font-bold text-slate-400 font-sans">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0,00"
                                className="w-20 text-[11px] font-mono font-bold bg-white border border-gray-250 rounded p-1 text-center text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                value={unitPriceInput}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? 0 : Number(e.target.value);
                                  handleUpdateSupplierItemPrice(sup.id, it.numero, val);
                                }}
                              />
                            </div>
                            <div className="text-[9px] text-slate-450 mt-1 font-mono">
                              Total: <strong className="text-slate-700">{formatCurrency(supplierTotalForItem)}</strong>
                            </div>
                          </td>
                        );
                      })}

                      {/* Matrix Row Calculations */}
                      <td className="p-3 text-right border-l border-indigo-100 bg-indigo-50/25 font-mono">
                        {itemRealAverage > 0 ? (
                          <>
                            <div className="font-extrabold text-indigo-700">{formatCurrency(itemRealAverage)}</div>
                            <div className="text-[9px] text-slate-400 font-sans">Média Real</div>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold italic">Sem cotações</span>
                        )}
                      </td>

                      <td className="p-3 text-right border-l border-emerald-100 bg-emerald-50/15 font-mono">
                        {bestPrice !== Infinity ? (
                          <>
                            <div className="font-extrabold text-emerald-600 flex items-center justify-end gap-1">
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              {formatCurrency(bestPrice)}
                            </div>
                            <div className="text-[9px] text-slate-500 font-sans truncate max-w-[130px] ml-auto" title={bestSupplierName}>
                              Oferta de: <strong className="font-bold">{bestSupplierName}</strong>
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold italic">Sem cotações</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Summary Totals Row at the bottom of the table */}
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-800">
                  <td colSpan={3} className="p-4 text-right uppercase tracking-wider text-[10px] font-black text-slate-605">
                    Custo Estimado Inicial Gov:
                  </td>
                  <td className="p-4 text-right font-mono text-slate-700">
                    {formatCurrency(
                      (licitacao.itensPncp || []).reduce((acc, curr) => acc + (curr.valorTotal || (curr.quantidade * curr.valorUnitario) || 0), 0)
                    )}
                  </td>

                  {/* Sum columns for each supplier */}
                  {activeSuppliers.map(sup => {
                    const totalVal = (licitacao.itensPncp || []).reduce((acc, curr) => {
                      const p = sup.itemPrices?.[curr.numero] || 0;
                      return acc + (p * (curr.quantidade || 1));
                    }, 0);

                    return (
                      <td key={sup.id} className="p-4 text-center border-l border-slate-300 bg-slate-50">
                        <div className="text-[10px] text-slate-600 font-black uppercase">TOTAL COTADO:</div>
                        <div className="text-sm font-mono text-indigo-700 mt-0.5">{formatCurrency(totalVal)}</div>
                      </td>
                    );
                  })}

                  <td colSpan={2} className="bg-slate-200/50 p-4 font-mono text-slate-600 text-[10.5px]">
                    * Valores finais atualizados dinamicamente
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Matrix Pagination Controls */}
        {matrixTotalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 p-3 bg-slate-50 text-slate-700 text-xs font-sans">
            <div className="text-slate-500">
              Exibindo itens <strong>{((safeCurrentPage - 1) * itemsPerPage) + 1}</strong> a <strong>{Math.min(safeCurrentPage * itemsPerPage, matrixItems.length)}</strong> de <strong>{matrixItems.length}</strong>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
              >
                Anterior
              </button>
              <span className="font-bold text-[11px] text-slate-800">Página {safeCurrentPage} de {matrixTotalPages}</span>
              <button
                type="button"
                disabled={safeCurrentPage === matrixTotalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, matrixTotalPages))}
                className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Supplier Cards Section */}
      <h3 className="font-bold text-gray-900 text-base mb-4 flex items-center gap-1.5">
        <Users className="w-4.5 h-4.5 text-indigo-600" />
        Dossiê de Detalhes dos Fornecedores
      </h3>

      {activeSuppliers.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-200 rounded-2xl bg-white">
          <p className="text-sm font-semibold text-gray-650">Nenhum fornecedor registrado</p>
          <p className="text-xs text-gray-400 mt-1">Sua lista de fornecedores selecionados aparecerá aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeSuppliers.map((sup) => {
            const totalRef = (licitacao.itensPncp || []).reduce((acc, curr) => acc + (curr.valorTotal || (curr.quantidade * curr.valorUnitario) || 0), 0);
            const totalVal = (licitacao.itensPncp || []).reduce((acc, curr) => {
              const p = sup.itemPrices?.[curr.numero] || 0;
              return acc + (p * (curr.quantidade || 1));
            }, 0);

            // Calculations
            const discountPercentage = totalRef > 0 && totalVal > 0 ? ((totalRef - totalVal) / totalRef) * 100 : 0;
            const isLowestOverall = (() => {
              const list = activeSuppliers.map(s => {
                let sum = 0;
                (licitacao.itensPncp || []).forEach(it => {
                  sum += (s.itemPrices?.[it.numero] || 0) * (it.quantidade || 1);
                });
                return sum;
              }).filter(sum => sum > 0);
              
              return list.length > 0 && totalVal === Math.min(...list) && totalVal > 0;
            })();

            // Count items quoted
            const itemsQuoted = (licitacao.itensPncp || []).filter(it => (sup.itemPrices?.[it.numero] || 0) > 0).length;
            const itemsTotalCount = licitacao.itensPncp?.length || 0;

            return (
              <div key={sup.id} className={`p-4 bg-white border rounded-2xl shadow-2xs hover:shadow-xs transition flex flex-col justify-between gap-4 relative ${
                isLowestOverall ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-slate-150"
              }`}>
                {isLowestOverall && (
                  <span className="absolute -top-2.5 right-4 bg-emerald-600 text-white font-extrabold text-[9px] px-2.5 py-0.5 rounded-full shadow-sm uppercase tracking-wider flex items-center gap-0.5">
                    👑 LÍDER EM PREÇO
                  </span>
                )}

                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-md truncate max-w-[200px]" title={sup.name}>{sup.name}</h4>
                      <p className="text-[10px] text-slate-450 mt-0.5 font-bold uppercase tracking-wide">Produto base: {sup.product || "Geral"}</p>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      sup.status === "cotado" ? "bg-emerald-50 text-emerald-800 border border-emerald-100" :
                      sup.status === "sem_estoque" ? "bg-red-50 text-red-800 border border-red-100" :
                      sup.status === "rejeitado_valor_alto" ? "bg-amber-100 text-amber-850 border border-amber-200" : "bg-gray-150 text-gray-700"
                    }`}>
                      {sup.status === "cotado" ? "Cotação Pronta" : sup.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-450 block font-bold uppercase">VALOR INTEGRAL</span>
                      <span className="font-mono font-extrabold text-indigo-700 text-sm">
                        {totalVal > 0 ? formatCurrency(totalVal) : "Não cotado"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-450 block font-bold uppercase">Lotes Cotados</span>
                      <span className="font-bold text-slate-700 font-sans">
                        {itemsQuoted} de {itemsTotalCount} itens
                      </span>
                    </div>
                  </div>

                  {discountPercentage > 0 && (
                    <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <span>Margem de Desconto vs. Gov:</span>
                      <strong className="font-black bg-emerald-50 px-1.5 py-0.5 rounded">{discountPercentage.toFixed(1)}% abaixo do teto</strong>
                    </div>
                  )}

                  {/* Contact Details */}
                  <div className="mt-3.5 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate" title={sup.contact}>{sup.contact || "Sem e-mail cadastrado"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 mt-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">Estado d/ Atendimento:</span>
                    <select
                      className="bg-slate-50 border border-slate-200 text-[10.5px] px-2 py-1 rounded font-semibold text-slate-705 cursor-pointer outline-none"
                      value={sup.status}
                      onChange={(e) => handleUpdateSupplierStatus(sup.id, e.target.value as SupplierContact["status"])}
                    >
                      <option value="aguardando">Aguardando Retorno</option>
                      <option value="cotado">Cotado com Sucesso</option>
                      <option value="sem_estoque">Sem Estoque / Inviável</option>
                      <option value="rejeitado_valor_alto">Rejeitado (Preço Alto)</option>
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      setDeleteConfirm({
                        isOpen: true,
                        title: "Remover Fornecedor",
                        message: `Deseja de fato remover o fornecedor "${sup.name}" do checklist comparativo de preços?`,
                        type: "supplier",
                        itemId: sup.id
                      });
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Excluir fornecedor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
