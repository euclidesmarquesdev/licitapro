import express from "express";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { sanitizeInput } from "../../utils/sanitization.js";
import { getCachedData, setCachedData } from "../../config/redis.js";
import { predictBiddingOutcome } from "../../services/gemini.js";
import { addAuditLogEntry, saveAuditLogToFirestore } from "../../services/audit.js";

export async function handlePredictBidding(req: express.Request, res: express.Response) {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token de autenticação não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    const verifiedUser = (req as AuthenticatedRequest).user;

    if (!verifiedUser) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const { licitacao, competitors, historicalPrices } = req.body;

    if (!licitacao) {
      return res.status(400).json({ error: "Dados da licitação não fornecidos." });
    }

    const cacheKey = `predict-${licitacao.id}`;
    const cached = await getCachedData(cacheKey);
    if (cached) {
      const log = addAuditLogEntry(
        "/api/licitacoes/predict (cache)",
        { licitacaoId: licitacao.id },
        { success: true, prediction: cached },
        false
      );
      await saveAuditLogToFirestore(token, log, verifiedUser.uid);
      return res.json({ success: true, prediction: cached, isCached: true });
    }

    const sanitizedLicitacao = {
      ...licitacao,
      objeto: sanitizeInput(licitacao.objeto),
      orgao: sanitizeInput(licitacao.orgao),
      edital: sanitizeInput(licitacao.edital)
    };

    const { prediction, citations, isMock, usage } = await predictBiddingOutcome(
      sanitizedLicitacao,
      competitors,
      historicalPrices
    );

    await setCachedData(cacheKey, prediction);

    const log = addAuditLogEntry(
      "/api/licitacoes/predict",
      { licitacaoId: sanitizedLicitacao.id },
      { success: true, prediction },
      isMock,
      citations,
      usage
    );
    await saveAuditLogToFirestore(token, log, verifiedUser.uid);

    res.json({ success: true, isMock, prediction });

  } catch (err: any) {
    console.error("[Predict] Erro:", err);
    const isTimeout = err.message.includes("timeout") || err.message.includes("deadline");
    res.status(500).json({
      error: isTimeout
        ? "A análise preditiva excedeu o limite de tempo."
        : "Erro na análise preditiva: " + err.message
    });
  }
}