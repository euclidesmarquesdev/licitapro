import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer } from "vite";
import apiRoutes from "./src/server/routes/api.js";  // ✅ TEM QUE SER ASSIM

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
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
console.log("[LicitaPro] Rotas da API registradas em /api");

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
    console.log("[LicitaPro] Vite integrado em modo desenvolvimento");
  } catch (error) {
    console.warn("[LicitaPro] Vite não disponível:", error);
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[LicitaPro] Servidor rodando em http://localhost:${PORT}`);
  console.log(`[LicitaPro] API disponível em http://localhost:${PORT}/api`);
});