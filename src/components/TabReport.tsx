import React, { useState } from "react";
import { CompanySetting } from "../types";
import { Settings, Sparkles, RefreshCw, Check, Copy, Printer, FileCheck } from "lucide-react";
import { formatCNPJ, formatCPF, isValidCNPJ, isValidCPF } from "../utils/validation";

interface TabProps {
  companySettings: CompanySetting;
  onUpdateCompanySettings: (settings: CompanySetting) => void;
  isGeneratingDoc: boolean;
  handleGenerateDocTemplate: (docType: string) => Promise<{ success: boolean; data?: { documentTitle: string; content: string } }>;
}

export default function TabReport({
  companySettings,
  onUpdateCompanySettings,
  isGeneratingDoc,
  handleGenerateDocTemplate
}: TabProps) {
  const [activeDocDraftType, setActiveDocDraftType] = useState("Declaração de Habilitação Geral");
  const [docContentResult, setDocContentResult] = useState("");
  const [docTitleResult, setDocTitleResult] = useState("");
  const [copied, setCopied] = useState(false);
  
  const [cnpjError, setCnpjError] = useState("");
  const [cpfError, setCpfError] = useState("");

  const handleCnpjChange = (val: string) => {
    const masked = formatCNPJ(val);
    onUpdateCompanySettings({ ...companySettings, cnpj: masked });
    if (masked.trim() && !isValidCNPJ(masked)) {
      setCnpjError("CNPJ inválido");
    } else {
      setCnpjError("");
    }
  };

  const handleCpfChange = (val: string) => {
    const masked = formatCPF(val);
    onUpdateCompanySettings({ ...companySettings, partnerCPF: masked });
    if (masked.trim() && !isValidCPF(masked)) {
      setCpfError("CPF inválido");
    } else {
      setCpfError("");
    }
  };

  const handleCopy = () => {
    if (!docContentResult) return;
    navigator.clipboard.writeText(docContentResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onGenerate = async () => {
    const res = await handleGenerateDocTemplate(activeDocDraftType);
    if (res && res.success && res.data) {
      setDocContentResult(res.data.content);
      setDocTitleResult(res.data.documentTitle);
    }
  };

  return (
    <div className="p-6">
      <div className="border-b border-gray-100 pb-4 mb-6">
        <h3 className="font-bold text-gray-900 text-lg">Elaboração de Documentos de Sessão</h3>
        <p className="text-xs text-gray-500">Use os dados da licitação, cotações e de sua empresa para redigir instantaneamente as declarações obrigatórias exigidas na sessão de abertura.</p>
      </div>

      {/* Company Details Registry Settings */}
      <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl mb-6">
        <h4 className="text-xs font-bold text-slate-705 flex items-center gap-1.5 uppercase mb-3 text-slate-900">
          <Settings className="w-4 h-4 text-indigo-505" />
          Dados Cadastrais da Empresa para Declarações
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1">Razão Social</label>
            <input
              type="text"
              className="w-full text-xs border border-gray-200 bg-white p-2 rounded text-slate-800 font-medium"
              value={companySettings.name || ""}
              onChange={(e) => onUpdateCompanySettings({ ...companySettings, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1">CNPJ</label>
            <input
              type="text"
              className={`w-full text-xs border bg-white p-2 rounded text-slate-800 ${
                cnpjError ? "border-red-400 focus:ring-1 focus:ring-red-450" : "border-gray-200"
              }`}
              placeholder="00.000.000/0001-00"
              value={companySettings.cnpj || ""}
              onChange={(e) => handleCnpjChange(e.target.value)}
            />
            {cnpjError && <p className="text-[9px] text-red-500 mt-0.5 font-bold">{cnpjError}</p>}
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1">Endereço Completo</label>
            <input
              type="text"
              className="w-full text-xs border border-gray-200 bg-white p-2 rounded text-slate-800"
              value={companySettings.address || ""}
              onChange={(e) => onUpdateCompanySettings({ ...companySettings, address: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1">Representante/Sócio Gestor</label>
            <input
              type="text"
              className="w-full text-xs border border-gray-200 bg-white p-2 rounded text-slate-800"
              value={companySettings.partnerName || ""}
              onChange={(e) => onUpdateCompanySettings({ ...companySettings, partnerName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1">CPF Representante</label>
            <input
              type="text"
              className={`w-full text-xs border bg-white p-2 rounded text-slate-800 ${
                cpfError ? "border-red-400 focus:ring-1 focus:ring-red-450" : "border-gray-200"
              }`}
              placeholder="000.000.000-00"
              value={companySettings.partnerCPF || ""}
              onChange={(e) => handleCpfChange(e.target.value)}
            />
            {cpfError && <p className="text-[9px] text-red-500 mt-0.5 font-bold">{cpfError}</p>}
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1">Cargo/Função</label>
            <input
              type="text"
              className="w-full text-xs border border-gray-200 bg-white p-2 rounded text-slate-800"
              value={companySettings.partnerRole || ""}
              onChange={(e) => onUpdateCompanySettings({ ...companySettings, partnerRole: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Template generator interface selector */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Generation Control list */}
        <div className="md:col-span-1 space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Documento</label>
          
          {[
            "Declaração de Habilitação Geral",
            "Declaração de Superveniência e CF Art 7",
            "Carta de Proposta Comercial Inicial",
            "Declaração de Enquadramento ME/EPP",
            "Estudo Técnico Preliminar (ETP) - IN 58/2022",
            "Termo de Referência (TR) - IN 81/2022"
          ].map((type) => (
            <button
              key={type}
              onClick={() => setActiveDocDraftType(type)}
              className={`w-full text-left p-3 border rounded-xl text-xs font-bold transition block cursor-pointer ${
                activeDocDraftType === type 
                  ? "bg-indigo-50 border-indigo-400 text-indigo-900" 
                  : "bg-white border-gray-100 text-gray-600 hover:bg-slate-50"
              }`}
            >
              {type}
            </button>
          ))}

          <button
            onClick={onGenerate}
            disabled={isGeneratingDoc}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow flex items-center justify-center gap-1.5 mt-4 cursor-pointer"
          >
            {isGeneratingDoc ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Escrevendo...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Gerar com IA
              </>
            )}
          </button>
        </div>

        {/* Print area / Result block */}
        <div className="md:col-span-3 border border-gray-200 rounded-2xl bg-slate-50 p-5 flex flex-col justify-between">
          {docContentResult ? (
            <div>
              <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-4">
                <span className="text-xs font-black text-indigo-700 tracking-wider uppercase">{docTitleResult}</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className={`p-1 px-3 border text-[11px] font-bold rounded flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                      copied 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                        : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copiar Texto
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="p-1 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-bold rounded flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Imprimir
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 text-xs font-sans text-gray-850 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {docContentResult}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <FileCheck className="w-12 h-12 text-gray-300 mb-2" />
              <h4 className="font-bold text-gray-900 text-sm">Gere as minutas do certame com a IA</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-[280px]">
                Selecione o tipo de modelo ao lado e acione o gerador inteligente baseado no edital e seus dados cadastrais.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
