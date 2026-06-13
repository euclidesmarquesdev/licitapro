import React, { useState } from "react";
import { Licitacao, CompetitorBid } from "../types";
import { Landmark, Plus, Trash2, AlertTriangle } from "lucide-react";
import { isValidCNPJ, formatCNPJ } from "../utils/validation";

interface TabProps {
  licitacao: Licitacao;
  formatCurrency: (val: number) => string;
  handleAddCompetitor: (name: string, cnpj: string, bid: number) => void;
  handleUpdateCompetitorStatus: (id: string, status: CompetitorBid["status"]) => void;
  setDeleteConfirm: (v: any) => void;
}

export default function TabCompetitors({
  licitacao,
  formatCurrency,
  handleAddCompetitor,
  handleUpdateCompetitorStatus,
  setDeleteConfirm
}: TabProps) {
  const [compName, setCompName] = useState("");
  const [compCnpj, setCompCnpj] = useState("");
  const [compBid, setCompBid] = useState(0);
  const [cnpjError, setCnpjError] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim()) return;
    
    if (compCnpj.trim() && !isValidCNPJ(compCnpj)) {
      setCnpjError("CNPJ inválido. Verifique se o formato e os dígitos estão corretos.");
      return;
    }
    
    handleAddCompetitor(compName, compCnpj, compBid);
    setCompName("");
    setCompCnpj("");
    setCompBid(0);
    setCnpjError("");
  };

  const handleCnpjChange = (val: string) => {
    const masked = formatCNPJ(val);
    setCompCnpj(masked);
    if (masked.trim() && !isValidCNPJ(masked)) {
      setCnpjError("CNPJ inválido (Dígitos verificadores incorretos)");
    } else {
      setCnpjError("");
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Mapeamento de Competidores Diretos</h3>
          <p className="text-xs text-gray-500">Documente as empresas rivais e seus lances iniciais/finais históricos para calibrar nossa margem preditiva.</p>
        </div>
      </div>

      {/* Add competitor form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-50 border border-gray-200 rounded-xl mb-6">
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nome Fantasia / Razão Social</label>
          <input
            type="text"
            placeholder="Softplan S.A."
            className="w-full text-xs bg-white border border-gray-200 rounded p-2 outline-none text-slate-850 font-medium"
            value={compName}
            onChange={(e) => setCompName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">CNPJ (Opcional)</label>
          <input
            type="text"
            placeholder="21.394.029/0001-99"
            className={`w-full text-xs bg-white border rounded p-2 outline-none text-slate-850 ${
              cnpjError ? "border-red-400 focus:ring-1 focus:ring-red-400" : "border-gray-200"
            }`}
            value={compCnpj}
            onChange={(e) => handleCnpjChange(e.target.value)}
          />
          {cnpjError && (
            <p className="text-[9px] text-red-500 mt-1 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" />
              {cnpjError}
            </p>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Lance Apresentado / Histórico (R$)</label>
          <input
            type="number"
            placeholder="Ex: 940000"
            className="w-full text-xs bg-white border border-gray-200 rounded p-2 outline-none text-slate-855 font-bold"
            value={compBid || ""}
            onChange={(e) => setCompBid(Number(e.target.value))}
          />
        </div>

        <button
          onClick={onSubmit}
          className="md:col-span-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded flex items-center justify-center gap-1.5 shadow cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Incluir Empresa Concorrente de Interesse
        </button>
      </div>

      {/* Competitors List */}
      {licitacao.competitors.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-lg">
          <Landmark className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-650">Nenhum concorrente cadastrado</p>
          <p className="text-xs text-gray-400 mt-1">Insira os concorrentes conhecidos ou históricos acima.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {licitacao.competitors.map((c) => (
            <div key={c.id} className="flex flex-col md:flex-row md:items-center justify-between p-3.5 border border-gray-100 rounded-xl hover:bg-slate-50/50 transition gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900 text-sm">{c.name}</h4>
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    c.status === "vencedor_provisorio" || c.status === "ganhou_certame" ? "bg-emerald-50 text-emerald-800" :
                    c.status === "desclassificado" ? "bg-red-50 text-red-800" : "bg-gray-105 text-gray-600"
                  }`}>
                    {c.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  <strong>CNPJ:</strong> {c.cnpj || "Sem registro"} | <strong>Valor Apresentado:</strong> {formatCurrency(c.bidValue)}
                </p>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                <select
                  className="bg-white border border-gray-200 text-xs px-2 py-1 rounded cursor-pointer"
                  value={c.status}
                  onChange={(e) => handleUpdateCompetitorStatus(c.id, e.target.value as CompetitorBid["status"])}
                >
                  <option value="perdeu">Perdeu o processo</option>
                  <option value="vencedor_provisorio">Vencedor Provisório</option>
                  <option value="ganhou_certame">Ganhou o Certame</option>
                  <option value="desclassificado">Desclassificado Técnica/Habilitação</option>
                  <option value="recurso">Recurso Aberto</option>
                </select>
                <button
                  onClick={() => {
                    setDeleteConfirm({
                      isOpen: true,
                      title: "Remover Concorrente",
                      message: `Tem certeza de que deseja remover o concorrente "${c.name}" desta estimativa?`,
                      type: "competitor",
                      itemId: c.id
                    });
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Excluir concorrente"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
