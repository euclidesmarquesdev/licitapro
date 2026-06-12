import React, { useState } from "react";
import { SmartNotification, Licitacao } from "../types";
import { Bell, Mail, MessageSquare, Check, Trash2, Calendar, Sparkles } from "lucide-react";

interface AlertsManagerProps {
  licitacoes: Licitacao[];
  onTriggerAlert: (licitacaoId: string, alertId: string) => void;
  onDeleteAlert: (licitacaoId: string, alertId: string) => void;
  onAddAlert: (licitacaoId: string, alert: SmartNotification) => void;
}

export default function AlertsManager({
  licitacoes,
  onTriggerAlert,
  onDeleteAlert,
  onAddAlert
}: AlertsManagerProps) {
  const [selectedLicitacaoId, setSelectedLicitacaoId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<"email" | "whatsapp">("whatsapp");
  const [newDate, setNewDate] = useState("");

  // Gather all alerts from all active biddings
  const allAlerts = licitacoes.flatMap(lic => 
    lic.alerts.map(alert => ({
      ...alert,
      licitacaoTitle: lic.edital,
      licitacaoId: lic.id,
      orgao: lic.orgao,
      dataSessao: lic.dataSessao
    }))
  ).sort((a, b) => new Date(a.triggerDate).getTime() - new Date(b.triggerDate).getTime());

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLicitacaoId || !newTitle || !newContent || !newDate) return;

    const alert: SmartNotification = {
      id: "a-" + Date.now(),
      type: newType,
      title: newTitle,
      content: newContent,
      triggerDate: newDate,
      sent: false
    };

    onAddAlert(selectedLicitacaoId, alert);
    setNewTitle("");
    setNewContent("");
    setNewDate("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Simulation/Creation Panel */}
      <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-indigo-600" />
          Configurar Novo Alerta
        </h3>
        
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Selecionar Licitação</label>
            <select
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 focus:bg-white outline-none"
              value={selectedLicitacaoId}
              onChange={(e) => setSelectedLicitacaoId(e.target.value)}
              required
            >
              <option value="">-- Escolha a Licitação --</option>
              {licitacoes.map(lic => (
                <option key={lic.id} value={lic.id}>
                  {lic.edital} - {lic.orgao.substring(0, 30)}...
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Canal</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewType("whatsapp")}
                  className={`py-2 text-sm rounded-lg flex items-center justify-center gap-2 border transition ${
                    newType === "whatsapp" 
                      ? "bg-emerald-50 border-emerald-500 text-emerald-800 font-medium" 
                      : "bg-white border-gray-200 text-gray-600"
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setNewType("email")}
                  className={`py-2 text-sm rounded-lg flex items-center justify-center gap-2 border transition ${
                    newType === "email" 
                      ? "bg-indigo-50 border-indigo-500 text-indigo-800 font-medium" 
                      : "bg-white border-gray-200 text-gray-600"
                  }`}
                >
                  <Mail className="w-4 h-4 text-indigo-600" />
                  E-mail
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Data/Hora Alerta</label>
              <input
                type="datetime-local"
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg p-2"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Assunto / Título</label>
            <input
              type="text"
              placeholder="Ex: Prazo de Habilitação do MEC"
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Mensagem de Alerta</label>
            <textarea
              placeholder="Escreva a mensagem com as instruções..."
              rows={3}
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
          >
            Adicionar à Agenda Inteligente
          </button>
        </form>
      </div>

      {/* Simulator Viewer Panel */}
      <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Notificações Ativas & Simulador
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Simule o disparo instantâneo das integrações para o seu email ou celular de teste.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold rounded-full">
            {allAlerts.length} Agendados
          </span>
        </div>

        {allAlerts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 border border-dashed border-gray-200 rounded-lg bg-gray-50 text-center">
            <Bell className="w-10 h-10 text-gray-300 mb-2" />
            <p className="text-sm font-medium text-gray-600">Nenhum alerta configurado ainda</p>
            <p className="text-xs text-gray-400 mt-1 max-w-[280px]">
              Selecione uma licitação e preencha as regras ao lado para criar alertas inteligentes de prazo.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
            {allAlerts.map((alert) => (
              <div 
                key={`${alert.licitacaoId}-${alert.id}`} 
                className={`p-4 rounded-xl border transition ${
                  alert.testSent 
                    ? "bg-slate-50 border-slate-200 opacity-80" 
                    : alert.type === "whatsapp" 
                    ? "bg-emerald-50/40 border-emerald-100" 
                    : "bg-indigo-50/40 border-indigo-100"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      alert.type === "whatsapp" ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800"
                    }`}>
                      {alert.type === "whatsapp" ? <MessageSquare className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 tracking-wide uppercase">
                          {alert.type === "whatsapp" ? "WhatsApp push" : "E-mail alert"}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-xs font-semibold text-gray-700">{alert.licitacaoTitle}</span>
                      </div>
                      <h4 className="font-semibold text-gray-900 text-sm mt-1">{alert.title}</h4>
                      <p className="text-xs text-gray-600 mt-1 bg-white p-2 rounded border border-gray-100 font-mono">
                        {alert.content}
                      </p>
                      
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Agendado: {new Date(alert.triggerDate).toLocaleString("pt-BR")}
                        </span>
                        {alert.testSent && (
                          <span className="text-xs text-emerald-600 font-medium flex items-center gap-0.5">
                            <Check className="w-3.5 h-3.5" /> Disparado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    {!alert.testSent && (
                      <button
                        onClick={() => onTriggerAlert(alert.licitacaoId, alert.id)}
                        className="text-xs font-semibold px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-blue-600 rounded-lg shadow-sm transition flex items-center gap-1 cursor-pointer"
                        title="Simular entrega agora"
                      >
                        Enviar Teste
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja excluir o alerta "${alert.title}"?`)) {
                          onDeleteAlert(alert.licitacaoId, alert.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Excluir Alerta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
