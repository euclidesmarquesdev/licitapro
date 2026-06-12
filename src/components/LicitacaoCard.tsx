import React from "react";
import { Licitacao } from "../types";
import { STATUS_LICITACAO } from "../data";
import { Calendar, MapPin, Tag, TrendingUp, AlertTriangle, Eye, Trash2, Clock } from "lucide-react";

interface LicitacaoCardProps {
  key?: string;
  licitacao: Licitacao;
  onSelect: () => void;
  onDelete: () => void;
}

export default function LicitacaoCard({ licitacao, onSelect, onDelete }: LicitacaoCardProps) {
  const statusInfo = STATUS_LICITACAO.find(s => s.value === licitacao.status) || {
    bg: "bg-gray-100",
    text: "text-gray-800",
    label: licitacao.status
  };

  // Safe currency localization for Brazilian Real
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);
  };

  // Formatting date nicely
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Indefinida";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("pt-BR") + " às " + date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  // Determine if bidding is near (less than 3 days alert)
  const isNear = () => {
    if (!licitacao.dataSessao) return false;
    const diff = new Date(licitacao.dataSessao).getTime() - Date.now();
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
  };

  // Calculate remaining time
  const getRemainingTime = () => {
    if (!licitacao.dataSessao) return null;
    const diff = new Date(licitacao.dataSessao).getTime() - Date.now();
    
    if (diff <= 0) {
      return { text: "Encerrada / Em Disputa", isExpired: true, isCritical: false };
    }
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days >= 1) {
      const hoursRemaining = hours % 24;
      return { 
        text: `${days}d ${hoursRemaining}h restantes`,
        isExpired: false,
        isCritical: days < 3 
      };
    } else if (hours >= 1) {
      const minutesRemaining = minutes % 60;
      return { 
        text: `Urgente: ${hours}h ${minutesRemaining}m restam!`,
        isExpired: false,
        isCritical: true 
      };
    } else {
      return { 
        text: `Disputa em ${minutes}min!`,
        isExpired: false,
        isCritical: true 
      };
    }
  };

  const remaining = getRemainingTime();

  return (
    <div className="bg-white rounded-xl border border-slate-250 p-5 shadow-sm hover:shadow-md hover:border-blue-400 transition flex flex-col justify-between h-full relative overflow-hidden group">
      {isNear() && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500 animate-pulse" title="Sessão Pública nos próximos 3 dias!" />
      )}

      <div>
        {/* Top Badges & Meta */}
        <div className="flex justify-between items-start gap-2 mb-3">
          <div className="flex flex-wrap gap-1.5 flex-1">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
              {licitacao.modalidade}
            </span>
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${statusInfo.bg} ${statusInfo.text}`}>
              {statusInfo.label}
            </span>
            {remaining && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                remaining.isExpired 
                  ? 'bg-slate-100 text-slate-500 border-slate-200' 
                  : remaining.isCritical 
                    ? 'bg-red-50 text-red-600 border-red-100 font-extrabold animate-pulse' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
              }`}>
                <Clock className="w-3 h-3" />
                {remaining.text}
              </span>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            title="Excluir licitação"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Header Title */}
        <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition text-base line-clamp-1 mb-1">
          {licitacao.edital}
        </h3>
        <p className="text-xs font-semibold text-slate-500 mb-2.5 line-clamp-1">
          {licitacao.orgao}
        </p>

        {/* Shortened Object Summary */}
        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
          {licitacao.objeto}
        </p>
      </div>

      {/* Footer Info details */}
      <div className="border-t border-slate-100 pt-3.5 mt-auto">
        <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-[11px] text-slate-500 mb-4">
          <div className="flex items-center gap-1.5 min-w-0" title="Valor Estimado">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="font-semibold text-slate-900 truncate">
              {licitacao.valorEstimado > 0 ? formatCurrency(licitacao.valorEstimado) : "Sigiloso / Não Inf."}
            </span>
          </div>

          <div className="flex items-center gap-1.5 min-w-0" title="Localização">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{licitacao.cidade} - {licitacao.estado}</span>
          </div>

          <div className="flex items-center gap-1.5 min-w-0 col-span-2" title="Data da Sessão">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate flex items-center gap-1">
              {formatDate(licitacao.dataSessao)}
              {isNear() && (
                <span className="text-amber-600 animate-bounce" title="Atenção: Prazo curto!">
                  <AlertTriangle className="w-3 h-3 inline" />
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 min-w-0 col-span-2" title="Categoria">
            <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate bg-slate-50 px-1.5 py-0.5 rounded text-slate-600">{licitacao.categoria}</span>
          </div>
        </div>

        {/* Main Action to enter work area */}
        <button
          onClick={onSelect}
          className="w-full py-2 bg-blue-50 hover:bg-blue-600 hover:text-white hover:shadow-lg hover:shadow-blue-500/10 text-blue-700 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" />
          Gerenciar e Analisar
        </button>
      </div>
    </div>
  );
}
