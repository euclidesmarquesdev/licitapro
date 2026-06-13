import React, { useState } from "react";
import { Licitacao } from "./types";
import { ESTADOS_BRASIL, CATEGORIAS_LICITACAO, STATUS_LICITACAO } from "./data";
import LicitacaoCard from "./components/LicitacaoCard";
import LicitacaoDetails from "./components/LicitacaoDetails";
import AlertsManager from "./components/AlertsManager";
import GeneralSuppliers from "./components/GeneralSuppliers";
import BackupModal from "./components/BackupModal";
import WelcomeScreen from "./components/WelcomeScreen";
import AddLicitacaoModal from "./components/AddLicitacaoModal";
import DeleteLicitacaoModal from "./components/DeleteLicitacaoModal";

import { useAuth } from "./hooks/useAuth";
import { useLicitacoes } from "./hooks/useLicitacoes";
import { useFiltros } from "./hooks/useFiltros";

import { 
  TrendingUp, Search, PlusCircle, Bell, 
  Sparkles, LogOut, Users, 
  BarChart, Database, RefreshCw, Trash2, ExternalLink, ShieldCheck
} from "lucide-react";

export default function App() {
  const {
    user,
    authLoading,
    isGuestMode,
    setIsGuestMode,
    termsAccepted,
    setTermsAccepted,
    termsError,
    setTermsError,
    handleGoogleLogin,
    handleLogout: rawHandleLogout
  } = useAuth();

  const {
    licitacoes,
    setLicitacoes,
    loadingList,
    selectedLicitacaoId,
    setSelectedLicitacaoId,
    companySettings,
    handleUpdateLicitacao,
    handleSaveNewLicitacao,
    handleDeleteLicitacao,
    handleTriggerAlertNow,
    handleDeleteAlert,
    handleAddAlert,
    handleUpdateCompanySettings,
    handleRestoreComplete
  } = useLicitacoes(user, authLoading, isGuestMode);

  const {
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    selectedState,
    setSelectedState,
    selectedStatus,
    setSelectedStatus,
    filteredLicitacoes
  } = useFiltros(licitacoes);

  const handleLogout = () => {
    rawHandleLogout(() => {
      setLicitacoes([]);
    });
    setSelectedLicitacaoId(null);
  };

  // Main dashboard view control ("editais" | "fornecedores")
  const [activeMainView, setActiveMainView] = useState<"editais" | "fornecedores">("editais");

  // Overlays and modals controls
  const [showGlobalAlerts, setShowGlobalAlerts] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Deletion confirmation state
  const [licitacaoToDelete, setLicitacaoToDelete] = useState<Licitacao | null>(null);

  // KPI Calculations across all loaded/filtered biddings
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
        <h2 className="text-lg font-bold font-sans">Carregando painel de Licitações...</h2>
        <p className="text-xs text-slate-400 mt-2 font-sans">Segurança autenticada nos servidores do Google</p>
      </div>
    );
  }

  // Welcome / Authentication screen
  if (!user && !isGuestMode) {
    return (
      <WelcomeScreen
        termsAccepted={termsAccepted}
        setTermsAccepted={setTermsAccepted}
        termsError={termsError}
        setTermsError={setTermsError}
        handleGoogleLogin={handleGoogleLogin}
        setIsGuestMode={setIsGuestMode}
      />
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
              <h1 className="font-extrabold text-white text-[15px] tracking-tight leading-none font-sans">LICITA_PRO</h1>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mt-1 font-sans">Inteligência Estratégica IA</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Global Notifications simulator indicator */}
            <button
              onClick={() => setShowGlobalAlerts(!showGlobalAlerts)}
              className={`p-2.5 rounded-xl border transition relative flex items-center justify-center cursor-pointer ${
                showGlobalAlerts 
                  ? "bg-amber-500 border-amber-600 text-slate-950 shadow" 
                  : "bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white"
              }`}
              title="Central Geral de Alertas e Prazos"
            >
              <Bell className="w-5 h-5" />
              {licitacoes.flatMap(l => l.alerts).filter(a => !a.testSent).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-amber-500 text-slate-950 text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-slate-900 font-sans">
                  {licitacoes.flatMap(l => l.alerts).filter(a => !a.testSent).length}
                </span>
              )}
            </button>

            {/* Authentication status badge */}
            <div className="hidden lg:flex flex-col text-right font-sans">
              <span className="text-xs font-bold text-white truncate max-w-[150px]">
                {user ? user.displayName : "Usuário Convidado"}
              </span>
              <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest leading-none mt-0.5">
                {isGuestMode ? "Modo Demo Local" : "Conta Cloud Ativa"}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-slate-800 hover:bg-red-950 hover:text-red-300 border border-slate-700 transition cursor-pointer"
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
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 bg-slate-800 rounded border border-slate-700 cursor-pointer font-sans"
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-sans">
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
        <div className="flex border-b border-slate-100 bg-white p-1 rounded-2xl shadow-xs gap-1 font-sans">
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
            onClick={() => setActiveMainView("fornecedores")}
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
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition font-sans"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Action buttons triggers */}
                <div className="flex flex-wrap items-center gap-2.5 font-sans">
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
                    onClick={() => setShowAddModal(true)}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/10 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Monitorar Outro Edital
                  </button>

                  <button
                    onClick={() => setShowBackupModal(true)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Database className="w-4 h-4 text-slate-300" />
                    Backup Local
                  </button>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Core filters select dropdown row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-sans">
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
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition cursor-pointer"
                  >
                    Limpar Todos os Filtros
                  </button>
                </div>
              </div>
            </div>

            {/* Loading / Content items grid */}
            {loadingList ? (
              <div className="py-24 text-center font-sans">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                <span className="text-xs font-semibold text-slate-500 mt-2 block">Obtendo licitações sincronizadas...</span>
              </div>
            ) : filteredLicitacoes.length === 0 ? (
              <div className="py-20 text-center bg-white border border-slate-200/80 rounded-2xl p-6 font-sans">
                <BarChart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-bold text-slate-900 text-base">Nenhum edital coincide com os filtros</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-normal">
                  Tente alterar os termos da busca, limpar filtros da barra ou cadastrar um novo edital para acompanhar do início!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
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
      <AddLicitacaoModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        user={user}
        isGuestMode={isGuestMode}
        onSave={handleSaveNewLicitacao}
      />

      {/* Deletion Confirmation Modal */}
      {licitacaoToDelete && (
        <DeleteLicitacaoModal
          licitacao={licitacaoToDelete}
          onClose={() => setLicitacaoToDelete(null)}
          onConfirm={async () => {
            if (licitacaoToDelete) {
              await handleDeleteLicitacao(licitacaoToDelete.id);
              setLicitacaoToDelete(null);
            }
          }}
        />
      )}

      {/* Backup and Restore Modal */}
      <BackupModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        onRestoreComplete={handleRestoreComplete}
      />
    </div>
  );
}
