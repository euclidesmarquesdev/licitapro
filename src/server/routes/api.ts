import express from "express";
import { authMiddleware } from "../middleware/auth";
import { rateLimiterMiddleware } from "../middleware/rateLimiter";
import {
  handleScrapeBidding,
  handlePredictBidding,
  handleGenerateDocument,
  handleGetAuditHistory,
  handleGetUsageStats
} from "../controllers/licitacaoController";

const router = express.Router();

// Enforce security-hardened rate limiter on all core api interactions
router.use(rateLimiterMiddleware);

// Define bidding process routes, guarded by Firebase/Google Account verifies
router.post("/licitacoes/scrape", authMiddleware, handleScrapeBidding);
router.post("/licitacoes/predict", authMiddleware, handlePredictBidding);
router.post("/licitacoes/generate-document", authMiddleware, handleGenerateDocument);

// Define audit and operational metrics report queries
router.get("/ia/audit/history", authMiddleware, handleGetAuditHistory);
router.get("/usage", authMiddleware, handleGetUsageStats);

// Health check endpoint (for container ping/status checks)
router.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

export default router;
