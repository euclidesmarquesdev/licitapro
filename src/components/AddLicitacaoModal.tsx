import React, { useState } from "react";
import { Database, PlusCircle, Settings, RefreshCw, Sparkles } from "lucide-react";
import { Licitacao } from "../types";
import { CATEGORIAS_LICITACAO } from "../data";
import { parsePncpClipboardText, parseBrazilianDateToISO } from "../utils/pncpParser";
import { getClientAuthToken } from "../firebase";
import { showToast } from "../utils/toast";

interface AddLicitacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  isGuestMode: boolean;
  onSave: (newItem: Licitacao) => void;
}

export default function AddLicitacaoModal({
  isOpen,
  onClose,
  user,
  isGuestMode,
  onSave,
}: AddLicitacaoModalProps) {
  const [addModalTab, setAddModalTab] = useState<"paste" | "form">("paste");
  const [pastedPNCP, setPastedPNCP] = useState("");
  const [parsingLoading, setParsingLoading] = useState(false);
  
  const [newEdital, setNewEdital] = useState("");
  const [newOrgao, setNewOrgao] = useState("");
  const [newModalidade, setNewModalidade] = useState("Dispensa");
  const [newCategory, setNewCategory] = useState("Tecnologia da Informação");
  const [newUnidadeCompradora, setNewUnidadeCompradora] = useState("");
  const [newAmparoLegal, setNewAmparoLegal] = useState("");
  const [newIdPncp, setNewIdPncp] = useState("");
  const [newModoDisputa, setNewModoDisputa] = useState("");
  const [newObjeto, setNewObjeto] = useState("");
  const [newValorEstimado, setNewValorEstimado] = useState<number>(0);
  const [newCidade, setNewCidade] = useState("");
  const [newEstado, setNewEstado] = useState("BA");
  const [newInicioPropostas, setNewInicioPropostas] = useState("");
  const [newFimPropostas, setNewFimPropostas] = useState("");
  const [newItensPncp, setNewItensPncp] = useState<{
    numero: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
  }[]>([]);
  const [newArquivosPncp, setNewArquivosPncp] = useState<{
    id: string;
    nome: string;
    descricao?: string;
    linkUrl?: string;
    tamanho?: string;
  }[]>([]);

  if (!isOpen) return null;

  const handleLocalPncpParse = () => {
    if (!pastedPNCP.trim()) {
      showToast.warning(
        "Texto vazio",
        "Cole o texto da licitação do PNCP para extrair os dados."
      );
      return;
    }
    
    setParsingLoading(true);
    try {
      const data = parsePncpClipboardText(pastedPNCP);
      
      setNewEdital(data.edital || "Aviso de Contratação");
      setNewOrgao(data.orgao || "Órgão Não Informado");
      setNewUnidadeCompradora(data.unidadeCompradora || "");
      setNewModalidade(data.modalidade || "Dispensa");
      setNewAmparoLegal(data.amparoLegal || "");
      setNewModoDisputa(data.modoDisputa || "");
      setNewIdPncp(data.idPncp || "");
      setNewObjeto(data.objeto || "");
      setNewValorEstimado(data.valorEstimado || 0);
      setNewCidade(data.cidade || "Juazeiro");
      setNewEstado(data.estado || "BA");
      setNewInicioPropostas(data.dataInicio || "");
      setNewFimPropostas(data.dataFim || "");
      setNewItensPncp(data.itens || []);
      setNewArquivosPncp(data.arquivos || []);

      if (data.objeto) {
        const lowerObj = data.objeto.toLowerCase();
        if (lowerObj.includes("papelaria") || lowerObj.includes("suprimento") || lowerObj.includes("consumo") || lowerObj.includes("papel") || lowerObj.includes("tinta")) {
          setNewCategory("Materiais & Equipamentos");
        } else if (lowerObj.includes("software") || lowerObj.includes("computador") || lowerObj.includes("ti") || lowerObj.includes("tecnologia")) {
          setNewCategory("Tecnologia da Informação");
        } else if (lowerObj.includes("obra") || lowerObj.includes("reforma") || lowerObj.includes("construção") || lowerObj.includes("engenharia")) {
          setNewCategory("Obras & Engenharia");
        } else if (lowerObj.includes("limpeza") || lowerObj.includes("segurança") || lowerObj.includes("serviço")) {
          setNewCategory("Serviços Gerais");
        }
      }

      showToast.success(
        "Dados extraídos com sucesso!",
        `Encontrados ${data.itens?.length || 0} itens e ${data.arquivos?.length || 0} arquivos`
      );

      setAddModalTab("form");
    } catch (err) {
      console.error("Local parsing error:", err);
      showToast.error(
        "Erro ao processar texto",
        "Verifique se o texto copiado está completo e tente novamente."
      );
    } finally {
      setParsingLoading(false);
    }
  };

  const handleGeminiPncpScrape = async () => {
    if (!pastedPNCP.trim()) {
      showToast.warning(
        "Texto vazio",
        "Cole o texto copiado da página do PNCP para refinar com IA."
      );
      return;
    }
    
    setParsingLoading(true);
    const toastId = showToast.loading("Processando com IA (Gemini)...");
    
    try {
      const token = await getClientAuthToken();
      const res = await fetch("/api/licitacoes/scrape", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ rawText: pastedPNCP })
      });
      
      if (res.ok) {
        const resultObj = await res.json();
        if (resultObj.success && resultObj.data) {
          const d = resultObj.data;
          setNewEdital(d.edital || "Ficha PNCP Extratada");
          setNewOrgao(d.orgao || "Órgão Extratado");
          setNewModalidade(d.modalidade || "Dispensa");
          setNewObjeto(d.objeto || "");
          setNewValorEstimado(d.valorEstimado || 0);
          setNewCidade(d.cidade || "Juazeiro");
          setNewEstado(d.estado || "BA");
          setNewCategory(d.categoria || "Materiais & Equipamentos");
          if (d.arquivosPncp && d.arquivosPncp.length > 0) {
            setNewArquivosPncp(d.arquivosPncp);
          }
          
          const localD = parsePncpClipboardText(pastedPNCP);
          if (localD.unidadeCompradora) setNewUnidadeCompradora(localD.unidadeCompradora);
          if (localD.amparoLegal) setNewAmparoLegal(localD.amparoLegal);
          if (localD.idPncp) setNewIdPncp(localD.idPncp);
          if (localD.modoDisputa) setNewModoDisputa(localD.modoDisputa);
          if (localD.dataInicio) setNewInicioPropostas(localD.dataInicio);
          if (localD.dataFim) setNewFimPropostas(localD.dataFim);
          if (localD.itens && localD.itens.length > 0) setNewItensPncp(localD.itens);
          if ((!d.arquivosPncp || d.arquivosPncp.length === 0) && localD.arquivos && localD.arquivos.length > 0) {
            setNewArquivosPncp(localD.arquivos);
          }
          
          showToast.success(
            "IA concluiu a análise!",
            `Dados extraídos com sucesso pela IA.`,
            { id: toastId }
          );
          
          setAddModalTab("form");
        } else {
          showToast.warning("IA não retornou dados", "Usando fallback local.", { id: toastId });
          handleLocalPncpParse();
        }
      } else {
        showToast.warning("Erro na IA", "Usando fallback local.", { id: toastId });
        handleLocalPncpParse();
      }
    } catch (err) {
      console.error("Gemini scrape failure, trying local parser:", err);
      showToast.warning("Erro na IA", "Usando fallback local.", { id: toastId });
      handleLocalPncpParse();
    } finally {
      setParsingLoading(false);
    }
  };

  const handleCreateLicitacao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEdital.trim() || !newOrgao.trim()) {
      showToast.warning(
        "Campos obrigatórios",
        "Preencha o Edital e o Órgão para continuar."
      );
      return;
    }

    const newId = "lic-" + Date.now();
    const uid = user ? user.uid : "guest-user";

    const parsedSessionDate = parseBrazilianDateToISO(newFimPropostas);

    const newItem: Licitacao = {
      id: newId,
      userId: uid,
      edital: newEdital,
      orgao: newOrgao,
      modalidade: newModalidade,
      objeto: newObjeto || "",
      valorEstimado: newValorEstimado || 0,
      dataSessao: parsedSessionDate,
      cidade: newCidade || "",
      estado: newEstado || "",
      categoria: newCategory,
      status: "Triagem",
      checklist: [],
      suppliers: [],
      competitors: [],
      alerts: [],
      historicStatus: [
        { 
          status: "Triagem", 
          timestamp: new Date().toISOString(), 
          notes: "Licitação oficial cadastrada no sistema sob monitoramento.", 
          userId: uid 
        }
      ],
      idContratacaoPncp: newIdPncp,
      amparoLegal: newAmparoLegal,
      unidadeCompradora: newUnidadeCompradora,
      modoDisputa: newModoDisputa,
      dataInicioPropostas: newInicioPropostas,
      dataFimPropostas: newFimPropostas,
      pncpRawText: pastedPNCP,
      itensPncp: newItensPncp,
      arquivosPncp: newArquivosPncp,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(newItem);

    showToast.success(
      "Licitação cadastrada!",
      `${newEdital} - ${newOrgao} (${newItensPncp.length} itens)`
    );

    // Reset inputs
    setNewEdital("");
    setNewOrgao("");
    setNewModalidade("Dispensa");
    setNewCategory("Tecnologia da Informação");
    setNewUnidadeCompradora("");
    setNewAmparoLegal("");
    setNewIdPncp("");
    setNewModoDisputa("");
    setNewObjeto("");
    setNewValorEstimado(0);
    setNewCidade("");
    setNewEstado("");
    setNewInicioPropostas("");
    setNewFimPropostas("");
    setNewItensPncp([]);
    setNewArquivosPncp([]);
    setPastedPNCP("");
    setAddModalTab("paste");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
        <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              Rastrear Licença / Ficha PNCP
            </h3>
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest leading-none mt-0.5">
              Portal Nacional de Contratações Públicas
            </p>
          </div>
          <button 
            type="button"
            onClick={() => {
              setPastedPNCP("");
              setNewItensPncp([]);
              onClose();
            }}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

        <div className="flex border-b border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setAddModalTab("paste")}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 text-center transition flex justify-center items-center gap-1.5 cursor-pointer ${
              addModalTab === "paste" 
                ? "border-blue-600 text-blue-600 bg-white" 
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <PlusCircle className="w-4 h-4 text-blue-500" />
            Colar Texto do PNCP (Inteligente)
          </button>
          <button
            type="button"
            onClick={() => setAddModalTab("form")}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 text-center transition flex justify-center items-center gap-1.5 cursor-pointer ${
              addModalTab === "form" 
                ? "border-blue-600 text-blue-600 bg-white" 
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Settings className="w-4 h-4 text-emerald-500" />
            Ficha de Cadastro Manual ({newItensPncp.length} itens)
          </button>
        </div>

        {addModalTab === "paste" ? (
          <div className="p-6 space-y-4">
            <div className="bg-blue-50/40 border border-blue-100/60 rounded-xl p-4 text-xs text-blue-900 leading-relaxed font-sans">
              <span className="font-bold block mb-1">Como utilizar a Importação Direta:</span>
              <ol className="list-decimal pl-4 space-y-1 text-slate-650 font-sans text-xs">
                <li>Acesse o edital ou aviso de contratação no portal do <strong>PNCP</strong>.</li>
                <li>Pressione <kbd className="bg-white border px-1 rounded shadow-none text-[10px]">Ctrl+A</kbd> e depois <kbd className="bg-white border px-1 rounded shadow-none text-[10px]">Ctrl+C</kbd> para copiar todo o texto da página da licitação.</li>
                <li>Cole inteiramente no campo de texto abaixo e clique em <strong>Processar Ficha PNCP</strong>.</li>
              </ol>
              <p className="text-[9.5px] text-amber-800 bg-amber-50 rounded border border-amber-100 mt-3 p-2 font-medium font-sans">
                ⚠️ <strong>Nota Preventiva Legal:</strong> Os lotes, valores de referência, anexos e regras extraídos por este motor têm finalidade administrativa de rascunho de preenchimento. Cabe exclusivamente ao licitante auditar o teor dos campos em face do edital oficial antes de concluir a gravação da proposta.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Texto Copiado do PNCP</label>
              <textarea
                rows={8}
                placeholder="Cole aqui o texto copiado da página do PNCP (Ex: 'Portal Nacional de Contratações Públicas... Aviso de Contratação Direta nº PCE1123...') o motor irá decodificar os blocos de dados e inclusive a tabela de lotes de itens organizados!"
                className="w-full text-xs font-sans text-slate-850 p-3 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white bg-slate-50 transition font-medium leading-relaxed"
                value={pastedPNCP}
                onChange={(e) => setPastedPNCP(e.target.value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                disabled={parsingLoading || !pastedPNCP.trim()}
                onClick={handleLocalPncpParse}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {parsingLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Processando...
                  </>
                ) : (
                  <>
                    ⚙️ Processar Ficha PNCP
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={parsingLoading || !pastedPNCP.trim()}
                onClick={handleGeminiPncpScrape}
                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-300 disabled:to-indigo-300 text-white text-xs font-bold rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {parsingLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Chamando Inteligência Artificial...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse text-yellow-300" /> Enriquecer com IA (Gemini)
                  </>
                )}
              </button>
            </div>

            {pastedPNCP && (
              <p className="text-[10px] text-slate-400 text-center font-medium font-sans">
                Preenchimento em tempo de execução 100% integrado com a tabela de fornecedores e cotações.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleCreateLicitacao} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="text-xs bg-amber-50/60 border border-amber-100 rounded-xl p-3 text-amber-900 font-sans">
              ⚠️ <strong>Revisão dos campos:</strong> Verifique se os dados extraídos automaticamente estão corretos antes de salvar. Você também pode digitar qualquer campo individualmente.
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-150">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">1. Órgão Licitante e Comprador</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-sans">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-sans">Órgão Público Responsável *</label>
                  <input
                    type="text"
                    placeholder="Ex: UNIVERSIDADE DO ESTADO DA BAHIA"
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                    value={newOrgao}
                    onChange={(e) => setNewOrgao(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-sans">Unidade Compradora</label>
                  <input
                    type="text"
                    placeholder="Ex: DEPARTAMENTO DE TECNOLOGIA E CIENCIAS SOCIAIS"
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                    value={newUnidadeCompradora}
                    onChange={(e) => setNewUnidadeCompradora(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 font-sans">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-sans">Local / Cidade *</label>
                  <input
                    type="text"
                    placeholder="Ex: Juazeiro"
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                    value={newCidade}
                    onChange={(e) => setNewCidade(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-sans">Estado / UF *</label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="BA"
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white uppercase"
                    value={newEstado}
                    onChange={(e) => setNewEstado(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-150">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">2. Identificação e Amparo Legal (PNCP)</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-sans">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-sans">Identificação / Nº Edital *</label>
                  <input
                    type="text"
                    placeholder="Ex: Aviso de Contratação Direta nº PCE112302026/2026"
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                    value={newEdital}
                    onChange={(e) => setNewEdital(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-sans">ID Contratação PNCP</label>
                  <input
                    type="text"
                    placeholder="Ex: 14485841000140-1-001269/2026"
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                    value={newIdPncp}
                    onChange={(e) => setNewIdPncp(e.target.value)}
                  />
                </div>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-sans">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-sans">Modalidade da Contratação</label>
                  <select
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                    value={newModalidade}
                    onChange={(e) => setNewModalidade(e.target.value)}
                  >
                    <option value="Dispensa">Dispensa</option>
                    <option value="Inexigibilidade">Inexigibilidade</option>
                    <option value="Pregão Eletrônico">Pregão Eletrônico</option>
                    <option value="Pregão Presencial">Pregão Presencial</option>
                    <option value="Concorrência">Concorrência</option>
                    <option value="Tomada de Preços">Tomada de Preços</option>
                    <option value="Diálogo Competitivo">Diálogo Competitivo</option>
                    <option value="Leilão">Leilão</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-sans">Amparo Legal da Contratação</label>
                  <input
                    type="text"
                    placeholder="Ex: Lei 14.133/2021, Art. 75, II"
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                    value={newAmparoLegal}
                    onChange={(e) => setNewAmparoLegal(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-sans">Modo de Disputa</label>
                  <input
                    type="text"
                    placeholder="Ex: Dispensa com Disputa"
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                    value={newModoDisputa}
                    onChange={(e) => setNewModoDisputa(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-150 font-sans">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">3. Descrição do Objeto & Valores</h4>
              
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-sans">Objeto Licitado (Resumo ou Detalhado) *</label>
                <textarea
                  rows={3}
                  placeholder="Ex: AQUISIÇÃO DE MATERIAL DE CONSUMO DE PAPELARIA A FAVOR DA UNEB..."
                  className="w-full text-xs font-sans text-slate-800 p-2 border border-slate-200 bg-white rounded-lg"
                  value={newObjeto}
                  onChange={(e) => setNewObjeto(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-sans">Valor Total Estimado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 2402.99"
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white font-sans"
                    value={newValorEstimado || ""}
                    onChange={(e) => setNewValorEstimado(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-sans">Segmento de Categoria</label>
                  <select
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white font-sans"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  >
                    {CATEGORIAS_LICITACAO.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-150">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">4. Janela de Envio de Propostas</h4>
              
              <div className="grid grid-cols-2 gap-3 font-sans">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-sans">Início Recebimento de Propostas</label>
                  <input
                    type="text"
                    placeholder="Ex: 17/06/2026 14:30"
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white font-sans"
                    value={newInicioPropostas}
                    onChange={(e) => setNewInicioPropostas(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-sans">Fim Recebimento (Sessão Pública)</label>
                  <input
                    type="text"
                    placeholder="Ex: 17/06/2026 16:30"
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white font-sans"
                    value={newFimPropostas}
                    onChange={(e) => setNewFimPropostas(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {newItensPncp.length > 0 && (
              <div className="bg-blue-50/20 border border-blue-105 p-4 rounded-xl space-y-2">
                <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center justify-between font-sans">
                  <span>5. Itens e Lotes Extraídos do PNCP ({newItensPncp.length})</span>
                  <span className="text-[9px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-black font-sans">Mapeado para Cotações</span>
                </h4>
                
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 pr-1">
                  {newItensPncp.map((it, i) => (
                    <div key={i} className="py-2 text-[11px] leading-normal font-sans">
                      <div className="flex justify-between font-bold text-slate-800 font-sans">
                        <span>Item #{it.numero}</span>
                        <span className="text-blue-700 font-bold font-sans">R$ {it.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <p className="text-slate-600 font-medium text-xs mt-0.5 leading-snug font-sans">{it.descricao}</p>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Quantidade: {it.quantidade} | Estimativa Unitária: R$ {it.valorUnitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 flex gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAddModalTab("paste")}
                className="py-2.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Voltar para Ajuste de Texto
              </button>

              <div className="flex-1" />

              <button
                type="button"
                onClick={() => {
                  setPastedPNCP("");
                  setNewItensPncp([]);
                  onClose();
                }}
                className="py-2.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="py-2.5 px-8 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-650/10 cursor-pointer text-center"
              >
                Salvar & Rastrear no Painel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}