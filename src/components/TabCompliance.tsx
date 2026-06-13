import React, { useState, useEffect } from "react";
import { Licitacao, SupplierContact } from "../types";
import { 
  ShieldCheck, Scale, Info, Calculator, AlertTriangle, RefreshCw, Database 
} from "lucide-react";
import { auth } from "../firebase";

interface TabProps {
  licitacao: Licitacao;
  activeSuppliers: SupplierContact[];
  valorEstimado: number;
  formatCurrency: (val: number) => string;
  activeQuoteSum: number;
}

interface AIAuditLog {
  id: string;
  timestamp: string;
  endpoint: string;
  payload: any;
  response: any;
  isMock: boolean;
  signature: string;
}

export default function TabCompliance({
  licitacao,
  activeSuppliers,
  valorEstimado,
  formatCurrency,
  activeQuoteSum
}: TabProps) {
  // Simulator local states
  const [simIsMeEpp, setSimIsMeEpp] = useState(true);
  const [simModalidade, setSimModalidade] = useState<"pregao" | "concorrencia">("pregao");
  const [simLeaderBidText, setSimLeaderBidText] = useState("");
  const [simOurBidText, setSimOurBidText] = useState("");

  const [auditLogs, setAuditLogs] = useState<AIAuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchAuditLogs = async () => {
    try {
      setLogsLoading(true);
      const currentUser = auth.currentUser;
      const token = currentUser ? await currentUser.getIdToken() : "";
      const res = await fetch("/api/ia/audit/history", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.logs) {
          setAuditLogs(data.logs);
        }
      }
    } catch (err) {
      console.warn("Falha ao obter logs de auditoria de IA:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [licitacao.id]);

  const downloadLogsAsJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `licitapro-ia-audit-logs-${licitacao.id || "geral"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const modalidadeSim = simModalidade.includes("pregao") ? "pregao" : "concorrencia";

  return (
    <div className="p-6">
      <div className="border-b border-gray-100 pb-4 mb-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-gray-900 text-lg">Compliance Legal & Regulamentar (Lei 14.133/2021)</h3>
        </div>
        <p className="text-xs text-gray-500">Validador de conformidade e simuladores de margem sob as novas Instruções Normativas federais e Lei Complementar 123/2006.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Columns - Simulator & Validador */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* 1. SIMULADOR DE EMPATE FICTO ME/EPP (LC 123) */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600 animate-pulse" />
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-sans">Simulador de Empate Ficto & Margem de Preferência (LC 123/06)</h4>
              </div>
              <span className="text-[9px] bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded font-bold uppercase">Lei 14.133</span>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] text-slate-605 leading-relaxed font-semibold">
                <strong>Benefício Legal:</strong> No sistema da BLL Compras e sob a Lei Complementar 123/06, se a sua empresa for <strong>ME/EPP</strong> e sua proposta final ficar na margem de empate ficto em relação ao concorrente líder (não ME/EPP), você tem o direito legal de fazer um lance de desempate e faturar o lote!
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Enquadramento da Sua Empresa</label>
                  <select
                    className="w-full text-xs bg-white border border-gray-200 rounded p-2.5 outline-none focus:ring-1 focus:ring-amber-500 font-bold text-slate-800 cursor-pointer"
                    value={simIsMeEpp ? "me_epp" : "grande"}
                    onChange={(e) => setSimIsMeEpp(e.target.value === "me_epp")}
                  >
                    <option value="me_epp">Microempresa (ME) / Empresa Pequeno Porte (EPP)</option>
                    <option value="grande">Grande Empresa (Sem preferência legal LC 123)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Modalidade / Margem de Tolerância</label>
                  <select
                    className="w-full text-xs bg-white border border-gray-200 rounded p-2.5 outline-none focus:ring-1 focus:ring-amber-500 font-bold text-slate-800 cursor-pointer"
                    value={modalidadeSim}
                    onChange={(e) => setSimModalidade(e.target.value as any)}
                  >
                    <option value="pregao">Pregão Eletrônico ou Dispensa (Margem de 5%)</option>
                    <option value="concorrencia">Concorrência Pública (Margem de 10%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Menor Lance Concorrente (Grande Empresa)</label>
                  <div className="relative font-sans">
                    <span className="absolute left-2.5 top-2.5 text-slate-400 font-bold text-[11px]">R$</span>
                    <input
                      type="number"
                      placeholder="Ex: 100000"
                      className="w-full text-xs bg-white border border-gray-200 rounded p-2.5 pl-8 outline-none focus:ring-1 focus:ring-amber-500 font-bold text-slate-800"
                      value={simLeaderBidText}
                      onChange={(e) => setSimLeaderBidText(e.target.value)}
                    />
                  </div>
                  <span className="text-[9.5px] text-slate-400 mt-1 block">
                    {licitacao.competitors.length > 0 
                      ? `Auto-detecção: Menor lance cadastrado nas lances concorrentes é de R$ ${Math.min(...licitacao.competitors.map(c => c.bidValue))}`
                      : "Nenhum lance de concorrente registrado ainda."
                    }
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Seu Lance Ofertado (R$)</label>
                  <div className="relative font-sans">
                    <span className="absolute left-2.5 top-2.5 text-slate-400 font-bold text-[11px]">R$</span>
                    <input
                      type="number"
                      placeholder="Ex: 103000"
                      className="w-full text-xs bg-white border border-gray-200 rounded p-2.5 pl-8 outline-none focus:ring-1 focus:ring-amber-500 font-bold text-slate-800"
                      value={simOurBidText}
                      onChange={(e) => setSimOurBidText(e.target.value)}
                    />
                  </div>
                  <span className="text-[9.5px] text-slate-400 mt-1 block">
                    Auto-detecção: Sua cotação total ativa acumulada é de {formatCurrency(activeQuoteSum)}.
                  </span>
                </div>
              </div>

              {/* Resulting calculations outputs */}
              {(() => {
                const lowestComp = licitacao.competitors.length > 0 
                  ? Math.min(...licitacao.competitors.map(c => c.bidValue)) 
                  : 0;
                const leaderBid = simLeaderBidText !== "" ? Number(simLeaderBidText) : lowestComp;
                const ourBid = simOurBidText !== "" ? Number(simOurBidText) : activeQuoteSum;
                
                if (leaderBid <= 0) {
                  return (
                    <div className="bg-slate-50 border border-slate-250 p-4 rounded-xl text-center">
                      <Info className="w-5 h-5 text-slate-400 mx-auto mb-1 animate-pulse" />
                      <p className="text-xs font-bold text-slate-650">Insira ou configure um Menor Lance Concorrente para rodar a simulação.</p>
                    </div>
                  );
                }

                const marginFactor = modalidadeSim === "pregao" ? 0.05 : 0.10;
                const tetoEmpate = leaderBid * (1 + marginFactor);
                const isUnderTeto = ourBid <= tetoEmpate;
                const isDirectWinner = ourBid < leaderBid;

                return (
                  <div className="border border-slate-150 rounded-xl overflow-hidden mt-2 font-sans">
                    <div className="bg-slate-50 p-3.5 border-b border-slate-150 grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Margem Adicional (+{(marginFactor*100).toFixed(0)}%)</span>
                        <span className="text-xs font-black text-slate-700">{formatCurrency(leaderBid * marginFactor)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Valor Limite p/ Empate</span>
                        <span className="text-sm font-black text-amber-600 font-mono">{formatCurrency(tetoEmpate)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Diferença do seu lance</span>
                        <span className={`text-xs font-black ${isUnderTeto ? "text-emerald-600" : "text-rose-500"}`}>
                          {isUnderTeto ? "Dentro da Margem!" : `${(((ourBid - leaderBid) / leaderBid) * 100).toFixed(1)}% acima do líder`}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-white">
                      {!simIsMeEpp ? (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs flex gap-2.5">
                          <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                          <div>
                            <h5 className="font-extrabold text-slate-950">Empresa não optante por enquadramento ME/EPP</h5>
                            <p className="text-[11px] text-slate-550 mt-0.5 leading-relaxed">
                              Por estar cadastrado como Grande Empresa, você não usufruirá com prioridade do desempate ficto da Lei Complementar 123/2006. Para faturar este lote na BLL Compras, você deve igualar ou bater o menor lance concorrente diretamente de <strong>{formatCurrency(leaderBid)}</strong> na fase eletrônica aberta.
                            </p>
                          </div>
                        </div>
                      ) : isDirectWinner ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-250 rounded-lg text-emerald-800 text-xs flex gap-2.5">
                          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <h5 className="font-extrabold text-emerald-900">👑 Vencedor Direto Provisório!</h5>
                            <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
                              Sua proposta de <strong>{formatCurrency(ourBid)}</strong> já é inferior ao menor lance concorrente de <strong>{formatCurrency(leaderBid)}</strong>. Você está ganhando o certame sem necessidade de preferência legal de desempate!
                            </p>
                          </div>
                        </div>
                      ) : isUnderTeto ? (
                        <div className="p-4 bg-emerald-50 border border-emerald-305 rounded-xl text-emerald-805 text-xs flex gap-3">
                          <Scale className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <h5 className="font-black text-emerald-900 text-sm">✅ EM FAIXA DE EMPATE FICTO LC 123/06!</h5>
                            <p className="text-[11.5px] text-emerald-700 mt-1 leading-relaxed">
                              Sua oferta de <strong>{formatCurrency(ourBid)}</strong> está dentro da margem de preferência (+{(marginFactor*100).toFixed(0)}%) em relação ao menor lance do mercado (<strong>{formatCurrency(leaderBid)}</strong>).
                            </p>
                            <p className="text-[11px] text-emerald-600 mt-1.5 font-sans leading-relaxed">
                              <strong>Ação Prática BLL:</strong> No momento do desempate, o sistema BLL Compras notificará sua empresa para exercer o direito de preferência. Você poderá lançar o valor de <strong>{formatCurrency(leaderBid - 0.01)}</strong> e tomar o certame do concorrente líder legalmente!
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex gap-3">
                          <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
                          <div>
                            <h5 className="font-black text-rose-900 text-sm">❌ FORA DA MARGEM DE EMPATE LEGAL</h5>
                            <p className="text-[11.5px] text-rose-700 mt-1 leading-relaxed">
                              Seu lance atual de <strong>{formatCurrency(ourBid)}</strong> supera o limite de preferência de <strong>{formatCurrency(tetoEmpate)}</strong> (máximo de {(marginFactor*100).toFixed(0)}% acima do líder concorrente).
                            </p>
                            <p className="text-[11px] text-rose-650 mt-1.5 leading-relaxed font-sans">
                              <strong>Recomendação:</strong> Na fase viva de lances, considere otimizar sua margem e reduzir sua proposta para no máximo <strong>{formatCurrency(tetoEmpate)}</strong>. Desta forma, você ativa o direito de empatar ficitamente e faturar o pregão com prioridade de microempresa!
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 2. VALIDADOR DE PESQUISA DE PREÇOS (IN 65/2021) */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs font-sans">
            <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-indigo-650" />
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Métrica de Pesquisa de Preços & Coerência Estatística (IN 65/2021)</h4>
              </div>
              <span className="text-[9px] bg-indigo-100 text-indigo-900 px-2.5 py-0.5 rounded font-bold uppercase font-sans">Auditoria Reguladora</span>
            </div>

            <div className="p-5">
              {(() => {
                // Calculate stats on our cotações
                const pricedSups = activeSuppliers.map(sup => {
                  const totalVal = (licitacao.itensPncp || []).reduce((acc, curr) => {
                    const p = sup.itemPrices?.[curr.numero] || 0;
                    return acc + (p * (curr.quantidade || 1));
                  }, 0);
                  return { ...sup, totalVal };
                }).filter(s => s.totalVal > 0);

                const quotesCount = pricedSups.length;
                const quotesValues = pricedSups.map(s => s.totalVal);
                
                const quotesMean = quotesCount > 0 ? quotesValues.reduce((a, b) => a + b, 0) / quotesCount : 0;
                const quotesMin = quotesCount > 0 ? Math.min(...quotesValues) : 0;
                const quotesMax = quotesCount > 0 ? Math.max(...quotesValues) : 0;
                
                const quotesMedian = (() => {
                  if (quotesCount === 0) return 0;
                  const sorted = [...quotesValues].sort((a, b) => a - b);
                  const mid = Math.floor(quotesCount / 2);
                  return quotesCount % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
                })();

                // Standard Deviation
                const quotesSD = (() => {
                  if (quotesCount <= 1) return 0;
                  const variance = quotesValues.reduce((acc, val) => acc + Math.pow(val - quotesMean, 2), 0) / (quotesCount - 1);
                  return Math.sqrt(variance);
                })();

                // Coefficient of Variation (%)
                const quotesCV = quotesMean > 0 ? (quotesSD / quotesMean) * 100 : 0;

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Left Box: Amostragem validation */}
                      <div className={`p-4 border rounded-xl flex gap-3 ${quotesCount >= 3 ? "bg-emerald-50/50 border-emerald-200 text-emerald-950" : "bg-amber-50/50 border-amber-200 text-amber-955"}`}>
                        <div className="shrink-0 mt-0.5">
                          {quotesCount >= 3 ? (
                            <ShieldCheck className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                          )}
                        </div>
                        <div className="text-xs">
                          <h5 className="font-extrabold text-slate-850">Amostragem Mínima de Preços (Art. 6º)</h5>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed font-semibold">
                            A IN 65/2021 exige um <strong>mínimo de 3 fontes/pesquisas válidas</strong> para justificar o preço estimado da contratação pública brasileira.
                          </p>
                          <div className="mt-2 text-[10.5px] font-bold">
                            Seu Dossiê comercial: <strong className="bg-white/80 px-1.5 py-0.5 border rounded">{quotesCount} cotação(ões) ativa(s)</strong>
                          </div>
                          {quotesCount < 3 ? (
                            <p className="text-[10px] text-amber-800 font-bold mt-1.5 leading-tight">
                              ⚠️ Atenção: Para fins de conformidade legal de auditoria externa, cadastre mais {3 - quotesCount} cotação(ões) na aba de Fornecedores!
                            </p>
                          ) : (
                            <p className="text-[10px] text-emerald-800 font-bold mt-1.5 leading-tight">
                              🟢 Perfeito! Requisito formal de amostragem tri-setorial de preços atendido conforme a jurisprudência TCU.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right Box: Dispersion Analysis */}
                      <div className={`p-4 border rounded-xl flex gap-3 ${quotesCount <= 1 ? "bg-slate-50 border-slate-200" : quotesCV > 25 ? "bg-rose-50/55 border-rose-200 text-rose-955" : "bg-emerald-50/50 border-emerald-250 text-emerald-950"}`}>
                        <div className="shrink-0 mt-0.5">
                          {quotesCount <= 1 ? (
                            <Info className="w-5 h-5 text-slate-405" />
                          ) : quotesCV > 25 ? (
                            <AlertTriangle className="w-5 h-5 text-rose-600 animate-bounce" />
                          ) : (
                            <ShieldCheck className="w-5 h-5 text-emerald-600" />
                          )}
                        </div>
                        <div className="text-xs">
                          <h5 className="font-extrabold text-slate-850">Coeficiente de Variação (CV)</h5>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed font-semibold">
                            Avalia a homogeneidade de preços obtidos. Desvios <strong>superiores a 25%</strong> indicam lances desconexos ("outliers") que devem ser mitigados.
                          </p>
                          <div className="mt-2 text-[10.5px] font-bold">
                            Coeficiente CV: <strong className={`px-1.5 py-0.5 border rounded bg-white ${quotesCV > 25 ? "text-rose-600 font-black" : "text-emerald-700"}`}>{quotesCount > 1 ? `${quotesCV.toFixed(1)}%` : "Aguardando mais dados"}</strong>
                          </div>
                          {quotesCount <= 1 ? (
                            <p className="text-[10px] text-slate-450 mt-1.5 leading-tight">Gere valores em ao menos 2 fornecedores para calcular o desvio.</p>
                          ) : quotesCV > 25 ? (
                            <p className="text-[10px] text-rose-805 font-bold mt-1.5 leading-tight">
                              ⚠️ Alerta de Dispersão Crítica! Valores muito dispersos. Recomenda-se saneamento para desconsiderar lances abusivos e evitar distorcer o preço de referência.
                            </p>
                          ) : (
                            <p className="text-[10px] text-emerald-805 font-bold mt-1.5 leading-tight">
                              🟢 Excelente! Índice de variação saudável. Demonstra estabilidade concorrencial para aprovação.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats table sheet layout */}
                    {quotesCount > 0 && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden mt-4 bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold text-[10px] uppercase tracking-wider">
                              <th className="p-3">Métrica Estatística</th>
                              <th className="p-3 text-right">Valor Consolidado</th>
                              <th className="p-3">Reflexo Legal (IN 65/2021)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            <tr>
                              <td className="p-3 font-bold text-slate-800">Média Aritmética de Mercado</td>
                              <td className="p-3 text-right font-mono font-black text-indigo-700 text-sm">{formatCurrency(quotesMean)}</td>
                              <td className="p-3 text-slate-500 leading-normal font-sans">Garante o preço médio clássico de mercado governamental.</td>
                            </tr>
                            <tr>
                              <td className="p-3 font-bold text-slate-800">Média Mediana de Amostras</td>
                              <td className="p-3 text-right font-mono font-black text-slate-700 text-sm">{formatCurrency(quotesMedian)}</td>
                              <td className="p-3 text-slate-500 leading-normal font-sans">Indicado pela lei por anular distorções de valores extremos.</td>
                            </tr>
                            <tr>
                              <td className="p-3 font-bold text-slate-800">Menor Valor Fornecedor</td>
                              <td className="p-3 text-right font-mono font-black text-emerald-600 text-sm">{formatCurrency(quotesMin)}</td>
                              <td className="p-3 text-slate-500 leading-normal font-sans">Útil para embasar propostas de contratação direta rápida.</td>
                            </tr>
                            <tr>
                              <td className="p-3 font-bold text-slate-800">Maior Valor Ofertado</td>
                              <td className="p-3 text-right font-mono font-black text-slate-600 text-sm">{formatCurrency(quotesMax)}</td>
                              <td className="p-3 text-slate-500 leading-normal font-sans">Teto discrepante. Caso ultrapasse 25% do preço médio, pode ser rejeitado.</td>
                            </tr>
                            {quotesCount > 1 && (
                              <tr>
                                <td className="p-3 font-bold text-slate-800">Desvio Padrão Amostral (σ)</td>
                                <td className="p-3 text-right font-mono font-bold text-slate-705">{formatCurrency(quotesSD)}</td>
                                <td className="p-3 text-slate-500 leading-normal font-sans">Grau absoluto de variabilidade na matriz comercial.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

        </div>

        {/* Right Column - Legal Guidelines & Quick Cards */}
        <div className="xl:col-span-1 space-y-6">
          
          {/* LIMIAR DE DISPENSA ELETRÔNICA (IN 67) */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-1.5 font-sans">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-500 font-sans" />
              Dispensa Direta (IN 67/21)
            </h4>

            <div className="space-y-3 text-xs leading-relaxed font-sans">
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-semibold">Preço Estimado Edital:</span>
                <strong className="font-mono text-slate-800 text-sm font-black">{formatCurrency(valorEstimado)}</strong>
              </div>

              <div className="border border-slate-150 rounded-xl p-3 bg-white space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-400">LIMITE SERVIÇOS (Art 75, II):</span>
                  <span className="text-slate-700">R$ 59.906,02</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-400">LIMITE ENGENHARIA (Art 75, I):</span>
                  <span className="text-slate-700">R$ 119.812,04</span>
                </div>
              </div>

              {(() => {
                const isDispensaServicos = valorEstimado <= 59906.02;
                const isDispensaObras = valorEstimado <= 119812.04;

                if (isDispensaServicos) {
                  return (
                    <div className="bg-emerald-50 text-emerald-805 border border-emerald-250 p-3 rounded-xl text-[11px] leading-relaxed font-semibold">
                      <strong>🟢 Apto p/ Dispensa Eletrônica!</strong>
                      <p className="text-[10px] text-emerald-705 mt-1">Este edital se enquadra nos limites diretos de compras comuns (Art. 75, II) da Lei 14.133, permitindo contratação rápida sem necessidade de Pregão Completo.</p>
                    </div>
                  );
                } else if (isDispensaObras) {
                  return (
                    <div className="bg-amber-50 text-amber-805 border border-amber-250 p-3 rounded-xl text-[11px] leading-relaxed font-semibold">
                      <strong>🟡 Dispensa Restrita a Engenharia!</strong>
                      <p className="text-[10px] text-amber-705 mt-1">O valor estimado ultrapassa o limite de compras comuns, mas se enquadra no teto de Obras e Serviços de Engenharia (Art. 75, I, limite de R$ 119 mil).</p>
                    </div>
                  );
                } else {
                  return (
                    <div className="bg-rose-50/80 text-rose-805 border border-rose-250 p-3 rounded-xl text-[11px] leading-relaxed font-semibold">
                      <strong>⚠️ Pregão Completo Exigido</strong>
                      <p className="text-[10px] text-rose-705 mt-1">O valor estimado regulamentar ({formatCurrency(valorEstimado)}) supera os limites autorizados para Dispensa por Valor. Requer Pregão Eletrônico ou Concorrência na BLL.</p>
                    </div>
                  );
                }
              })()}
            </div>
          </div>

          {/* MINI GUIDE CHEAT SHEET CODES */}
          <div className="bg-slate-800 text-white rounded-2xl p-5 shadow-sm font-sans">
            <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Scale className="w-4.5 h-4.5 text-emerald-400 font-sans" />
              Legislação & Decretos BLL
            </h4>

            <div className="space-y-4 text-xs font-sans">
              <div className="border-b border-slate-700 pb-2.5">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] bg-slate-700 text-emerald-300 font-extrabold px-1.5 py-0.5 rounded uppercase">Lei 14.133/21</span>
                </div>
                <strong className="text-slate-150 block mt-1 font-sans font-semibold">Lei Geral de Licitações</strong>
                <p className="text-slate-350 text-[10px] mt-0.5 leading-relaxed font-normal">Substituiu formalmente a antiga Lei 8.666/93. Consolida o Pregão, Concorrência, Leilão, Diálogo Competitivo e as regra de dispensa eletrônica.</p>
              </div>

              <div className="border-b border-slate-700 pb-2.5">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] bg-slate-700 text-amber-300 font-extrabold px-1.5 py-0.5 rounded uppercase font-sans">Dec 11.461/23</span>
                </div>
                <strong className="text-slate-150 block mt-1 font-sans font-semibold">Leilão Eletrônico Federal</strong>
                <p className="text-slate-350 text-[10px] mt-0.5 leading-relaxed font-normal">Normatiza a alienação eletrônica de bens móveis ou imóveis governamentais inservíveis sob a modalidade Leilão, com regras estritas de disputa.</p>
              </div>

              <div className="border-b border-slate-700 pb-2.5">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] bg-slate-700 text-indigo-300 font-extrabold px-1.5 py-0.5 rounded uppercase">IN 58/2022</span>
                </div>
                <strong className="text-slate-150 block mt-1 font-sans font-semibold">Estudo Técnico Preliminar</strong>
                <p className="text-slate-350 text-[10px] mt-0.5 leading-relaxed font-normal font-sans">Dispõe sobre o ETP na fase interna da contratação pública, que justifica essencialmente a viabilidade técnica e socioeconômica da demanda.</p>
              </div>

              </div>
            </div>
          </div>

          {/* AI TRANSACTIONS AUDITING PLATFORM (NÍVEL PREMIUM SAAS VENDÁVEL) */}
          <div className="col-span-1 lg:col-span-3 mt-6 bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 shadow-sm font-sans">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
              <div>
                <h4 className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  Rastreabilidade IA: Livro de Auditoria de Algoritmos (Lei 14.133)
                </h4>
                <p className="text-slate-400 text-xs mt-1">
                  Registro criptografado de todas as transações consultivas efetuadas pelo LicitaPro Premium para fins de governança e defesas jurídicas.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  id="btn-refresh-audit-logs"
                  onClick={fetchAuditLogs}
                  disabled={logsLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 active:bg-slate-755 text-slate-100 rounded-lg transition-colors border border-slate-700 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? "animate-spin" : ""}`} />
                  {logsLoading ? "Sincronizando..." : "Atualizar logs"}
                </button>
                <button
                  type="button"
                  id="btn-download-audit-logs"
                  onClick={downloadLogsAsJson}
                  disabled={auditLogs.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-750 text-white rounded-lg transition-colors disabled:opacity-40"
                >
                  Exportar Livro (.JSON)
                </button>
              </div>
            </div>

            {auditLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                Nenhum log de IA registrado nesta sessão de trabalho. Execute o Scraper de Editais ou a Análise Preditiva para gerar registros biométricos de auditoria técnica.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {auditLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <div 
                      key={log.id} 
                      className="bg-slate-950/80 rounded-xl border border-slate-800 hover:border-slate-700 p-4 transition-colors font-sans"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-900/65 font-bold">
                            COMPLIANT
                          </span>
                          <span className="font-mono text-[10px] text-slate-200 font-bold">
                            {log.endpoint}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            • {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                            {log.isMock ? "Simulação de Resposta" : "Gemini Pro Active"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="text-[10px] text-emerald-400 hover:underline font-bold"
                          >
                            {isExpanded ? "Ocultar Estrutura [-]" : "Visualizar Payload [+]"}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row justify-between text-[10px] text-slate-400 mt-2 gap-1 font-mono">
                        <div>
                          <strong>ID:</strong> <span className="text-slate-300">{log.id}</span>
                        </div>
                        <div>
                          <strong>Assinatura Criptográfica:</strong> <span className="text-amber-400 font-extrabold">{log.signature}</span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 bg-slate-900 p-3 rounded-lg border border-slate-800 text-[10px] space-y-3 font-mono text-slate-300 max-h-64 overflow-y-auto">
                          <div>
                            <span className="text-emerald-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Enviado ao Motor de Linguagem (Payload):</span>
                            <pre className="bg-slate-950 p-2 rounded text-slate-300 whitespace-pre-wrap select-all max-h-36 overflow-y-auto">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <span className="text-sky-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Gabarito Retornado + Disclaimer de Amparo Legal:</span>
                            <pre className="bg-slate-950 p-2 rounded text-slate-200 whitespace-pre-wrap select-all max-h-36 overflow-y-auto">
                              {JSON.stringify(log.response, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
  );
}
