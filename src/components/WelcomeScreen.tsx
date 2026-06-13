import React from "react";
import { Sparkles, Globe, Database, CheckSquare, Users, Bell } from "lucide-react";

interface WelcomeScreenProps {
  termsAccepted: boolean;
  setTermsAccepted: (val: boolean) => void;
  termsError: string;
  setTermsError: (val: string) => void;
  handleGoogleLogin: () => void;
  setIsGuestMode: (val: boolean) => void;
}

export default function WelcomeScreen({
  termsAccepted,
  setTermsAccepted,
  termsError,
  setTermsError,
  handleGoogleLogin,
  setIsGuestMode,
}: WelcomeScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col justify-between py-12 px-4 relative overflow-hidden">
      {/* Abstract background grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0284c708_1px,transparent_1px),linear-gradient(to_bottom,#0284c708_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      
      <div className="text-center max-w-4xl mx-auto z-10 my-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-bold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" /> Analista de Licitações Inteligente
        </div>

        <h1 className="font-extrabold text-white tracking-tight text-4xl md:text-6xl text-center leading-none">
          O Sistema Mais <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">Completo de Licitações</span> do Brasil
        </h1>

        <p className="text-slate-300 text-md md:text-lg max-w-2xl mx-auto mt-6 leading-relaxed">
          Cadastre os editais copiando links ou arrastando textos. Nossa IA preenche tudo, cria o checklist, gerencia faturamento com fornecedores de apoio, monitora alertas via <strong className="text-emerald-400">WhatsApp/E-mail</strong> e faz <strong className="text-blue-400">análise preditiva</strong> de lances.
        </p>

        {/* Termos de Compromisso Legal e Regras de IA */}
        <div className="max-w-xl mx-auto mt-8 p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl text-left font-sans">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              id="terms-accepted-checkbox"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => {
                setTermsAccepted(e.target.checked);
                if (e.target.checked) setTermsError("");
              }}
              className="mt-1 w-4 h-4 bg-slate-800 border-slate-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900 focus:ring-2 cursor-pointer"
            />
            <span className="text-[11px] text-slate-400 leading-normal font-sans">
              Declaro ter lido e aceito as condições dos <strong className="text-slate-200">Termos de Uso e Isenção de IA</strong> (Lei 14.133/2021 e Decreto nº 11.243/2022). Reconheço que as sugestões de lances, checklists baseados em editais, minutas e prazos fornecidos no LicitaPro possuem caráter consultivo e devem ser validados pela assessoria jurídica competente.
            </span>
          </label>
          {termsError && (
            <p className="text-red-400 text-[10px] font-bold mt-2 animate-pulse text-center">
              ⚠️ {termsError}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          <button
            id="google-login-btn"
            onClick={handleGoogleLogin}
            className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 text-sm transition tracking-wide flex items-center justify-center gap-2 cursor-pointer"
          >
            <Globe className="w-4 h-4" />
            Entrar com Conta Google
          </button>
          <button
            id="demo-login-btn"
            onClick={() => {
              if (!termsAccepted) {
                setTermsError("Por favor, leia e marque o aceite dos termos legais de IA e de uso antes de prosseguir com a demonstração.");
                return;
              }
              setIsGuestMode(true);
            }}
            className="w-full sm:w-auto px-8 py-3.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-sm transition border border-white/10 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Database className="w-4 h-4 text-emerald-400" />
            Entrar em Modo Demonstração
          </button>
        </div>

        {/* Core dynamic capabilities badge listings */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mt-16 text-left">
          <div className="p-4 bg-white/5 border border-white/5 rounded-xl">
            <CheckSquare className="w-5 h-5 text-blue-400 mb-2" />
            <h4 className="text-white text-xs font-bold uppercase">Preenchimento IA</h4>
            <p className="text-slate-300 text-[11px] mt-0.5 leading-normal font-sans">Basta colar o link e a IA mapeia valor, tipo de objeto e prazos imprevistos.</p>
          </div>
          <div className="p-4 bg-white/5 border border-white/5 rounded-xl">
            <Sparkles className="w-5 h-5 text-emerald-400 mb-2" />
            <h4 className="text-white text-xs font-bold uppercase font-sans">Predições de Lances</h4>
            <p className="text-slate-300 text-[11px] mt-0.5 leading-normal font-sans">Compare o histórico final de concorrentes conhecidos e calcule descontos teto.</p>
          </div>
          <div className="p-4 bg-white/5 border border-white/5 rounded-xl">
            <Users className="w-5 h-5 text-sky-400 mb-2" />
            <h4 className="text-white text-xs font-bold uppercase font-sans">Fornecedores Apoio</h4>
            <p className="text-slate-300 text-[11px] mt-0.5 leading-normal font-sans">Mapeie cotações de atacadistas simulando margens líquidas exatas.</p>
          </div>
          <div className="p-4 bg-white/5 border border-white/5 rounded-xl">
            <Bell className="w-5 h-5 text-amber-500 mb-2" />
            <h4 className="text-white text-xs font-bold uppercase font-sans">Notificações Inteligentes</h4>
            <p className="text-slate-300 text-[11px] mt-0.5 leading-normal font-sans">Dispare testes reais de alertas de WhatsApp e E-mail de prazos regulamentares.</p>
          </div>
        </div>
      </div>

      <div className="text-center text-[11px] text-slate-500 z-10 border-t border-white/5 pt-6 font-sans">
        Desenvolvido com IA em Cloud Sandbox Segura • {new Date().getFullYear()} lances protegidos
      </div>
    </div>
  );
}
