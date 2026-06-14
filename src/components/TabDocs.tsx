import React from "react";
import { Licitacao, LicitacaoChecklistItem } from "../types";
import { FileText, Plus, Trash2, ExternalLink, Check, CheckSquare } from "lucide-react";

interface TabProps {
  licitacao: Licitacao;
  newDocName: string;
  setNewDocName: (v: string) => void;
  newDocObs: string;
  setNewDocObs: (v: string) => void;
  handleAddDoc: () => void;
  handleToggleDocStatus: (id: string, newStatus: LicitacaoChecklistItem["status"]) => void;
  handleAttachPncpFile: (file: any) => void;
  setDeleteConfirm: (confirm: any) => void;
}

export default function TabDocs({
  licitacao,
  newDocName,
  setNewDocName,
  newDocObs,
  setNewDocObs,
  handleAddDoc,
  handleToggleDocStatus,
  handleAttachPncpFile,
  setDeleteConfirm
}: TabProps) {
  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Habilitação & Documentações Requeridas</h3>
          <p className="text-xs text-gray-500">Mapeie todas as certidões necessárias e evite a desclassificação por erros de documentos.</p>
        </div>
        <div className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
          {licitacao.checklist.filter(d => d.status === "validado").length} de {licitacao.checklist.length} Habilitados
        </div>
      </div>

      {/* Add document manual field */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-50 border border-gray-200 rounded-xl mb-6">
        <input
          type="text"
          placeholder="Nome do Documento (Ex: CND FGTS)"
          className="text-xs bg-white border border-gray-200 rounded p-2 md:col-span-2 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-850 font-medium"
          value={newDocName || ""}
          onChange={(e) => setNewDocName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Observação (Opcional)"
          className="text-xs bg-white border border-gray-200 rounded p-2 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-850"
          value={newDocObs || ""}
          onChange={(e) => setNewDocObs(e.target.value)}
        />
        <button
          onClick={handleAddDoc}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded flex items-center justify-center gap-1.5 md:col-span-3 shadow cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Incluir Certidão/Documento Obrigatório
        </button>
      </div>

      {/* Documents Checklist List */}
      {licitacao.checklist.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-lg">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-600">Nenhum documento listado</p>
          <p className="text-xs text-gray-400 mt-1">Utilize o autopreenchimento IA na primeira aba para gerar o checklist recomendado de acordo com a lei!</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {licitacao.checklist.map((doc) => (
            <div key={doc.id} className="flex flex-col md:flex-row md:items-center justify-between p-3.5 border border-gray-100 rounded-xl hover:bg-slate-50/50 transition gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900 text-sm">{doc.name}</h4>
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    doc.status === "validado" ? "bg-emerald-50 text-emerald-800" :
                    doc.status === "preparando" ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-600"
                  }`}>
                    {doc.status}
                  </span>
                </div>
                {doc.obs && <p className="text-xs text-gray-500 mt-1">{doc.obs}</p>}
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                <select
                  className="bg-white border border-gray-200 text-xs px-2 py-1 rounded outline-none cursor-pointer"
                  value={doc.status}
                  onChange={(e) => handleToggleDocStatus(doc.id, e.target.value as LicitacaoChecklistItem["status"])}
                >
                  <option value="pendente">Pendente/Não iniciada</option>
                  <option value="preparando">Em preparação</option>
                  <option value="validado">Habilitado/Aprovado</option>
                  <option value="documento_pronto">Pronto p/ Assinar</option>
                  <option value="rejeitado">Incompleto/Rejeitado</option>
                </select>
                <button
                  onClick={() => {
                    setDeleteConfirm({
                      isOpen: true,
                      title: "Excluir Documento",
                      message: `Tem certeza de que deseja remover o documento "${doc.name}" do checklist? Esta ação não pode ser desfeita.`,
                      type: "document",
                      itemId: doc.id
                    });
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Excluir documento"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PNCP Captured Documents Section inside Docs Tab */}
      <div className="mt-8 pt-6 border-t border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-sm">Arquivos & Editais Extraídos do PNCP</h4>
              <p className="text-[11px] text-gray-500">Exemplares e termos de referência capturados do portal PNCP para anexar ao checklist.</p>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
            {licitacao.arquivosPncp?.length || 0} arquivos
          </span>
        </div>

        {!licitacao.arquivosPncp || licitacao.arquivosPncp.length === 0 ? (
          <div className="text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs text-gray-500 font-medium">Nenhum edital ou arquivo PDF capturado na ficha.</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Vá na primeira aba e preencha via IA fornecendo o conteúdo da aba "Arquivos" do PNCP para listá-los e vinculá-los!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {licitacao.arquivosPncp.map((file, index) => {
              const isAttached = licitacao.checklist.some(item => item.name.toLowerCase() === file.nome.toLowerCase() || (item.obs && item.obs.toLowerCase().includes(file.nome.toLowerCase())));
              return (
                <div key={`${file.id}-${index}`} className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl transition duration-200 flex flex-col justify-between gap-3 font-sans">
                  <div className="space-y-1">
                    <div className="flex items-start gap-1.5 justify-between">
                      <span className="text-xs font-bold text-slate-800 truncate block max-w-[85%] hover:text-indigo-600" title={file.nome}>
                        {file.nome}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded shrink-0">
                        {file.tamanho || "PDF"}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {file.descricao || "Documento oficial recuperado do PNCP"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-1 pt-2 border-t border-slate-200/60">
                    <a
                      href={file.linkUrl || "https://pncp.gov.br/app/editais?pagina=1"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold text-center tracking-wide shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Visualizar Documento
                    </a>
                    <button
                      type="button"
                      onClick={() => handleAttachPncpFile(file)}
                      disabled={isAttached}
                      className={`flex-1 py-1.5 px-3 rounded text-[10px] font-bold border tracking-wide transition flex items-center justify-center gap-1 cursor-pointer ${
                        isAttached
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default"
                          : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-xs"
                      }`}
                    >
                      {isAttached ? (
                        <>
                          <CheckSquare className="w-3 h-3 text-emerald-500" />
                          Anexado ao Checklist
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          Vincular p/ Checklist
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
