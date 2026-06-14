import React from "react";
import { Licitacao } from "../types";
import { CATEGORIAS_LICITACAO, ESTADOS_BRASIL } from "../data";
import { Landmark, FileCheck, ExternalLink, Check, Plus, Sparkles, RefreshCw } from "lucide-react";

interface TabProps {
  licitacao: Licitacao;
  saveSuccess: boolean;
  handleSaveMainDetails: (e: React.FormEvent) => void;
  edital: string;
  setEdital: (v: string) => void;
  modalidade: string;
  setModalidade: (v: string) => void;
  orgao: string;
  setOrgao: (v: string) => void;
  objeto: string;
  setObjeto: (v: string) => void;
  valorEstimado: number;
  setValorEstimado: (v: number) => void;
  dataSessao: string;
  setDataSessao: (v: string) => void;
  cidade: string;
  setCidade: (v: string) => void;
  estado: string;
  setEstado: (v: string) => void;
  categoria: string;
  setCategoria: (v: string) => void;
  url: string;
  setUrl: (v: string) => void;
  idContratacaoPncp: string;
  setIdContratacaoPncp: (v: string) => void;
  unidadeCompradora: string;
  setUnidadeCompradora: (v: string) => void;
  amparoLegal: string;
  setAmparoLegal: (v: string) => void;
  modoDisputa: string;
  setModoDisputa: (v: string) => void;
  dataInicioPropostas: string;
  setDataInicioPropostas: (v: string) => void;
  dataFimPropostas: string;
  setDataFimPropostas: (v: string) => void;
  handleAttachPncpFile: (file: any) => void;
  scrapeUrl: string;
  setScrapeUrl: (v: string) => void;
  pasteText: string;
  setPasteText: (v: string) => void;
  scrapeOverwriteCore: boolean;
  setScrapeOverwriteCore: (v: boolean) => void;
  scrapeOverwriteLocation: boolean;
  setScrapeOverwriteLocation: (v: boolean) => void;
  scrapeImportDocs: boolean;
  setScrapeImportDocs: (v: boolean) => void;
  scrapeError: string;
  isScraping: boolean;
  handleScrapeWithIA: () => Promise<void>;
}

export default function TabDados({
  licitacao,
  saveSuccess,
  handleSaveMainDetails,
  edital,
  setEdital,
  modalidade,
  setModalidade,
  orgao,
  setOrgao,
  objeto,
  setObjeto,
  valorEstimado,
  setValorEstimado,
  dataSessao,
  setDataSessao,
  cidade,
  setCidade,
  estado,
  setEstado,
  categoria,
  setCategoria,
  url,
  setUrl,
  idContratacaoPncp,
  setIdContratacaoPncp,
  unidadeCompradora,
  setUnidadeCompradora,
  amparoLegal,
  setAmparoLegal,
  modoDisputa,
  setModoDisputa,
  dataInicioPropostas,
  setDataInicioPropostas,
  dataFimPropostas,
  setDataFimPropostas,
  handleAttachPncpFile,
  scrapeUrl,
  setScrapeUrl,
  pasteText,
  setPasteText,
  scrapeOverwriteCore,
  setScrapeOverwriteCore,
  scrapeOverwriteLocation,
  setScrapeOverwriteLocation,
  scrapeImportDocs,
  setScrapeImportDocs,
  scrapeError,
  isScraping,
  handleScrapeWithIA
}: TabProps) {
  return (
    <div className="p-6 flex flex-col-reverse md:grid md:grid-cols-5 gap-6">
      <div className="md:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-lg">Cadastro de Informações Principais</h3>
          {saveSuccess && (
            <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded border border-emerald-100">
              Alterações Gravadas!
            </span>
          )}
        </div>
        
        <form onSubmit={handleSaveMainDetails} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Identificação / Edital *</label>
              <input
                type="text"
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
                value={edital || ""}
                onChange={(e) => setEdital(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Modalidade *</label>
              <select
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 bg-white outline-none focus:ring-1 focus:ring-indigo-500"
                value={modalidade || ""}
                onChange={(e) => setModalidade(e.target.value)}
                required
              >
                <option value="Pregão Eletrônico">Pregão Eletrônico</option>
                <option value="Pregão Presencial">Pregão Presencial</option>
                <option value="Concorrência">Concorrência</option>
                <option value="Tomada de Preços">Tomada de Preços</option>
                <option value="Diálogo Competitivo">Diálogo Competitivo</option>
                <option value="Inexigibilidade">Inexigibilidade</option>
                <option value="Dispensa">Dispensa</option>
                <option value="Leilão">Leilão</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Órgão Licitante *</label>
            <input
              type="text"
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
              value={orgao || ""}
              onChange={(e) => setOrgao(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Objeto do Edital</label>
            <textarea
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
              value={objeto || ""}
              onChange={(e) => setObjeto(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Valor Estimado (R$)</label>
              <input
                type="number"
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
                value={valorEstimado || 0}
                onChange={(e) => setValorEstimado(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Data / Hora Sessão Pública</label>
              <input
                type="datetime-local"
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
                value={dataSessao || ""}
                onChange={(e) => setDataSessao(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Cidade</label>
              <input
                type="text"
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
                value={cidade || ""}
                onChange={(e) => setCidade(e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Estado (UF)</label>
              <select
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 bg-white outline-none focus:ring-1 focus:ring-indigo-500"
                value={estado || ""}
                onChange={(e) => setEstado(e.target.value)}
              >
                {ESTADOS_BRASIL.map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Categoria</label>
              <select
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 bg-white outline-none focus:ring-1 focus:ring-indigo-500"
                value={categoria || ""}
                onChange={(e) => setCategoria(e.target.value)}
              >
                {CATEGORIAS_LICITACAO.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Link de Acesso da Página</label>
            <input
              type="url"
              placeholder="https://www.comprasnet.gov.br/..."
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
              value={url || ""}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <Landmark className="w-3.5 h-3.5 text-blue-600" />
              Ficha de Atributos Oficiais PNCP
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ID Contratação PNCP</label>
                <input
                  type="text"
                  placeholder="Ex: 14485841000140-1-001269/2026"
                  className="w-full text-xs border border-gray-200 rounded p-2 bg-white"
                  value={idContratacaoPncp || ""}
                  onChange={(e) => setIdContratacaoPncp(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Unidade Compradora</label>
                <input
                  type="text"
                  placeholder="Ex: 11230 - DEPARTAMENTO DE TECNOLOGIA..."
                  className="w-full text-xs border border-gray-200 rounded p-2 bg-white"
                  value={unidadeCompradora || ""}
                  onChange={(e) => setUnidadeCompradora(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Amparo Legal</label>
                <input
                  type="text"
                  placeholder="Ex: Lei 14.133/2021, Art. 75, II"
                  className="w-full text-xs border border-gray-200 rounded p-2 bg-white"
                  value={amparoLegal || ""}
                  onChange={(e) => setAmparoLegal(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Modo de Disputa</label>
                <input
                  type="text"
                  placeholder="Ex: Dispensa Com Disputa"
                  className="w-full text-xs border border-gray-200 rounded p-2 bg-white"
                  value={modoDisputa || ""}
                  onChange={(e) => setModoDisputa(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Início Recepção Propostas</label>
                <input
                  type="text"
                  placeholder="Ex: 17/06/2026 14:30"
                  className="w-full text-xs border border-gray-200 rounded p-2 bg-white"
                  value={dataInicioPropostas || ""}
                  onChange={(e) => setDataInicioPropostas(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Fim Recepção Propostas</label>
                <input
                  type="text"
                  placeholder="Ex: 17/06/2026 16:30"
                  className="w-full text-xs border border-gray-200 rounded p-2 bg-white"
                  value={dataFimPropostas || ""}
                  onChange={(e) => setDataFimPropostas(e.target.value)}
                />
              </div>
            </div>

            {licitacao.itensPncp && licitacao.itensPncp.length > 0 && (
              <div className="mt-3">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Lotes / Itens Cadastrados ({licitacao.itensPncp.length})</label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-white border border-slate-150 rounded-lg">
                  {licitacao.itensPncp.map((it, i) => (
                    <div key={i} className="text-[11px] p-2 bg-slate-50 border border-slate-100 rounded flex justify-between items-start gap-2">
                      <div>
                        <span className="font-extrabold text-indigo-600 block">Lote {it.numero}</span>
                        <span className="text-slate-600 font-medium leading-tight">{it.descricao}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-800 block">Qtd: {it.quantidade}</span>
                        <span className="text-emerald-600 font-extrabold">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(it.valorTotal || (it.quantidade * it.valorUnitario) || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Captured PNCP Documents Panel */}
            <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 px-2 bg-indigo-50 border border-indigo-100 rounded text-indigo-700 font-semibold text-xs flex items-center gap-1">
                    <FileCheck className="w-3.5 h-3.5" />
                    Arquivos Digitais do Edital (PNCP)
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  {licitacao.arquivosPncp?.length || 0} extraídos
                </span>
              </div>

              {!licitacao.arquivosPncp || licitacao.arquivosPncp.length === 0 ? (
                <div className="text-center py-5 bg-white rounded-lg border border-slate-150 p-3">
                  <p className="text-[11px] text-gray-500 font-semibold">Nenhum edital PDF ou arquivo anexado.</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-normal">Selecione e cole o texto do portal PNCP (incluindo a aba arquivos) e use a IA à direita para ler e extrair os arquivos automaticamente.</p>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {licitacao.arquivosPncp.map((file, index) => {
                    const isAttached = licitacao.checklist.some(item => item.name.toLowerCase() === file.nome.toLowerCase() || (item.obs && item.obs.toLowerCase().includes(file.nome.toLowerCase())));
                    return (
                      <div key={`${file.id}-${index}`} className="p-2.5 bg-white border border-slate-150 rounded-lg flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800 truncate block" title={file.nome}>
                              {file.nome}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1 py-0.5 rounded shrink-0">
                              {file.tamanho || "ND"}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {file.descricao || "Documento oficial do edital"}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={file.linkUrl || "https://pncp.gov.br/app/editais?pagina=1"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Abrir
                          </a>
                          
                          <button
                            type="button"
                            onClick={() => handleAttachPncpFile(file)}
                            className={`p-1 px-2 rounded text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                              isAttached
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default"
                                : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shadow-sm"
                            }`}
                          >
                            {isAttached ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                Habilitado
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                Anexar
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

          <button
            type="submit"
            className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition shadow-sm cursor-pointer"
          >
            Salvar Alterações
          </button>
        </form>
      </div>

      {/* Scraper Panel with AI auto-fill */}
      <div className="md:col-span-2 bg-slate-50 p-5 rounded-2xl border border-gray-200 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5 mb-2">
            <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
            Integração Segura PNCP & Inteligência Artificial
          </h3>
          <p className="text-xs text-gray-600 mb-4 leading-normal">
            Você pode inserir o <strong className="text-indigo-700">Link do Portal PNCP</strong>, o <strong className="text-indigo-700">Código de Contratação do PNCP</strong> (formato <code className="bg-white font-mono px-1 py-0.5 rounded border text-[11px] text-indigo-800">CNPJ/ANO/SEQUENCIAL</code>, ex: <code className="bg-white font-mono px-1 py-0.5 rounded border text-[11px] text-slate-700">00394460000141/2026/1</code>), ou simplesmente colar o texto do edital.
          </p>
          <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-lg text-[11px] text-indigo-950 mb-4 leading-relaxed">
            ✨ <strong className="text-indigo-900">Integração Direta Ativa:</strong> Links ou códigos do PNCP consultam as tabelas federais do governo em tempo real, baixando a descrição dos lotes e links para download dos arquivos originais com 100% de precisão!
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Passo A: Link ou Código de Compra PNCP</label>
              <input
                type="text"
                placeholder="Ex: https://pncp.gov.br/app/editais/00394460000141/2026/1"
                className="w-full text-xs border border-gray-200 rounded p-2 bg-white font-mono text-indigo-900 placeholder:font-sans"
                value={scrapeUrl || ""}
                onChange={(e) => setScrapeUrl(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between my-2">
              <span className="h-px bg-gray-200 flex-1"></span>
              <span className="text-[10px] font-bold text-gray-400 mx-2 uppercase">Ou</span>
              <span className="h-px bg-gray-200 flex-1"></span>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Passo B: Colar Texto/HTML do Edital</label>
              <textarea
                rows={4}
                placeholder="Cole o cabeçalho do edital, objeto ou termos gerais aqui..."
                className="w-full text-xs border border-gray-200 rounded p-2 bg-white"
                value={pasteText || ""}
                onChange={(e) => setPasteText(e.target.value)}
              />
            </div>
          </div>

          {/* Opções de Mesclagem */}
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
            <label className="block text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Opções de Importação da IA</label>
            
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 w-3.5 h-3.5 cursor-pointer"
                checked={scrapeOverwriteCore}
                onChange={(e) => setScrapeOverwriteCore(e.target.checked)}
              />
              <div>
                <span className="text-xs font-bold text-gray-700 block">Sobrescrever dados do edital</span>
                <p className="text-[10px] text-gray-500 leading-tight">
                  Atualiza título, órgão, objeto e valor líquido. (Desmarque para manter o que você colou primeiro).
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 w-3.5 h-3.5 cursor-pointer"
                checked={scrapeOverwriteLocation}
                onChange={(e) => setScrapeOverwriteLocation(e.target.checked)}
              />
              <div>
                <span className="text-xs font-bold text-gray-700 block">Sobrescrever Município e Estado</span>
                <p className="text-[10px] text-gray-500 leading-tight">
                  Atualiza a cidade e UF do órgão automaticamente. (Deixe desmarcado para preservar a localidade correta).
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 w-3.5 h-3.5 cursor-pointer"
                checked={scrapeImportDocs}
                onChange={(e) => setScrapeImportDocs(e.target.checked)}
              />
              <div>
                <span className="text-xs font-bold text-gray-700 block">Mapear arquivos, concorrentes e termos adicionais</span>
                <p className="text-[10px] text-gray-500 leading-tight">
                  Extrai os anexos oficiais da licitação, estimativa de concorrentes e acrescenta ao checklist sem apagar dados anteriores.
                </p>
              </div>
            </label>
          </div>

          {scrapeError && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-100 mt-3 font-medium">
              {scrapeError}
            </div>
          )}
        </div>

        <div className="mt-5">
          <button
            onClick={handleScrapeWithIA}
            disabled={isScraping}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-800 disabled:from-indigo-400 hover:from-indigo-700 hover:to-indigo-900 text-white text-xs font-bold rounded-lg tracking-wide shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isScraping ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                IA Lendo Página...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                Ler Edital / Preencher via IA
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
