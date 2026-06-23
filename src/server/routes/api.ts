import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { rateLimiterMiddleware } from "../middleware/rateLimiter.js";

// IMPORTA OS HANDLERS
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

console.log("[api.ts] 🔧 Registrando rotas...");

// ============================================================
// RATE LIMITER
// ============================================================
router.use(rateLimiterMiddleware);

// ============================================================
// ROTA PNCP SEARCH
// ============================================================
router.get("/pncp/search", authMiddleware, handlePncpSearch);
console.log("[api.ts] ✅ GET /pncp/search registrada");

router.post("/pncp/import", authMiddleware, handlePncpImport);
console.log("[api.ts] ✅ POST /pncp/import registrada");

router.post("/licitacoes/scrape", authMiddleware, handleScrapeBidding);
router.post("/licitacoes/predict", authMiddleware, handlePredictBidding);
router.post("/licitacoes/generate-document", authMiddleware, handleGenerateDocument);

router.get("/ia/audit/history", authMiddleware, handleGetAuditHistory);
router.get("/usage", authMiddleware, handleGetUsageStats);

// ============================================================
// ROTA 404
// ============================================================
router.use((req, res) => {
  console.log(`[api.ts] ❌ Rota não encontrada: ${req.method} ${req.path}`);
  res.status(404).json({
    error: "Rota da API não encontrada",
    path: req.path,
    method: req.method
  });
});

console.log("[api.ts] ✅ Todas as rotas registradas");

export default router;