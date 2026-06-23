import React, { useState } from "react";
import { Licitacao, LicitacaoChecklistItem, SupplierContact, CompetitorBid, CompanySetting } from "../types";
import { STATUS_LICITACAO, MOCK_CATALOG_SUPPLIERS } from "../data";
import ConfettiCelebration from "./ConfettiCelebration";
import { parsePncpClipboardText, parseBrazilianDateToISO } from "../utils/pncpParser";
import { auth } from "../firebase";
import { showToast } from "../utils/toast";

// Import custom hooks
import { useLicitacao } from "../hooks/useLicitacao";
import { useGeracaoDocumentos } from "../hooks/useGeracaoDocumentos";
import { useFornecedores } from "../hooks/useFornecedores";

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
  licitacao: licitacaoProp,
  companySettings,
  onUpdate,
  onBack,
  onUpdateCompanySettings
}: LicitacaoDetailsProps) {
  const [activeTab, setActiveTab] = useState<"dados" | "docs" | "suppliers" | "competitors" | "predict" | "alerts" | "report" | "compliance">("dados");

  const {
    state,
    checkCelebration,
    handleConfirmDelete,
    handleSaveMainDetails,
    handleStatusChange,
    handleScrapeWithIA,
    handleAddDoc,
    handleAttachPncpFile,
    handleToggleDocStatus,
    handleDeleteDoc,
    handleAddCompetitor,
    handleUpdateCompetitorStatus,
    handleDeleteCompetitor,
    handleAIPredict,
    handleCreateCustomItem,
    handleDeleteItemPncp
  } = useLicitacao(licitacaoProp, onUpdate);

  const {
    licitacao,
    edital, setEdital,
    orgao, setOrgao,
    objeto, setObjeto,
    modalidade, setModalidade,
    valorEstimado, setValorEstimado,
    dataSessao, setDataSessao,
    cidade, setCidade,
    estado, setEstado,
    categoria, setCategoria,
    url, setUrl,
    unidadeCompradora, setUnidadeCompradora,
    amparoLegal, setAmparoLegal,
    idContratacaoPncp, setIdContratacaoPncp,
    modoDisputa, setModoDisputa,
    dataInicioPropostas, setDataInicioPropostas,
    dataFimPropostas, setDataFimPropostas,
    scrapeUrl, setScrapeUrl,
    pasteText, setPasteText,
    isScraping,
    scrapeError,
    scrapeOverwriteCore, setScrapeOverwriteCore,
    scrapeOverwriteLocation, setScrapeOverwriteLocation,
    scrapeImportDocs, setScrapeImportDocs,
    newDocName, setNewDocName,
    newDocObs, setNewDocObs,
    isPredicting,
    statusNote, setStatusNote,
    saveSuccess,
    celebration, setCelebration,
    deleteConfirm, setDeleteConfirm
  } = state;

  const {
    isGeneratingDoc,
    handleGenerateDocTemplate
  } = useGeracaoDocumentos(companySettings, licitacao, onUpdate);

  const {
    activeSuppliers,
    activeQuoteSum,
    handleAddSupplier,
    handleUpdateSupplierStatus,
    handleDeleteSupplier,
    getCompatibleSuppliers,
    handleImportCatalogSupplier,
    handleImportAllCompatible,
    handleUpdateSupplierItemPrice
  } = useFornecedores(licitacao, onUpdate, checkCelebration);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);
  };

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
              <Users className="w-4 h-4 shrink-0 text-indigo-500" />
              <span className="truncate">Fornecedores & Cotações</span>
            </div>
            
            <div className="flex items-center gap-1 shrink-0">
              {activeSuppliers.length > 0 && (
                <span className={`text-[9.5px] px-1.5 py-0.5 rounded font-medium ${
                  activeTab === "suppliers" ? "bg-blue-700 text-blue-100" : "bg-slate-100 text-slate-600"
                }`} title="Empresas cotadas / vinculadas">
                  {activeSuppliers.filter(s => s.status === "cotado").length}/{activeSuppliers.length}
                </span>
              )}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${
                activeTab === "suppliers" 
                  ? "bg-blue-500 text-white" 
                  : "bg-indigo-100 text-indigo-800"
              }`} title={`${getCompatibleSuppliers().length} fornecedores compatíveis com este edital`}>
                {getCompatibleSuppliers().length}
              </span>
            </div>
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
                onClick={() => handleConfirmDelete()}
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
        onClose={() => setCelebration({ isOpen: false, type: null, message: "" })}
        type={celebration.type}
        orgao={licitacao.orgao}
        edital={licitacao.edital}
        triggerMessage={celebration.message}
      />
    </div>
  );
}