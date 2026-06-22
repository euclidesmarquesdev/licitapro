import express from "express";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import {
  getAuditLogsFromFirestore,
  getInMemoryAuditLogs,
  tokenUsageMetrics
} from "../../services/audit.js";
import { getCacheSize, isRedisConnected } from "../../config/redis.js";

export async function handleGetUsageStats(req: express.Request, res: express.Response) {
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

    // Busca logs do usuário
    let userLogs: any[] = [];
    try {
      userLogs = await getAuditLogsFromFirestore(token, verifiedUser.uid);
    } catch {
      userLogs = getInMemoryAuditLogs();
    }

    // Calcula estatísticas do usuário
    const userStats = calculateUserStats(userLogs);

    res.json({
      success: true,
      userId: verifiedUser.uid,
      email: verifiedUser.email || "anonimo@licitapro.gov",
      userStats,
      serverStats: {
        totalSystemRequests: tokenUsageMetrics.totalRequests,
        totalSystemTokens: tokenUsageMetrics.totalTokens,
        isRedisActive: isRedisConnected,
        cacheHits: getCacheSize()
      }
    });

  } catch (err: any) {
    console.error("[Stats] Erro:", err);
    res.status(500).json({ error: "Erro ao compilar estatísticas." });
  }
}

function calculateUserStats(logs: any[]) {
  let requestsCount = logs.length;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  const endpoints: Record<string, { requests: number; tokens: number }> = {};

  for (const log of logs) {
    const pTok = log.usage?.promptTokens || (log.isMock ? 350 : 1500);
    const cTok = log.usage?.completionTokens || (log.isMock ? 50 : 400);

    promptTokens += pTok;
    completionTokens += cTok;
    totalTokens += (pTok + cTok);

    const ep = log.endpoint;
    if (!endpoints[ep]) {
      endpoints[ep] = { requests: 0, tokens: 0 };
    }
    endpoints[ep].requests += 1;
    endpoints[ep].tokens += (pTok + cTok);
  }

  return {
    requestsCount,
    promptTokens,
    completionTokens,
    totalTokens,
    endpoints
  };
}