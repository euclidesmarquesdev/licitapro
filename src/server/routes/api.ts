import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { rateLimiterMiddleware } from "../middleware/rateLimiter.js";

// ✅ IMPORTA DO INDEX (que re-exporta tudo)
import {
  handleScrapeBidding,
  handlePredictBidding,
  handleGenerateDocument,
  handleGetAuditHistory,
  handleGetUsageStats,
  handlePncpImport,
  handlePncpSearch
} from "../controllers/index.js";

const router = express.Router();

// ============================================================
// 1. SECURITY HEADERS
// ============================================================
router.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' https://*.firebaseio.com https://*.firebaseapp.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://pncp.gov.br",
        "frame-src 'self' https://*.firebaseapp.com",
        "base-uri 'self'",
        "form-action 'self'"
      ].join("; ")
    );
  }
  next();
});

// ============================================================
// 2. RATE LIMITER
// ============================================================
router.use(rateLimiterMiddleware);

// ============================================================
// 3. ROTAS DE LICITAÇÃO
// ============================================================
router.post("/licitacoes/scrape", authMiddleware, handleScrapeBidding);
router.post("/licitacoes/predict", authMiddleware, handlePredictBidding);
router.post("/licitacoes/generate-document", authMiddleware, handleGenerateDocument);

// ============================================================
// 4. ROTAS PNCP (PORTAL NACIONAL DE CONTRATAÇÕES PÚBLICAS)
// ============================================================
router.post("/pncp/import", authMiddleware, handlePncpImport);    // ✅ POST
router.get("/pncp/search", authMiddleware, handlePncpSearch);     // ✅ GET

// ============================================================
// 5. ROTAS DE AUDITORIA
// ============================================================
router.get("/ia/audit/history", authMiddleware, handleGetAuditHistory);
router.get("/usage", authMiddleware, handleGetUsageStats);

// ============================================================
// 6. HEALTH CHECK
// ============================================================
router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development"
  });
});

// ============================================================
// 7. READINESS PROBE
// ============================================================
router.get("/ready", (req, res) => {
  res.status(200).json({
    status: "ready",
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// 8. LIVENESS PROBE
// ============================================================
router.get("/live", (req, res) => {
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// 9. ROTA 404
// ============================================================
router.use((req, res) => {
  res.status(404).json({
    error: "Rota não encontrada",
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

export default router;