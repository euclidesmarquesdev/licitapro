import express from "express";
import { sanitizeInput } from "../utils/sanitization";
import { getCachedData, setCachedData, getCacheSize, isRedisConnected } from "../config/redis";
import {
  extractBiddingMetadata,
  predictBiddingOutcome,
  draftGovernmentDocument,
  isGeminiConfigured
} from "../services/gemini";
import {
  addAuditLogEntry,
  saveAuditLogToFirestore,
  getAuditLogsFromFirestore,
  tokenUsageMetrics,
  getInMemoryAuditLogs
} from "../services/audit";
import { AuthenticatedRequest } from "../middleware/auth";

/**
 * Handle Scrape Bidding details
 */
export async function handleScrapeBidding(req: express.Request, res: express.Response) {
  try {
    const authHeader = req.headers["authorization"]!;
    const token = authHeader.split(" ")[1];
    const verifiedUser = (req as AuthenticatedRequest).user!;

    const { url, rawText } = req.body;
    const sanitizedUrl = sanitizeInput(url);
    const sanitizedRawText = sanitizeInput(rawText);

    const cacheKey = sanitizedUrl 
      ? `scrape-${sanitizedUrl}` 
      : `scrape-hash-${(sanitizedRawText || "").substring(0, 100)}-${(sanitizedRawText || "").length}`;

    // 1. Check cache first
    const cached = await getCachedData(cacheKey);
    if (cached) {
      const log = addAuditLogEntry(
        "/api/licitacoes/scrape (cache)", 
        { url: sanitizedUrl, rawTextLength: sanitizedRawText?.length || 0 }, 
        { success: true, data: cached }, 
        false
      );
      await saveAuditLogToFirestore(token, log, verifiedUser.uid);
      return res.json({ success: true, data: cached, isCached: true });
    }

    let textToAnalyze = sanitizedRawText || "";
    let useUrlContextTool = false;

    // 2. Hybrid fetching: Try fetching directly first, fallback to Gemini's urlContext tool
    if (sanitizedUrl && !textToAnalyze) {
      try {
        const fetchRes = await fetch(sanitizedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          textToAnalyze = html
            .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
            .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .substring(0, 45000); // 45k characters limit
        } else {
          console.log(`Native scraper failed (HTTP status ${fetchRes.status}). Falling back to Gemini's native urlContext crawler...`);
          useUrlContextTool = true;
        }
      } catch (fetchErr) {
        console.log("Native scraper interface failed connection. Delegating to Gemini's web context crawler...");
        useUrlContextTool = true;
      }
    }

    if (!useUrlContextTool && (!textToAnalyze || textToAnalyze.trim().length === 0)) {
      return res.status(400).json({
        error: "Nenhum texto ou URL de edital válido foi fornecido para análise de inteligência."
      });
    }

    // 3. Extract metadata using Gemini service
    const { parsed, isMock, usage } = await extractBiddingMetadata(textToAnalyze, sanitizedUrl, useUrlContextTool);

    // Save in Cache
    await setCachedData(cacheKey, parsed);

    // Save to audit databases
    const log = addAuditLogEntry(
      "/api/licitacoes/scrape", 
      { url: sanitizedUrl, rawTextLength: textToAnalyze?.length || 0 }, 
      { success: true, data: parsed }, 
      isMock,
      undefined,
      usage
    );
    await saveAuditLogToFirestore(token, log, verifiedUser.uid);

    res.json({ success: true, isMock, data: parsed });

  } catch (err: any) {
    console.error("Erro no scraping estruturado IA:", err);
    const isTimeout = err.message.includes("limite de tempo") || err.message.includes("timeout") || err.message.includes("deadline");
    const userMessage = isTimeout
      ? "O processamento inteligente do edital detalhado excedeu o limite de tempo de 30 segundos. Experimente colar apenas os trechos principais (ex: objeto do contrato e lista de habilitação) ou realize a operação em instantes."
      : "A plataforma não conseguiu decodificar o documento automaticamente no momento: " + err.message;
    res.status(500).json({ error: userMessage });
  }
}

/**
 * Handle Predict bidding outcome and competition levels
 */
export async function handlePredictBidding(req: express.Request, res: express.Response) {
  try {
    const authHeader = req.headers["authorization"]!;
    const token = authHeader.split(" ")[1];
    const verifiedUser = (req as AuthenticatedRequest).user!;

    const { licitacao, competitors, historicalPrices } = req.body;

    if (!licitacao) {
      return res.status(400).json({ error: "Dados da licitação não fornecidos para análise preditiva." });
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

    // Input sanitization mapping
    const sanitizedLicitacao = {
      ...licitacao,
      objeto: sanitizeInput(licitacao.objeto),
      orgao: sanitizeInput(licitacao.orgao),
      edital: sanitizeInput(licitacao.edital)
    };

    // Predict using Gemini service
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
    console.error("Erro na inteligência preditiva IA:", err);
    const isTimeout = err.message.includes("limite de tempo") || err.message.includes("timeout") || err.message.includes("deadline");
    const userMessage = isTimeout
      ? "A simulação preditiva tática via IA do PNCP/Licitação demorou mais que o limite de tolerância de 30 segundos. Sugerimos tentar novamente em instantes."
      : "Ocorreu um erro ao simular a probabilidade de vitória e inteligência competitiva: " + err.message;
    res.status(500).json({ error: userMessage });
  }
}

/**
 * Handle Auto document generation
 */
export async function handleGenerateDocument(req: express.Request, res: express.Response) {
  try {
    const authHeader = req.headers["authorization"]!;
    const token = authHeader.split(" ")[1];
    const verifiedUser = (req as AuthenticatedRequest).user!;

    const { docType, licitacao, ourCompanyDetails } = req.body;

    if (!licitacao) {
      return res.status(400).json({ error: "Dados da licitação são necessários para formulação documental." });
    }

    const companyDetails = ourCompanyDetails || {
      name: "Minha Empresa GovTech Brasil S/A",
      cnpj: "12.345.678/0001-99",
      address: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
      partnerName: "Fulano de Souza Rezende",
      partnerCPF: "111.222.333-44",
      partnerRole: "Sócio Administrador"
    };

    const sanitizedLicitacao = {
      ...licitacao,
      objeto: sanitizeInput(licitacao.objeto),
      orgao: sanitizeInput(licitacao.orgao),
      edital: sanitizeInput(licitacao.edital)
    };

    const sanitizedCompanyDetails = {
      name: sanitizeInput(companyDetails.name),
      cnpj: sanitizeInput(companyDetails.cnpj),
      address: sanitizeInput(companyDetails.address),
      partnerName: sanitizeInput(companyDetails.partnerName),
      partnerCPF: sanitizeInput(companyDetails.partnerCPF),
      partnerRole: sanitizeInput(companyDetails.partnerRole)
    };

    const { draft, isMock, usage } = await draftGovernmentDocument(
      docType,
      sanitizedLicitacao,
      sanitizedCompanyDetails
    );

    const log = addAuditLogEntry(
      "/api/licitacoes/generate-document", 
      { docType, companyCNPJ: sanitizedCompanyDetails.cnpj }, 
      { success: true, data: draft }, 
      isMock,
      undefined,
      usage
    );
    await saveAuditLogToFirestore(token, log, verifiedUser.uid);

    res.json({ success: true, isMock, data: draft });

  } catch (err: any) {
    console.error("Erro na geração de minutas/documentos:", err);
    const isTimeout = err.message.includes("limite de tempo") || err.message.includes("timeout") || err.message.includes("deadline");
    const userMessage = isTimeout
      ? "A elaboração jurídica automatizada excedeu o limite de segurança de 30 segundos devido ao volume ou complexidade de cláusulas solicitadas. Por favor, tente novamente de forma simplificada."
      : "Erro interno na elaboração jurídica de documentos de licitação: " + err.message;
    res.status(500).json({ error: userMessage });
  }
}

/**
 * Handle fetching audit log list history
 */
export async function handleGetAuditHistory(req: express.Request, res: express.Response) {
  try {
    const authHeader = req.headers["authorization"]!;
    const token = authHeader.split(" ")[1];
    const verifiedUser = (req as AuthenticatedRequest).user!;
    
    const logs = await getAuditLogsFromFirestore(token, verifiedUser.uid);
    res.json({ success: true, logs });
  } catch (err: any) {
    console.error("[LicitaPro Server] Erro ao recuperar histórico do Firestore, retornando fallback local:", err);
    res.json({ success: true, logs: getInMemoryAuditLogs() });
  }
}

/**
 * Handle compiling user & server stats metrics
 */
export async function handleGetUsageStats(req: express.Request, res: express.Response) {
  try {
    const authHeader = req.headers["authorization"]!;
    const token = authHeader.split(" ")[1];
    const verifiedUser = (req as AuthenticatedRequest).user!;

    // Pull all user logs from Firestore to compile precise, real-time statistics
    let userLogs: any[] = [];
    try {
      userLogs = await getAuditLogsFromFirestore(token, verifiedUser.uid);
    } catch (logErr) {
      console.warn("[LicitaPro Server] Não foi possível ler logs do Firestore para compilar estatísticas, usando fallback in-memory:", logErr);
      userLogs = getInMemoryAuditLogs();
    }

    let userRequests = userLogs.length;
    let userPromptTokens = 0;
    let userCompletionTokens = 0;
    let userTotalTokens = 0;

    const userEndpoints: Record<string, { requests: number; tokens: number }> = {};

    for (const log of userLogs) {
      const promptTok = log.usage?.promptTokens || (log.isMock ? 350 : 1500);
      const completionTok = log.usage?.completionTokens || (log.isMock ? 50 : 400);

      userPromptTokens += promptTok;
      userCompletionTokens += completionTok;
      userTotalTokens += (promptTok + completionTok);

      const ep = log.endpoint;
      if (!userEndpoints[ep]) {
        userEndpoints[ep] = { requests: 0, tokens: 0 };
      }
      userEndpoints[ep].requests += 1;
      userEndpoints[ep].tokens += (promptTok + completionTok);
    }

    res.json({
      success: true,
      userId: verifiedUser.uid,
      email: verifiedUser.email || "anonimo@licitapro.gov",
      userStats: {
        requestsCount: userRequests,
        promptTokens: userPromptTokens,
        completionTokens: userCompletionTokens,
        totalTokens: userTotalTokens,
        endpoints: userEndpoints
      },
      serverStats: {
        totalSystemRequests: tokenUsageMetrics.totalRequests,
        totalSystemTokens: tokenUsageMetrics.totalTokens,
        isRedisActive: isRedisConnected,
        cacheHits: getCacheSize()
      }
    });
  } catch (err: any) {
    console.error("[LicitaPro Server] Erro catastrófico ao compilar consumo de recursos de IA:", err);
    res.status(500).json({ error: "Erro interno do servidor ao processar consumo de lances e consultas de IA." });
  }
}
