import React from "react";
import { Trash2 } from "lucide-react";
import { Licitacao } from "../types";

interface DeleteLicitacaoModalProps {
  licitacao: Licitacao;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteLicitacaoModal({
  licitacao,
  onClose,
  onConfirm,
}: DeleteLicitacaoModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 relative overflow-hidden">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 border border-rose-100 mb-4">
          <Trash2 className="h-6 w-6 text-rose-600" />
        </div>

        <div className="text-center">
          <h3 className="text-base font-black text-slate-900 mb-2">
            Excluir Edital e Todos os Registros?
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto mb-4 font-sans">
            Você está prestes a excluir definitivamente o edital <span className="font-extrabold text-slate-800">"{licitacao.edital}"</span> ({licitacao.orgao}).
          </p>
          
          <div className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-100 text-left mb-6 space-y-1.5 font-sans">
            <span className="text-[10px] font-black text-rose-800 uppercase tracking-widest block mb-1">Itens Deletados Adicionalmente:</span>
            <ul className="text-[11px] text-slate-650 list-disc list-inside space-y-1 font-sans">
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
            onClick={onClose}
            className="py-2.5 px-4 flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="py-2.5 px-4 flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-red-500/10 cursor-pointer"
          >
            Confirmar Exclusão
          </button>
        </div>
      </div>
    </div>
  );
}
