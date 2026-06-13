import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Sparkles, Trophy, Award, Landmark, ArrowRight } from "lucide-react";

interface ConfettiCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  type: "items" | "docs" | null;
  orgao?: string;
  edital?: string;
  triggerMessage?: string;
}

// Color palette: purple (indigo/violet), blue, emerald green
const CONFETTI_COLORS = [
  "#6366f1", // purple/indigo
  "#8b5cf6", // violet/purple
  "#3b82f6", // blue
  "#0ea5e9", // sky blue
  "#10b981", // emerald green
  "#34d399", // light green
];

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
}

export default function ConfettiCelebration({
  isOpen,
  onClose,
  type,
  orgao = "Órgão Público",
  edital = "Pregão Eletrônico",
  triggerMessage
}: ConfettiCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActive(true);
      // Automatically disable heavy confetti physics after 8 seconds (idle performance)
      const timer = setTimeout(() => {
        // Let it keep displaying but stop generating new force, or close confetti rendering
      }, 8000);
      return () => clearTimeout(timer);
    } else {
      setActive(false);
    }
  }, [isOpen]);

  // Confetti canvas run engine
  useEffect(() => {
    if (!active || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Track resize
    const handleResize = () => {
      if (canvasRef.current) {
        width = canvasRef.current.width = window.innerWidth;
        height = canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", handleResize);

    // Initialize particles
    const particles: Particle[] = [];
    const count = 180;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * -height - 20, // Spawn offscreen/top
        size: Math.random() * 8 + 6,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        speedX: Math.random() * 4 - 2, // Slight drift left/right
        speedY: Math.random() * 5 + 3, // Fall speed
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 4 - 2
      });
    }

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      let activeParticles = 0;

      particles.forEach((p) => {
        // Update physics
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotationSpeed;

        // Reset if they run down or outside bounds
        if (p.y > height) {
          p.y = -20;
          p.x = Math.random() * width;
          p.speedY = Math.random() * 5 + 3;
        }

        // Draw particle (rectangle ribbon or circle)
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        
        // Render stylized square ribbons
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
        
        activeParticles++;
      });

      if (activeParticles > 0) {
        animationId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, [active]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Dynamic Canvas Layer */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {/* Modal Backdrop Blur and Dark Layer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-md cursor-pointer z-0"
        />

        {/* Celebratory Content Box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ 
            opacity: 1, 
            scale: 1, 
            y: 0,
            transition: { type: "spring", damping: 18, stiffness: 100 }
          }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative max-w-lg w-full bg-white rounded-3xl border border-slate-100 shadow-2xl p-7 text-center select-none overflow-hidden z-20 font-sans"
        >
          {/* Animated Glowing Ambient Rings behind */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-radial from-indigo-50/50 to-transparent rounded-full -translate-y-1/2 pointer-events-none" />

          {/* Icon Badge Container */}
          <div className="relative mx-auto w-20 h-20 bg-gradient-to-tr from-indigo-600 via-violet-600 to-emerald-500 rounded-2.5xl p-0.5 shadow-xl flex items-center justify-center mb-6 animate-bounce">
            <div className="absolute inset-[2px] bg-white rounded-[22px] flex items-center justify-center">
              {type === "items" ? (
                <Trophy className="w-10 h-10 text-indigo-600" />
              ) : (
                <Award className="w-10 h-10 text-emerald-600" />
              )}
            </div>
            
            {/* Tiny stars around the icon */}
            <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-indigo-500 animate-pulse" />
            <Sparkles className="absolute -bottom-1 -left-2 w-4 h-4 text-emerald-500 animate-pulse" />
          </div>

          <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
            Parabéns! Etapa Concluída 🎉
          </h3>
          
          <p className="text-[10px] text-indigo-650 font-black tracking-widest uppercase mt-1">
            {type === "items" ? "Cotações Finalizadas" : "Checklist 100% Habilitado"}
          </p>

          <div className="mt-5 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-left space-y-3.5">
            <div className="flex items-start gap-2.5">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mt-0.5 select-none font-bold">
                <Landmark className="w-4 h-4" />
              </span>
              <div>
                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Edital Associado</span>
                <span className="text-xs font-black text-slate-800 uppercase block line-clamp-1" title={orgao}>
                  {orgao} ({edital})
                </span>
              </div>
            </div>

            <div className="border-t border-slate-200/55 pt-3.5">
              {triggerMessage && (
                <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold font-sans text-center shadow-2xs">
                  🎯 Inspiração: {triggerMessage}
                </div>
              )}
              {type === "items" ? (
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Excelente progresso corporativo! Todos os itens e fornecedores vinculados no edital foram <strong className="text-indigo-600 font-extrabold bg-indigo-50/70 p-0.5 px-1.5 rounded">marcardos como cotados</strong>. Suas estimativas estão finalizadas e alinhadas para a inserção das propostas comerciais!
                </p>
              ) : (
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Sua conformidade jurídica está pronta! Todo o checklist de habilitação administrativa, certidões e relatórios técnicos do edital foram <strong className="text-emerald-700 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">aprovados e declarados conformes</strong>. Risco de inabilitação mitigado!
                </p>
              )}
            </div>
          </div>

          <p className="text-[10.5px] text-zinc-400 font-medium mt-4 italic">
            "Cada conformidade resolvida é um passo decisivo rumo à vitória no certame!"
          </p>

          {/* Action buttons with custom neon glow */}
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={onClose}
              className="py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/15 transition flex items-center justify-center gap-1.5 cursor-pointer outline-none"
            >
              Continuar Gestão do Edital
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="py-2.5 bg-transparent hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-[11px] font-extrabold rounded-lg transition"
            >
              Fechar Visualização
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
