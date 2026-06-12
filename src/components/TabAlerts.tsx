import React from "react";
import { Licitacao } from "../types";
import { Bell, MessageSquare, Mail, Check } from "lucide-react";

interface TabProps {
  licitacao: Licitacao;
}

export default function TabAlerts({ licitacao }: TabProps) {
  return (
    <div className="p-6">
      <div className="border-b border-gray-100 pb-4 mb-6">
        <h3 className="font-bold text-gray-900 text-lg">Central de Notificações Inteligente</h3>
        <p className="text-xs text-gray-500">Controle de prazos de editais e impugnações para evitar perda de prazos com notificações push integradas ao e-mail e WhatsApp.</p>
      </div>

      <div className="bg-slate-50 p-5 rounded-2xl border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-3">
          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-gray-900 text-sm">Disparadores Ativos para {licitacao.edital}</h4>
            <p className="text-xs text-gray-500 mt-0.5">Total de alertas ativos programados para o cronograma regulamentar desta licitação.</p>
          </div>
        </div>

        <div className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3.5 py-1.5 rounded-full shrink-0">
          {licitacao.alerts.length} Disparadores
        </div>
      </div>

      {/* Direct visualization table of upcoming reminders */}
      {licitacao.alerts.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-lg">
          <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2 animate-bounce" />
          <p className="text-sm font-semibold text-gray-650">Nenhum lembrete para esta licitação</p>
          <p className="text-xs text-gray-400 mt-1">Utilize a Central de Alertas Inteligentes no cabeçalho ou preencha o formulário geral.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {licitacao.alerts.map((al) => (
            <div key={al.id} className="p-4 bg-white border border-gray-100 rounded-xl flex justify-between items-center hover:border-slate-200 transition">
              <div className="flex gap-3 items-start">
                <div className={`p-2 rounded-lg shrink-0 ${al.type === "whatsapp" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"}`}>
                  {al.type === "whatsapp" ? <MessageSquare className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                </div>
                <div>
                  <h5 className="font-bold text-gray-900 text-sm">{al.title}</h5>
                  <p className="text-xs text-gray-600 mt-0.5 font-mono">{al.content}</p>
                  <span className="text-[10px] text-gray-400 mt-1 block">Dispachado em: {new Date(al.triggerDate).toLocaleString("pt-BR")}</span>
                </div>
              </div>

              {al.testSent && (
                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 shrink-0">
                  <Check className="w-4 h-4" /> Enviado
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
