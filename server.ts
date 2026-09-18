import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer } from "vite";
import apiRoutes from "./src/server/routes/api.js";  // ✅ TEM QUE SER ASSIM

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import helmet from 'helmet';
const app = express();

// [AutoPatch] Headers de segurança HTTP estritos
app.use(helmet());
const PORT = parseInt(process.env.PORT || "3000", 10);
const isProduction = process.env.NODE_ENV === "production";

// CORS
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parser
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ============================================================
// ✅ ROTAS DA API - PRIMEIRAS (NUNCA SERÃO INTERCEPTADAS)
// ============================================================
app.use("/api", apiRoutes);
  // Log de desenvolvimento removido em produção pelo AutoPatch

// ============================================================
// HEALTH CHECK
// ============================================================
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ============================================================
// VITE EM DESENVOLVIMENTO
// ============================================================
if (!isProduction) {
  try {
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: { port: 24678 }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  // Log de desenvolvimento removido em produção pelo AutoPatch
  } catch (error) {
    console.warn("[LicitaPro] Vite não disponível:", error);
  }
}

// [AutoPatch] Middleware Global Centralizado de Erros
app.use((err: unknown, _req: unknown, res: unknown, _next: unknown) => {
  console.error('[Unhandled Server Error]', err.message);
  res.status(500).json({ error: 'Erro interno processado com segurança.' });
});

app.listen(PORT, "0.0.0.0", () => {

// [AutoPatch] Graceful Shutdown
const server = app.listen(PORT);
process.on('SIGTERM', () => {
  console.log('SIGTERM recebido: encerrando conexões...');
  server.close(() => process.exit(0));
});
  // Log de desenvolvimento removido em produção pelo AutoPatch
  // Log de desenvolvimento removido em produção pelo AutoPatch
});