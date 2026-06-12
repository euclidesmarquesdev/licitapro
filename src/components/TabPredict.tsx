import React from "react";
import { Licitacao } from "../types";
import { Sparkles, RefreshCw, Users, Landmark, AlertTriangle } from "lucide-react";

interface TabProps {
  licitacao: Licitacao;
  isPredicting: boolean;
  handleAIPredict: () => Promise<void>;
}

export default function TabPredict({
  licitacao,
  isPredicting,
  handleAIPredict
}: TabProps) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 animate-spin" />
            Análise Preditiva de Concorrentes & Lances IA
          </h3>
          <p className="text-xs text-gray-500">
            O cérebro estratégico. A IA lê os seus concorrentes cadastrados, o valor orçado e gera uma recomendação tática ideal de lances públicos.
          </p>
        </div>
        <button
          onClick={handleAIPredict}
          disabled={isPredicting}
          className="py-2 px-5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          {isPredicting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Analisando Mercado gov...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Rodar Modelo Preditivo Gemini
            </>
          )}
        </button>
      </div>

      {!licitacao.predictiveCache ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50 text-center">
          <Sparkles className="w-10 h-10 text-emerald-400 animate-pulse mb-3" />
          <h4 className="font-bold text-gray-900 text-sm">Sem relatórios de inteligência salvos</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-sm">
            Clique no botão acima para analisar a concorrência e gerar o teto ideal de desconto, além de blindar a proposta contra desclassificações comuns.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* High level visual indicators cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 border border-gray-100 rounded-2xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Grau de Disputa</span>
              <div className="font-black text-indigo-700 text-xl tracking-tight mt-0.5">
                {licitacao.predictiveCache.level}
              </div>
            </div>
            <div className="bg-slate-50 p-4 border border-gray-100 rounded-2xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Margem de Desconto</span>
              <div className="font-black text-indigo-700 text-xl tracking-tight mt-0.5">
                {licitacao.predictiveCache.recommendedDiscount}
              </div>
            </div>
            <div className="bg-slate-50 p-4 border border-gray-100 rounded-2xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Preço-Alvo / Proposta</span>
              <div className="font-black text-emerald-600 text-xl tracking-tight mt-0.5 truncate">
                {licitacao.predictiveCache.targetPrice}
              </div>
            </div>
            <div className="bg-slate-50 p-4 border border-gray-100 rounded-2xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Sucesso Estimado</span>
              <div className="font-black text-indigo-700 text-xl tracking-tight mt-0.5">
                {licitacao.predictiveCache.winProbability}
              </div>
            </div>
          </div>

          {/* Insights & Actions Body */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="md:col-span-3 space-y-4">
              <div className="p-4 bg-white border border-gray-100 rounded-2xl">
                <h4 className="font-bold text-gray-900 text-sm mb-1.5 flex items-center gap-1.5 font-sans">
                  <Users className="w-4 h-4 text-indigo-500" />
                  Comportamento de Concorrentes Mapeado
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed font-sans font-medium">
                  {licitacao.predictiveCache.competitorInsights}
                </p>
              </div>

              <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl">
                <h4 className="font-bold text-indigo-900 text-sm mb-1.5 flex items-center gap-1.5 font-sans">
                  <Landmark className="w-4 h-4 text-indigo-600" />
                  Estratégia Recomendada p/ Sessão Pública
                </h4>
                <p className="text-xs text-indigo-950 leading-relaxed font-sans font-medium">
                  {licitacao.predictiveCache.strategy}
                </p>
              </div>
            </div>

            <div className="md:col-span-2 p-4 bg-rose-50/30 border border-rose-100 rounded-2xl">
              <h4 className="font-bold text-rose-900 text-sm mb-4 flex items-center gap-1.5 font-sans">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Gargalos & Riscos Técnicos Levantados
              </h4>
              <ul className="space-y-3">
                {licitacao.predictiveCache.risks.map((risk, index) => (
                  <li key={index} className="text-xs text-gray-700 flex gap-2 font-medium leading-relaxed">
                    <span className="text-rose-500 font-bold shrink-0">{index + 1}.</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
