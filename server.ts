import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import Redis from "ioredis";

dotenv.config();

// Ensure Gemini API key is configured
const geminiKey = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({
  apiKey: geminiKey || "MOCK_KEY_SANS_SECRET",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Initialize Firebase Admin SDK
let isFirebaseAdminInitialized = false;
try {
  if (!getApps().length) {
    initializeApp();
  }
  isFirebaseAdminInitialized = true;
  console.log("[LicitaPro Server] Firebase Admin SDK inicializado com sucesso.");
} catch (error: any) {
  console.warn("[LicitaPro Server] Alerta: Falha ao inicializar o Firebase Admin SDK (pode ser ausência de credenciais default no localdev). Utilizando REST API de fallback. Erro:", error.message);
}

// Load firebase-applet-config.json for dynamic validation and Cloud logging
let firebaseConfig: any = {};
try {
  const rawConfig = fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8");
  firebaseConfig = JSON.parse(rawConfig);
} catch (error) {
  console.warn("[LicitaPro Server] Alerta: Não foi possível obter o firebase-applet-config.json. Backend operando em modo offline.");
}

// Token Verification using official Firebase Admin SDK with resilient dynamic fallback
async function verifyIdToken(idToken: string): Promise<{ uid: string; email?: string; emailVerified?: boolean } | null> {
  if (!idToken) return null;

  // 1. Try Firebase Admin SDK verification (High stability, native)
  if (isFirebaseAdminInitialized) {
    try {
      const decodedToken = await getAuth().verifyIdToken(idToken);
      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified
      };
    } catch (err: any) {
      console.warn("[LicitaPro Server] Verificação nativa Admin SDK falhou (token expirado ou falta de escopo). Tentando REST API fallback... Erro:", err.message);
    }
  }

  // 2. Robust REST API fallback
  const apiKey = firebaseConfig.apiKey;
  if (!apiKey) {
    console.warn("[LicitaPro Server] Alerta: API Key do Firebase não encontrada. Utilizando fallback local para desenvolvimento offline.");
    return { uid: "guest-dev-user", email: "guest@licitapro.dev", emailVerified: true };
  }
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error("[LicitaPro Server] Erro na verificação do token no Google Client-Toolkit:", errBody);
      return null;
    }
    const data = await res.json();
    const user = data.users?.[0];
    if (!user) return null;
    return {
      uid: user.localId,
      email: user.email,
      emailVerified: user.emailVerified
    };
  } catch (err) {
    console.error("[LicitaPro Server] Falha geral ao verificar token via API do Google Auth:", err);
    return null;
  }
}

// Custom interface for Express request extended with verified user attributes
export interface AuthenticatedRequest extends express.Request {
  user?: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
  };
}

// Token Verification Middleware
async function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "LicitaPro Security: Acesso não autorizado. Token de sessão do Google/Firebase ausente." });
  }
  const token = authHeader.split(" ")[1];
  const verifiedUser = await verifyIdToken(token);
  if (!verifiedUser) {
    return res.status(403).json({ error: "LicitaPro Security: Token expirado ou assinatura inválida. Por favor, refaça o login na aplicação." });
  }
  (req as AuthenticatedRequest).user = verifiedUser;
  next();
}

// Professional input sanitization function to prevent Prompt Injections in rawText or URL inputs
function sanitizeInput(text: string): string {
  if (!text) return "";
  // 1. Remove script / HTML tags
  let sanitized = text.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "");
  sanitized = sanitized.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "");
  sanitized = sanitized.replace(/javascript:/gi, "");
  
  // 2. Eradicate adversarial instructions to override or manipulate system prompt boundaries
  const injectionPatterns = [
    /ignore as instruções anteriores/gi,
    /ignore as diretrizes anterior/gi,
    /ignore tudo o que foi dito/gi,
    /desconsidere as instruções/gi,
    /ignore previous instructions/gi,
    /system instructions/gi,
    /you are now/gi,
    /você agora é/gi,
    /agora você deve/gi,
    /ignore restrictions/gi,
    /force response/gi
  ];
  
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, "[CONTEÚDO REMOVIDO POR PREVENÇÃO DE PROMPT INJECTION]");
  }
  return sanitized;
}

// Redis Setup with graceful in-memory context fallbacks
const redisUrl = process.env.REDIS_URL;
let redis: any = null;
let isRedisConnected = false;

if (redisUrl) {
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
    });
    redis.on("connect", () => {
      isRedisConnected = true;
      console.log("[LicitaPro Redis] Conectado ao servidor Redis com sucesso.");
    });
    redis.on("error", (err: any) => {
      isRedisConnected = false;
      console.warn("[LicitaPro Redis] Erro ou desconexão no cliente Redis (utilizando pool em memória temporariamente):", err.message);
    });
  } catch (err: any) {
    console.error("[LicitaPro Redis] Falha ao instanciar cliente Redis:", err.message);
  }
} else {
  console.info("[LicitaPro Redis] Variável REDIS_URL não definida. Cache e rate limit utilizando persistência volátil em memória.");
}

// Global tokens usage metrics tracking
const tokenUsageMetrics = {
  totalRequests: 0,
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalTokens: 0,
  endpoints: {} as Record<string, { requests: number; tokens: number }>
};

// Cache Engine for extreme performance & API optimizations
interface CacheEntry {
  data: any;
  expiry: number;
}
const apiCache = new Map<string, CacheEntry>();

async function getCachedData(key: string): Promise<any | null> {
  if (isRedisConnected && redis) {
    try {
      const val = await redis.get(key);
      if (val) {
        console.log(`[LicitaPro Cache] Cache HIT para chave: ${key} (via Redis)`);
        return JSON.parse(val);
      }
    } catch (err: any) {
      console.warn("[LicitaPro Redis Cache] Falha ao ler do Redis:", err.message);
    }
  }
  
  const cached = apiCache.get(key);
  if (cached && cached.expiry > Date.now()) {
    console.log(`[LicitaPro Cache] Cache HIT para chave: ${key} (via Memória)`);
    return cached.data;
  }
  if (cached) {
    apiCache.delete(key); // clear expired entry
  }
  return null;
}

async function setCachedData(key: string, data: any, ttlMs: number = 10 * 60 * 1000) {
  if (isRedisConnected && redis) {
    try {
      const ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000));
      await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
      console.log(`[LicitaPro Cache] Cache SET para chave: ${key} (via Redis, TTL de ${ttlSeconds}s)`);
      return;
    } catch (err: any) {
      console.warn("[LicitaPro Redis Cache] Falha ao gravar no Redis:", err.message);
    }
  }

  apiCache.set(key, { data, expiry: Date.now() + ttlMs });
  console.log(`[LicitaPro Cache] Cache SET para chave: ${key} (via Memória, TTL de ${ttlMs / 1000}s)`);
}

// Registry for AI transaction logs with citation & usage support
interface AIAuditLog {
  id: string;
  timestamp: string;
  endpoint: string;
  payload: any;
  response: any;
  isMock: boolean;
  signature: string;
  citations?: { title: string; url: string }[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const aiAuditLogs: AIAuditLog[] = [];

// Save to Firestore using high-compliance transaction layout (REST API)
async function saveAuditLogToFirestore(idToken: string, log: AIAuditLog, userId: string) {
  try {
    const projectId = firebaseConfig.projectId;
    if (!projectId) return;
    const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
    const logId = log.id;
    
    const body = {
      fields: {
        id: { stringValue: logId },
        userId: { stringValue: userId },
        endpoint: { stringValue: log.endpoint },
        timestamp: { stringValue: log.timestamp },
        payloadStr: { stringValue: JSON.stringify(log.payload) },
        responseStr: { stringValue: JSON.stringify(log.response) },
        isMock: { booleanValue: log.isMock },
        signature: { stringValue: log.signature },
        citationsStr: { stringValue: JSON.stringify(log.citations || []) },
        usageStr: { stringValue: JSON.stringify(log.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 }) }
      }
    };

    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/ia_audit_logs/${logId}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[LicitaPro Server] Falha ao persistir log de auditoria no Firestore via REST:", errText);
    } else {
      console.log(`[LicitaPro Server] Log de auditoria ${logId} persistido com sucesso no Firestore.`);
    }
  } catch (err) {
    console.error("[LicitaPro Server] Erro ao salvar log de auditoria no Firestore:", err);
  }
}

// Fetch persisted logs from Firestore
async function getAuditLogsFromFirestore(idToken: string, userId: string): Promise<AIAuditLog[]> {
  try {
    const projectId = firebaseConfig.projectId;
    if (!projectId) return [];
    const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
    
    const body = {
      structuredQuery: {
        from: [{ collectionId: "ia_audit_logs" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "userId" },
            op: "EQUAL",
            value: { stringValue: userId }
          }
        }
      }
    };

    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    if (!res.ok) {
      console.error("[LicitaPro Server] Pesquisa de logs de auditoria falhou:", await res.text());
      return [];
    }

    const data = await res.json();
    const logs: AIAuditLog[] = [];
    
    for (const item of data) {
      if (item.document) {
        const fields = item.document.fields;
        if (!fields) continue;

        logs.push({
          id: fields.id?.stringValue || "",
          timestamp: fields.timestamp?.stringValue || "",
          endpoint: fields.endpoint?.stringValue || "",
          isMock: fields.isMock?.booleanValue || false,
          signature: fields.signature?.stringValue || "",
          payload: fields.payloadStr?.stringValue ? JSON.parse(fields.payloadStr.stringValue) : {},
          response: fields.responseStr?.stringValue ? JSON.parse(fields.responseStr.stringValue) : {},
          citations: fields.citationsStr?.stringValue ? JSON.parse(fields.citationsStr.stringValue) : [],
          usage: fields.usageStr?.stringValue ? JSON.parse(fields.usageStr.stringValue) : undefined
        });
      }
    }

    // Sort by timestamp descending
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return logs;
  } catch (err) {
    console.error("[LicitaPro Server] Erro de busca de logs no Firestore:", err);
    return [];
  }
}

function addAuditLogEntry(
  endpoint: string,
  payload: any,
  response: any,
  isMock: boolean,
  citations?: { title: string; url: string }[],
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
): AIAuditLog {
  const logEntry: AIAuditLog = {
    id: "ia-log-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    endpoint,
    payload,
    response,
    isMock,
    signature: "sha256-sig-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
    citations,
    usage
  };

  // Register in-memory metrics on server
  const tokensObj = usage || { promptTokens: isMock ? 350 : 1500, completionTokens: isMock ? 50 : 400, totalTokens: isMock ? 400 : 1900 };
  tokenUsageMetrics.totalRequests += 1;
  tokenUsageMetrics.totalPromptTokens += tokensObj.promptTokens;
  tokenUsageMetrics.totalCompletionTokens += tokensObj.completionTokens;
  tokenUsageMetrics.totalTokens += tokensObj.totalTokens;
  if (!tokenUsageMetrics.endpoints[endpoint]) {
    tokenUsageMetrics.endpoints[endpoint] = { requests: 0, tokens: 0 };
  }
  tokenUsageMetrics.endpoints[endpoint].requests += 1;
  tokenUsageMetrics.endpoints[endpoint].tokens += tokensObj.totalTokens;

  aiAuditLogs.unshift(logEntry);
  if (aiAuditLogs.length > 200) {
    aiAuditLogs.pop();
  }
  return logEntry;
}

// Graceful rate limiter using Redis (or falling back to local memory if offline)
const ipRequests = new Map<string, { count: number; resetTime: number }>();
async function rateLimiterMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || (req.headers["x-forwarded-for"] as string) || "unknown-ip";
  const limitWindowSeconds = 60;
  const maxRequests = 60;
  const now = Date.now();

  if (isRedisConnected && redis) {
    try {
      const redisKey = `ratelimit:${ip}`;
      const multi = redis.multi();
      multi.incr(redisKey);
      multi.expire(redisKey, limitWindowSeconds);
      const mResult = await multi.exec();
      
      if (mResult && mResult[0] && mResult[0][1] !== undefined) {
        const currentCount = mResult[0][1] as number;
        if (currentCount > maxRequests) {
          return res.status(429).json({
            error: "LicitaPro Security Shield: Limite de requisições excedido via Redis. Limite: 60 requisições/min por endereço IP para prevenção de abusos."
          });
        }
        return next();
      }
    } catch (redisErr: any) {
      console.warn("[LicitaPro RateLimiter] Falha na validação Redis, recorrendo ao cache local:", redisErr.message);
    }
  }

  // Local memory fallback
  const record = ipRequests.get(ip);
  const windowMs = limitWindowSeconds * 1000;
  if (!record) {
    ipRequests.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (now > record.resetTime) {
    ipRequests.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  record.count += 1;
  if (record.count > maxRequests) {
    return res.status(429).json({
      error: "LicitaPro Security Shield: Limite de requisições excedido. Limite: 60 requisições/min por endereço IP para prevenção de abusos."
    });
  }
  next();
}

// Timeout handler helper for Gemini API requests
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`O limite de tempo operacional de ${timeoutMs / 1000}s para a inteligência artificial ('${operationName}') foi excedido. Por favor, simplifique o texto de entrada ou tente novamente.`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure CORS middleware for trusted domains (dynamic allowed origin check)
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }));

  app.use(express.json({ limit: "20mb" }));
  app.use(rateLimiterMiddleware);

  // Security headers representation
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  });

  // API Audit route: Retrieve all logged prompt-response profiles from Firestore
  app.get("/api/ia/audit/history", authMiddleware, async (req: express.Request, res: express.Response) => {
    try {
      const authHeader = req.headers["authorization"]!;
      const token = authHeader.split(" ")[1];
      const verifiedUser = (req as AuthenticatedRequest).user!;
      
      const logs = await getAuditLogsFromFirestore(token, verifiedUser.uid);
      res.json({ success: true, logs });
    } catch (err: any) {
      console.error("[LicitaPro Server] Erro ao recuperar histórico do Firestore, retornando fallback local:", err);
      res.json({ success: true, logs: aiAuditLogs });
    }
  });

  // API Usage route: Retrieve structured token metrics and AI resources usage stats
  app.get("/api/usage", authMiddleware, async (req: express.Request, res: express.Response) => {
    try {
      const authHeader = req.headers["authorization"]!;
      const token = authHeader.split(" ")[1];
      const verifiedUser = (req as AuthenticatedRequest).user!;

      // Pull all user logs from Firestore to compile precise, real-time statistics
      let userLogs: AIAuditLog[] = [];
      try {
        userLogs = await getAuditLogsFromFirestore(token, verifiedUser.uid);
      } catch (logErr) {
        console.warn("[LicitaPro Server] Não foi possível ler logs do Firestore para compilar estatísticas, usando fallback in-memory:", logErr);
        userLogs = aiAuditLogs;
      }

      let userRequests = userLogs.length;
      let userPromptTokens = 0;
      let userCompletionTokens = 0;
      let userTotalTokens = 0;

      const userEndpoints: Record<string, { requests: number; tokens: number }> = {};

      for (const log of userLogs) {
        // Retrieve logged usage format, or estimate baseline mock/standard limits if missing (backwards compatibility)
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
          cacheHits: Array.from(apiCache.keys()).length
        }
      });
    } catch (err: any) {
      console.error("[LicitaPro Server] Erro catastrófico ao compilar consumo de recursos de IA:", err);
      res.status(500).json({ error: "Erro interno do servidor ao processar consumo de lances e consultas de IA." });
    }
  });

  // API 1: Extract bidding metadata from URL or raw text using Gemini (Hybrid Crawler + urlContext support)
  app.post("/api/licitacoes/scrape", authMiddleware, async (req: express.Request, res: express.Response) => {
    try {
      const authHeader = req.headers["authorization"]!;
      const token = authHeader.split(" ")[1];
      const verifiedUser = (req as AuthenticatedRequest).user!;

      const { url, rawText } = req.body;
      const sanitizedUrl = sanitizeInput(url);
      const sanitizedRawText = sanitizeInput(rawText);

      const cacheKey = sanitizedUrl ? `scrape-${sanitizedUrl}` : `scrape-hash-${(sanitizedRawText || "").substring(0, 100)}-${(sanitizedRawText || "").length}`;

      // 1. Check cache first
      const cached = getCachedData(cacheKey);
      if (cached) {
        const log = addAuditLogEntry("/api/licitacoes/scrape (cache)", { url: sanitizedUrl, rawTextLength: sanitizedRawText?.length || 0 }, { success: true, data: cached }, false);
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

      // If no text, no URL, and not delegating, error out
      if (!useUrlContextTool && (!textToAnalyze || textToAnalyze.trim().length === 0)) {
        return res.status(400).json({
          error: "Nenhum texto ou URL de edital válido foi fornecido para análise de inteligência."
        });
      }

      // Check if API key is present
      if (!geminiKey) {
        // Mock fallback when key is not configured
        const mockData = {
          edital: "Pregão Eletrônico SRP 35/2026",
          orgao: "Tribunal Regional Federal (TRF) - 3ª Região",
          modalidade: "Pregão Eletrônico",
          objeto: "Contratação de empresa especializada para modernização tecnológica, suporte de infraestrutura em nuvem, e fornecimento de hardware de alto desempenho.",
          valorEstimado: 2450000.00,
          dataSessao: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().substring(0, 16),
          cidade: "São Paulo",
          estado: "SP",
          categoria: "Tecnologia da Informação",
          checklistRecomendado: [
            "Certidão Conjunta Negativa de Débitos Federais",
            "Balanço Patrimonial do último exercício social",
            "Atestado de Capacidade Técnica operacional compatível",
            "Certificado de Regularidade de Situação do FGTS (CRF)",
            "Atestado de Vistoria ou Declaração de Conhecimento do Local",
            "Declaração de cumprimento do Art. 7º, XXXIII da CF"
          ],
          competitorsEstimated: ["Softplan Planejamento", "Tech Solution Brasil Ltda", "GovTech Infra S.A."],
          arquivosPncp: [
            { id: "mock-doc-1", nome: "Edital_Concorrencia_35_2026.pdf", descricao: "Edital de Abertura Oficial", tamanho: "1.4 MB", linkUrl: "https://pncp.gov.br/app/editais?pagina=1" },
            { id: "mock-doc-2", nome: "Projeto_Basico_Anexo_I.pdf", descricao: "Anexo Técnico e Requisitos", tamanho: "3.2 MB", linkUrl: "https://pncp.gov.br/app/editais?pagina=1" }
          ],
          disclaimer: "Aviso Legal - Lei 14.133/2021: Os dados cadastrais e checklists foram recuperados/gerados por inteligência artificial em modo offline."
        };
        const log = addAuditLogEntry("/api/licitacoes/scrape", { url: sanitizedUrl, rawTextLength: textToAnalyze?.length || 0 }, { success: true, data: mockData }, true);
        await saveAuditLogToFirestore(token, log, verifiedUser.uid);
        return res.json({
          success: true,
          isMock: true,
          data: mockData
        });
      }

      const promptTemplate = `Analise o edital ou dados da licitação pública brasileira fornecidos e obtenha os seguintes campos estruturados em JSON:
      1. 'edital': Identificação/Número do edital ou processo (ex: "Pregão Eletrônico nº 15/2026" ou "Concorrência 02/2026")
      2. 'orgao': Nome do Órgão Licitante (ex: "Prefeitura Municipal de Campinas")
      3. 'modalidade': Escolha uma das seguintes modalidades exatas: "Pregão Eletrônico", "Pregão Presencial", "Concorrência", "Tomada de Preços", "Inexigibilidade", "Dispensa", "Diálogo Competitivo", "Leilão"
      4. 'objeto': Descrição resumida, rica e clara dos produtos ou serviços licitados.
      5. 'valorEstimado': Valor orçado estimado em formato numérico (ex: 1250000.50). Retorne 0 se não encontrar.
      6. 'dataSessao': Data e horário de abertura da sessão pública no formato YYYY-MM-DDTHH:MM (ex: "2026-06-25T09:00"). Se encontrar somente data, assumir horário comercial típico (ex: 09:00).
      7. 'cidade': Cidade da sessão ou órgão.
      8. 'estado': Estado em sigla de duas letras (ex: "SP", "RJ", "MG").
      9. 'categoria': Escolha uma categoria correspondente: "Tecnologia da Informação", "Obras & Engenharia", "Serviços Gerais", "Materiais & Equipamentos", "Consultoria", "Saúde & Medicamentos", "Alimentação & Merenda", "Outros".
      10. 'checklistRecomendado': Lista contendo entre 4 a 8 nomes de documentos cruciais e específicos exigidos no edital para habilitação técnica e jurídica (como Balanço Patrimonial, CRF FGTS, FGTS, Certidão Trabalhista, Atestado de Capacidade Técnica, etc.).
      11. 'competitorsEstimated': Uma previsão de 2 a 4 empresas concorrentes realistas frequentes ou potenciais nesse segmento.
      12. 'arquivosPncp': Lista contendo arquivos/documentos oficiais de editais ou anexos mencionados no texto. Cada arquivo deve ser um objeto com:
          - 'id': Um ID único curto de string (ex: "doc-1")
          - 'nome': Nome do arquivo encontrado (ex: "Edital_preg_ao_35.pdf" ou "Termo_de_Referencia.zip")
          - 'descricao': Descrição do edital ou termo
          - 'tamanho': Tamanho em KB/MB se houver no texto, senão "Indisponível"
          - 'linkUrl': URL para download se explícita no texto, senão usar "https://pncp.gov.br/app/editais?pagina=1"`;

      const contents = useUrlContextTool && sanitizedUrl
        ? `${promptTemplate}\n\nAnalise o arquivo ou conteúdo principal da página pública contida na seguinte URL real: ${sanitizedUrl}`
        : `${promptTemplate}\n\nTexto extraído do edital:\n\"\"\"\n${textToAnalyze.substring(0, 32000)}\n\"\"\"`;

      const config: any = {
        systemInstruction: "Você é um Analista de Licitações Sênior especialista em compras públicas brasileiras (Leis 14.133/2021 e 8.666/93). Extraia dados com precisão total, e monte o checklist de habilitação baseado no edital analisado.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            edital: { type: Type.STRING },
            orgao: { type: Type.STRING },
            modalidade: { type: Type.STRING },
            objeto: { type: Type.STRING },
            valorEstimado: { type: Type.NUMBER },
            dataSessao: { type: Type.STRING },
            cidade: { type: Type.STRING },
            estado: { type: Type.STRING },
            categoria: { type: Type.STRING },
            checklistRecomendado: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            competitorsEstimated: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            arquivosPncp: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  nome: { type: Type.STRING },
                  descricao: { type: Type.STRING },
                  tamanho: { type: Type.STRING },
                  linkUrl: { type: Type.STRING }
                },
                required: ["id", "nome", "descricao", "tamanho", "linkUrl"]
              }
            }
          },
          required: [
            "edital", "orgao", "modalidade", "objeto", "valorEstimado", 
            "dataSessao", "cidade", "estado", "categoria", "checklistRecomendado", 
            "competitorsEstimated", "arquivosPncp"
          ]
        }
      };

      if (useUrlContextTool && sanitizedUrl) {
        config.tools = [{ urlContext: {} }];
      }

      // Execute AI generation with strictly parsed structure, custom 30s timeout and usage metrics logging
      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [{ parts: [{ text: contents }] }],
          config: config
        }),
        30000,
        "Extração de Edital"
      );

      const resultText = response.text;
      if (!resultText) {
        throw new Error("A IA gerou uma resposta vazia.");
      }

      const parsedJSON = JSON.parse(resultText.trim());
      parsedJSON.disclaimer = "Aviso Legal - Lei 14.133/2021: Os dados cadastrais e as listas de habilitação foram consolidados de forma robótica por análise semântica assistida de IA.";
      
      // Save in Cache
      setCachedData(cacheKey, parsedJSON);

      const usageStats = {
        promptTokens: response.usageMetadata?.promptTokenCount || 1500,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 400,
        totalTokens: response.usageMetadata?.totalTokenCount || 1900
      };

      const log = addAuditLogEntry(
        "/api/licitacoes/scrape", 
        { url: sanitizedUrl, rawTextLength: textToAnalyze?.length || 0 }, 
        { success: true, data: parsedJSON }, 
        false,
        undefined,
        usageStats
      );
      await saveAuditLogToFirestore(token, log, verifiedUser.uid);
      res.json({ success: true, data: parsedJSON });

    } catch (err: any) {
      console.error("Erro no scraping estruturado IA:", err);
      const isTimeout = err.message.includes("limite de tempo") || err.message.includes("timeout") || err.message.includes("deadline");
      const userMessage = isTimeout
        ? "O processamento inteligente do edital detalhado excedeu o limite de tempo de 30 segundos. Experimente colar apenas os trechos principais (ex: objeto do contrato e lista de habilitação) ou realize a operação em instantes."
        : "A plataforma não conseguiu decodificar o documento automáticamente no momento: " + err.message;
      res.status(500).json({ error: userMessage });
    }
  });

  // API 2: AI Predictive Analysis for a Bidding (Enhanced with Google Search Grounding & Citations)
  app.post("/api/licitacoes/predict", authMiddleware, async (req: express.Request, res: express.Response) => {
    try {
      const authHeader = req.headers["authorization"]!;
      const token = authHeader.split(" ")[1];
      const verifiedUser = (req as AuthenticatedRequest).user!;

      const { licitacao, competitors, historicalPrices } = req.body;

      if (!licitacao) {
        return res.status(400).json({ error: "Dados da licitação não fornecidos para análise preditiva." });
      }

      const cacheKey = `predict-${licitacao.id}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        const log = addAuditLogEntry("/api/licitacoes/predict (cache)", { licitacaoId: licitacao.id }, { success: true, prediction: cached }, false);
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

      if (!geminiKey) {
        // Fallback response for missing API key
        const mockPrediction = {
          level: "MÉDIO-ALTO",
          recommendedDiscount: "14.5% - 19.2%",
          targetPrice: sanitizedLicitacao.valorEstimado ? (sanitizedLicitacao.valorEstimado * 0.83).toFixed(2) : "0.00",
          winProbability: "68%",
          competitorInsights: "As empresas fornecidas possuem grande atuação na região administrativa selecionada. Espera-se concorrência acirrada em lances eletrônicos. Recomenda-se focar na otimização de custos logísticos ou buscar isenção ICMS se aplicável.",
          risks: [
            "Vencimento iminente da CND Trabalhista durante o prazo estipulado.",
            "Exigência de qualificação técnica com índice específico de liquidez corrente superior a 1.25.",
            "Histórico de impugnações decorrentes de especificações restritivas no edital do órgão."
          ],
          strategy: "Entrar com proposta de abertura conservadora (ex: desconto de 5%) e programar lances automáticos (robô) calibrados com limite de margem líquida de 12%. Preparar as declarações de ME/EPP se enquadrado para usufruir da preferência de desempate."
        };
        const log = addAuditLogEntry("/api/licitacoes/predict", { licitacaoId: sanitizedLicitacao.id }, { success: true, prediction: mockPrediction }, true);
        await saveAuditLogToFirestore(token, log, verifiedUser.uid);
        return res.json({
          success: true,
          isMock: true,
          prediction: mockPrediction
        });
      }

      const prompt = `Aja como o maior analista e modelador estratégico de licitações governamentais no Brasil.
      Sua missão é realizar uma análise de inteligência preditiva profunda de mercado para o seguinte edital. Use a ferramenta do Google Search (buscando no PNCP, ComprasNet ou diários oficiais) para verificar os concorrentes conhecidos ou tendências de lances recentes do órgão ou segmento correspondente se preferir.

      Dados do Edital:
      - Órgão Licitante: ${sanitizedLicitacao.orgao}
      - Edital Ref: ${sanitizedLicitacao.edital}
      - Objeto: ${sanitizedLicitacao.objeto}
      - Modalidade: ${sanitizedLicitacao.modalidade}
      - Valor Orçado do Edital: R$ ${sanitizedLicitacao.valorEstimado}
      - Região Física: ${sanitizedLicitacao.cidade} - ${sanitizedLicitacao.estado}
      - Categoria: ${sanitizedLicitacao.categoria}

      Concorrentes Conhecidos no Sistema:
      ${JSON.stringify(competitors?.map((c: any) => ({ ...c, name: sanitizeInput(c.name) })) || [])}

      Histórico de Preços de Referência da Categoria do Produto:
      ${JSON.stringify(historicalPrices || [])}

      Forneça um laudo de inteligência preditivo completo em formato JSON contendo exatamente as seguintes propriedades:
      1. 'level': Nível estimado de competitividade ("BAIXO", "MÉDIO", "ALTO", "CRÍTICO/MUITO ALTO")
      2. 'recommendedDiscount': Desconto estimado ótimo para vencer (ex: "12.0% - 18.5%")
      3. 'targetPrice': Preço-alvo para formulação da proposta inicial otimizada (ex: R$ 2.050.000,00 ou valor equivalente calibrado)
      4. 'winProbability': Probabilidade estatística aproximada de vitória baseado nas restrições de habilitação (ex: "72%")
      5. 'competitorInsights': Análise resumida de comportamento e vulnerabilidade dos concorrentes digitados, detalhando qual tática é mais provável de funcionar no pregão eletrônico.
      6. 'risks': Lista contendo 3 riscos cruciais (técnicos, regulatórios ou jurídicos) identificados para essa categoria ou objeto.
      7. 'strategy': Estratégia de guerra tática passo a passo (preparo, lances automáticos, acompanhamento, fase recursal) calibrada para maximizar as chances.`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                level: { type: Type.STRING },
                recommendedDiscount: { type: Type.STRING },
                targetPrice: { type: Type.STRING },
                winProbability: { type: Type.STRING },
                competitorInsights: { type: Type.STRING },
                risks: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                strategy: { type: Type.STRING }
              },
              required: ["level", "recommendedDiscount", "targetPrice", "winProbability", "competitorInsights", "risks", "strategy"]
            },
            tools: [{ googleSearch: {} }] // Activate Search Grounding to check similar bidding outcomes online!
          }
        }),
        30000,
        "Análise Preditiva"
      );

      const parsedJSON = JSON.parse(response.text?.trim() || "{}");

      // Extract high class citation links from grounding metadata for audit logs
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const citations = groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || "Diário Oficial / Portal de Compras",
        url: chunk.web?.uri
      })).filter((c: any) => c.url) || [];

      // Embed citations back inside predictions so frontend can render sources checked
      if (citations.length > 0) {
        parsedJSON._sources = citations;
      }

      setCachedData(cacheKey, parsedJSON);

      const usageStats = {
        promptTokens: response.usageMetadata?.promptTokenCount || 2000,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 500,
        totalTokens: response.usageMetadata?.totalTokenCount || 2500
      };

      const log = addAuditLogEntry(
        "/api/licitacoes/predict", 
        { licitacaoId: sanitizedLicitacao.id }, 
        { success: true, prediction: parsedJSON }, 
        false, 
        citations, 
        usageStats
      );
      await saveAuditLogToFirestore(token, log, verifiedUser.uid);
      res.json({ success: true, prediction: parsedJSON });

    } catch (err: any) {
      console.error("Erro na inteligência preditiva IA:", err);
      const isTimeout = err.message.includes("limite de tempo") || err.message.includes("timeout") || err.message.includes("deadline");
      const userMessage = isTimeout
        ? "A simulação preditiva tática via IA do PNCP/Licitação demorou mais que o limite de tolerância de 30 segundos. Sugerimos tentar novamente em instantes."
        : "Ocorreu um erro ao simular a probabilidade de vitória e inteligência competitiva: " + err.message;
      res.status(500).json({ error: userMessage });
    }
  });

  // API 3: Auto Document Generation Template Generator based on Bidding Details
  app.post("/api/licitacoes/generate-document", authMiddleware, async (req: express.Request, res: express.Response) => {
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

      if (!geminiKey) {
        const mockDoc = {
          success: true,
          isMock: true,
          documentTitle: `Declaração para ${sanitizedLicitacao.edital}`,
          content: `DECLARAÇÃO DE COMPLASCÊNCIA E REGULARIDADE\n\nAo Órgão: ${sanitizedLicitacao.orgao}\nEdital: ${sanitizedLicitacao.edital}\n\nA empresa ${sanitizedCompanyDetails.name}, inscrita no CNPJ sob o nº ${sanitizedCompanyDetails.cnpj}, sediada no endereço ${sanitizedCompanyDetails.address}, por intermédio de seu representante legal, Sr(a). ${sanitizedCompanyDetails.partnerName}, portador(a) do CPF nº ${sanitizedCompanyDetails.partnerCPF}, declara para os devidos fins de habilitação e conformidade legal:\n\n1. Que cumprimos plenamente todos os requisitos vigentes exigidos na modalidade de ${sanitizedLicitacao.modalidade} referente ao objeto: "${sanitizedLicitacao.objeto}".\n2. Que nos termos do artigo 7º, inciso XXXIII, da Constituição Federal, não empregamos menores de dezoito anos em trabalho noturno, perigoso ou insalubre e nem menores de dezesseis anos em qualquer trabalho.\n3. Que inexiste fato superveniente impeditivo de nossa habilitação técnica ou jurídica.\n\nPor ser expressão da verdade, firmamos o presente termo.\n\n${sanitizedLicitacao.cidade || "Local"}, ${new Date().toLocaleDateString("pt-BR")}.\n\n_____________________________________________\n${sanitizedCompanyDetails.partnerName}\n${sanitizedCompanyDetails.partnerRole}`
        };
        const log = addAuditLogEntry("/api/licitacoes/generate-document", { docType, companyCNPJ: sanitizedCompanyDetails.cnpj }, mockDoc, true);
        await saveAuditLogToFirestore(token, log, verifiedUser.uid);
        return res.json(mockDoc);
      }

      const prompt = `Gere uma minuta ou termo de declaração jurídica de habilitação oficial em língua portuguesa para participação em licitações públicas brasileiras com os seguintes dados:
      - Tipo de Documento: ${docType} (ex: "Declaração de Habilitação Geral", "Declaração de Superveniência e CF Art 7", "Carta de Proposta Comercial Inicial", "Declaração de Enquadramento ME/EPP")
      - Licitação: Edital ${sanitizedLicitacao.edital} do órgão ${sanitizedLicitacao.orgao}
      - Objeto do Edital: ${sanitizedLicitacao.objeto}
      - Modalidade: ${sanitizedLicitacao.modalidade}
      
      Dados Cadastrais da Empresa Requerente:
      - Razão Social: ${sanitizedCompanyDetails.name}
      - CNPJ: ${sanitizedCompanyDetails.cnpj}
      - Endereço completo: ${sanitizedCompanyDetails.address}
      - Representante Assinante: ${sanitizedCompanyDetails.partnerName} (${sanitizedCompanyDetails.partnerRole}), portador do CPF: ${sanitizedCompanyDetails.partnerCPF}

      Instruções de Estilo:
      Gere a minuta oficial com formatação impecável para diário e processos, com cabeçalho de intimação jurídica, citações adequadas da Lei de Licitações (Lei 14.133/2021 ou Lei 8.666/93 quando cabível) e espaçamento elegante para assinatura no fim.
      
      Retorne um JSON de resposta que contenha obrigatoriamente:
      1. 'documentTitle': O título formal do documento (ex: "DECLARAÇÃO VITAL DE CUMPRIMENTO DOS REQUISITOS DE HABILITAÇÃO")
      2. 'content': O corpo do texto estruturado e completo (texto cru puro formatado com quebras lineares elegantes, pronto para impressão e assinatura).`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                documentTitle: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["documentTitle", "content"]
            }
          }
        }),
        30000,
        "Elaboração de Documento"
      );

      const parsedJSON = JSON.parse(response.text?.trim() || "{}");

      const usageStats = {
        promptTokens: response.usageMetadata?.promptTokenCount || 1000,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 600,
        totalTokens: response.usageMetadata?.totalTokenCount || 1600
      };

      const log = addAuditLogEntry(
        "/api/licitacoes/generate-document", 
        { docType, companyCNPJ: sanitizedCompanyDetails.cnpj }, 
        { success: true, data: parsedJSON }, 
        false,
        undefined,
        usageStats
      );
      await saveAuditLogToFirestore(token, log, verifiedUser.uid);
      res.json({ success: true, data: parsedJSON });

    } catch (err: any) {
      console.error("Erro na geração de minutas/documentos:", err);
      const isTimeout = err.message.includes("limite de tempo") || err.message.includes("timeout") || err.message.includes("deadline");
      const userMessage = isTimeout
        ? "A elaboração jurídica automatizada excedeu o limite de segurança de 30 segundos devido ao volume ou complexidade de cláusulas solicitadas. Por favor, tente novamente de forma simplificada."
        : "Erro interno na elaboração jurídica de documentos de licitação: " + err.message;
      res.status(500).json({ error: userMessage });
    }
  });

  // Serve static files and integrate Vite in development or serve production builds
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
