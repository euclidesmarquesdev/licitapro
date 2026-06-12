import React, { useState, useEffect } from "react";
import { MOCK_CATALOG_SUPPLIERS } from "../data";
import { Licitacao } from "../types";
import { 
  Users, Search, PlusCircle, Mail, Phone, Tag, Building, 
  Sparkles, Globe, Filter, Copy, Check, CheckSquare, 
  AlertCircle, ShieldCheck, X, FileText, ArrowRight
} from "lucide-react";

interface GeneralSuppliersProps {
  licitacoes: Licitacao[];
  onOpenLicitacao: (id: string) => void;
}

export default function GeneralSuppliers({ licitacoes, onOpenLicitacao }: GeneralSuppliersProps) {
  const [suppliersList, setSuppliersList] = useState<typeof MOCK_CATALOG_SUPPLIERS>(() => {
    const saved = localStorage.getItem("licitacoes_general_suppliers");
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return MOCK_CATALOG_SUPPLIERS;
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSub, setSelectedSub] = useState<string>("Todos");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New supplier modal local state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProduct, setNewProduct] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newCategory, setNewCategory] = useState("Geral");

  useEffect(() => {
    localStorage.setItem("licitacoes_general_suppliers", JSON.stringify(suppliersList));
  }, [suppliersList]);

  // Handle value formatting
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newProduct.trim()) {
      alert("Por favor, preencha o nome e o produto do fornecedor.");
      return;
    }

    const keywordsArray = newKeywords
      .split(",")
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);

    // Auto add category names as key filter words
    keywordsArray.push(newCategory.toLowerCase());

    const newSup = {
      name: newName,
      product: newProduct,
      value: parseFloat(newValue) || 0,
      contact: newContact || "comercial@empresa.com.br",
      phone: newPhone || "(11) 99999-9999",
      categoryKeywords: keywordsArray.length > 0 ? keywordsArray : [newProduct.toLowerCase()]
    };

    setSuppliersList(prev => [newSup, ...prev]);
    
    // Reset form
    setNewName("");
    setNewProduct("");
    setNewValue("");
    setNewContact("");
    setNewPhone("");
    setNewKeywords("");
    setNewCategory("Geral");
    setIsAddOpen(false);
    alert(`Fornecedor "${newSup.name}" cadastrado com sucesso no banco de dados!`);
  };

  // Identify category of supplier for filtering purpose
  const getSubcategoryName = (sup: typeof MOCK_CATALOG_SUPPLIERS[0]) => {
    const hasWord = (words: string[]) => sup.categoryKeywords.some(w => words.includes(w));
    
    if (hasWord(["pneu", "pneus", "roda", "rodas", "borracha"])) return "Pneus & Frota";
    if (hasWord(["xícara", "xicara", "xícaras", "caneca", "louça"])) return "Xícaras & Utensílios";
    if (hasWord(["fonte", "power supply", "alimentação", "alimentacao", "12v"])) return "Fontes & Informática";
    if (hasWord(["pavimentação", "pavimentacao", "asfáltica", "asfalto", "obras"])) return "Pavimentação & Obras";
    return "Geral / Matérias";
  };

  // Distinct subcategories
  const subcategories = ["Todos", "Pneus & Frota", "Xícaras & Utensílios", "Fontes & Informática", "Pavimentação & Obras", "Geral / Matérias"];

  // Filter list
  const filteredSuppliers = suppliersList.filter(sup => {
    const term = searchTerm.toLowerCase();
    const matchSearch = 
      sup.name.toLowerCase().includes(term) ||
      sup.product.toLowerCase().includes(term) ||
      sup.contact.toLowerCase().includes(term) ||
      sup.phone.toLowerCase().includes(term) ||
      sup.categoryKeywords.some(keyword => keyword.includes(term));

    const subName = getSubcategoryName(sup);
    const matchSub = selectedSub === "Todos" || subName === selectedSub;

    return matchSearch && matchSub;
  });

  // Check matching active tenders for each supplier
  const getMatchingTenders = (sup: typeof MOCK_CATALOG_SUPPLIERS[0]) => {
    return licitacoes.filter(lic => {
      const textPool = [
        lic.objeto || "",
        lic.edital || "",
        lic.categoria || "",
        ...(lic.itensPncp || []).map(i => i.descricao || "")
      ].join(" ").toLowerCase();

      return sup.categoryKeywords.some(keyword => textPool.includes(keyword));
    });
  };

  return (
    <div className="bg-slate-50 border border-slate-200/70 rounded-3xl p-6 shadow-sm flex flex-col gap-6 font-sans">
      
      {/* Header Info Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 flex items-center justify-center">
              <Users className="w-5 h-5 shrink-0" />
            </span>
            <h2 className="text-xl font-extrabold text-slate-900">Banco de Fornecedores Homologados</h2>
          </div>
          <p className="text-xs text-slate-500 leading-normal">
            Consulte os parceiros comerciais recomendados pela IA, gerencie contatos e vincule com os editais ativos no painel.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="w-full md:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/10 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Adicionar Novo Fornecedor
          </button>
        </div>
      </div>

      {/* Grid Quick Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total em Cadastro</span>
          <div className="text-xl font-black text-slate-900 mt-1">{suppliersList.length}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Encontrados Filtrados</span>
          <div className="text-xl font-black text-indigo-700 mt-1">{filteredSuppliers.length}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs col-span-2">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categorias Homologadas</span>
          <div className="flex flex-wrap gap-1 mt-1.5">
            <span className="bg-blue-50 text-blue-700 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-blue-100">Frotas</span>
            <span className="bg-amber-50 text-amber-700 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-amber-100">Xícaras</span>
            <span className="bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-indigo-100">Eletrônicos</span>
            <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-emerald-100">Obras</span>
          </div>
        </div>
      </div>

      {/* Filters control row bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/70 flex flex-col md:flex-row gap-4 justify-between items-center">
        
        {/* Realtime Search box */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar fornecedores por nome, produto, telefone ou tags..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 transition"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Tab filters */}
        <div className="w-full md:w-auto flex flex-wrap gap-1.5 overflow-x-auto justify-start md:justify-end">
          {subcategories.map(subCategory => {
            const isActive = selectedSub === subCategory;
            return (
              <button
                key={subCategory}
                type="button"
                onClick={() => setSelectedSub(subCategory)}
                className={`py-1.5 px-3 rounded-lg text-[10.5px] font-bold transition duration-150 cursor-pointer ${
                  isActive 
                    ? "bg-indigo-600 text-white shadow-sm" 
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {subCategory}
              </button>
            );
          })}
        </div>
      </div>

      {/* Suppliers Grid Layout cards */}
      {filteredSuppliers.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200/70 rounded-2xl p-6">
          <Filter className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="font-bold text-slate-900 text-sm">Nenhum fornecedor localizado</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-normal">
            Altere os filtros ou adicione um novo parceiro comercial no botão acima para alimentar sua base corporativa.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSuppliers.map((sup, idx) => {
            const category = getSubcategoryName(sup);
            const matchingTenders = getMatchingTenders(sup);
            
            return (
              <div 
                key={idx} 
                className="bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-indigo-400 hover:shadow-md transition duration-200 flex flex-col justify-between gap-4 font-sans relative overflow-hidden"
              >
                {/* Visual accent top */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500/10 via-sky-500/10 to-teal-500/10" />

                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 block tracking-tight line-clamp-1">{sup.name}</h4>
                      <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 mt-1 rounded-full ${
                        category === "Pneus & Frota" ? "bg-blue-50 text-blue-700 border border-blue-100" :
                        category === "Xícaras & Utensílios" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                        category === "Fontes & Informática" ? "bg-purple-50 text-purple-700 border border-purple-100" :
                        category === "Pavimentação & Obras" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {category}
                      </span>
                    </div>
                    
                    <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl shrink-0">
                      {sup.value ? formatCurrency(sup.value) : "Cotação Livre"}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <p className="text-slate-600 flex items-start gap-1.5 leading-relaxed">
                      <Building className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span><strong>Produto / Escopo:</strong> {sup.product}</span>
                    </p>
                  </div>

                  {/* Hot Action Contacts */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 overflow-hidden">
                        <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate" title={sup.contact}>{sup.contact}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(sup.contact, sup.name + "-email")}
                        className="text-indigo-600 hover:text-indigo-800 p-1 bg-white hover:bg-slate-100 rounded border border-slate-200 shrink-0 cursor-pointer"
                        title="Copiar e-mail"
                      >
                        {copiedId === sup.name + "-email" ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-650">
                        <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="font-bold text-slate-700">{sup.phone}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(sup.phone, sup.name + "-phone")}
                        className="text-emerald-600 hover:text-emerald-800 p-1 bg-white hover:bg-slate-100 rounded border border-slate-200 shrink-0 cursor-pointer"
                        title="Copiar telefone"
                      >
                        {copiedId === sup.name + "-phone" ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Keyword Tags */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {sup.categoryKeywords.slice(0, 4).map((tag, idx) => (
                      <span key={idx} className="bg-zinc-50 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                    {sup.categoryKeywords.length > 4 && (
                      <span className="text-[8px] text-slate-400 font-bold self-center">+{sup.categoryKeywords.length - 4}</span>
                    )}
                  </div>
                </div>

                {/* Smart Match active processes panel inside each card */}
                <div className="border-t border-slate-100 pt-3 mt-1.5">
                  <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-indigo-700 mb-1.5">
                    <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
                    Editais Compatíveis no Painel ({matchingTenders.length})
                  </div>

                  {matchingTenders.length === 0 ? (
                    <div className="text-[10px] text-zinc-400">Nenhum edital compatível no momento.</div>
                  ) : (
                    <div className="space-y-1.5 max-h-[100px] overflow-y-auto">
                      {matchingTenders.map(lic => (
                        <div 
                          key={lic.id}
                          onClick={() => onOpenLicitacao(lic.id)}
                          className="p-1.5 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100/40 hover:border-indigo-200 rounded-lg text-[10.5px] cursor-pointer flex items-center justify-between gap-1 transition"
                          title="Clique para ir para este edital"
                        >
                          <span className="text-slate-800 font-semibold truncate max-w-[85%]">
                            {lic.orgao} ({lic.edital})
                          </span>
                          <ArrowRight className="w-3 h-3 text-indigo-500 shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Add Supplier Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden my-auto animation-scaleIn">
            <div className="bg-indigo-900 px-6 py-4 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-400" />
                  Homologar Novo Fornecedor
                </h3>
                <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest mt-0.5">
                  Catálogo Interno Compartilhado
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5 cursor-pointer" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome da Empresa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Cummins Brasil Peças"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Categoria Comercial</label>
                  <select
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  >
                    <option value="Pneus">Pneus & Frota</option>
                    <option value="Xícaras">Xícaras & Utensílios Domésticos</option>
                    <option value="Fontes">Fontes & Componentes</option>
                    <option value="Pavimentação">Pavimentação & Asfalto</option>
                    <option value="Geral">Outros Escopos</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Produto / Serviço Oferecido *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Fornecimento de Geradores e Motores Estacionários"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  value={newProduct}
                  onChange={(e) => setNewProduct(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">E-mail Corporativo</label>
                  <input
                    type="email"
                    placeholder="comercial@empresa.com.br"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                    value={newContact}
                    onChange={(e) => setNewContact(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Telefone Fone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="(11) 99888-7766"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Estimativa de Preço Base (R$)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Ex: 850"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Keywords p/ Filtro IA (separadas por vírgula)</label>
                  <input
                    type="text"
                    placeholder="gerador, diesel, motor, cabos"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                  />
                </div>
              </div>

              <div className="text-[10px] text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100 flex items-start gap-1.5 font-bold leading-normal">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>As keywords cadastradas serão utilizadas pela inteligência do sistema para sugerir e automatizar o preenchimento de propostas quando você abrir editais recomendados!</span>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow cursor-pointer"
                >
                  Confirmar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
