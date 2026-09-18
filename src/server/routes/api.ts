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

  // Log de desenvolvimento removido em produção pelo AutoPatch

// ============================================================
// RATE LIMITER
// ============================================================
router.use(rateLimiterMiddleware);

// ============================================================
// ROTA PNCP SEARCH
// ============================================================
router.get("/pncp/search", authMiddleware, handlePncpSearch);
  // Log de desenvolvimento removido em produção pelo AutoPatch

router.post("/pncp/import", authMiddleware, handlePncpImport);
  // Log de desenvolvimento removido em produção pelo AutoPatch

router.post("/licitacoes/scrape", authMiddleware, handleScrapeBidding);
router.post("/licitacoes/predict", authMiddleware, handlePredictBidding);
router.post("/licitacoes/generate-document", authMiddleware, handleGenerateDocument);

router.get("/ia/audit/history", authMiddleware, handleGetAuditHistory);
router.get("/usage", authMiddleware, handleGetUsageStats);

// ============================================================
// ROTA 404
// ============================================================
router.use((req, res) => {
  // Log de desenvolvimento removido em produção pelo AutoPatch
  res.status(404).json({
    error: "Rota da API não encontrada",
    path: req.path,
    method: req.method
  });
});

  // Log de desenvolvimento removido em produção pelo AutoPatch

export default router;