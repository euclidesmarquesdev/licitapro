import express from "express";
import { logger } from "../utils/logger.js";
import { runTests, TestResult } from "../utils/testRunner.js";
import { isRedisConnected, getCacheSize } from "../config/redis.js";
import { isFirebaseAdminReady } from "../config/firebase.js";
import { isGeminiConfigured } from "../services/gemini.js";

const router = express.Router();

// ============================================================
// 1. HEALTH CHECK BÁSICO
// ============================================================
router.get("/health", (req, res) => {
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime / 60)} minutos`,
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
    dependencies: {
      firebase: isFirebaseAdminReady() ? "connected" : "offline",
      redis: isRedisConnected ? "connected" : "offline (memory mode)",
      gemini: isGeminiConfigured ? "configured" : "mock mode"
    },
    memory: {
      rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)} MB`
    },
    cache: {
      size: getCacheSize()
    }
  });
});

// ============================================================
// 2. LIVENESS PROBE
// ============================================================
router.get("/live", (req, res) => {
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// 3. READINESS PROBE
// ============================================================
router.get("/ready", async (req, res) => {
  try {
    // Verifica dependências críticas
    const firebaseReady = isFirebaseAdminReady();
    const redisReady = isRedisConnected;
    
    // Se Firebase não estiver pronto, não está ready
    if (!firebaseReady) {
      return res.status(503).json({
        status: "not_ready",
        reason: "Firebase não inicializado",
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(200).json({
      status: "ready",
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(503).json({
      status: "not_ready",
      reason: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================
// 4. TEST RUNNER - EXECUTA TODOS OS TESTES
// ============================================================
router.get("/tests", async (req, res) => {
  try {
    const results = await runTests();
    
    const passCount = results.filter(r => r.status === "PASS").length;
    const warnCount = results.filter(r => r.status === "WARN").length;
    const failCount = results.filter(r => r.status === "FAIL").length;
    
    const isHealthy = failCount === 0;
    
    res.status(isHealthy ? 200 : 500).json({
      success: isHealthy,
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        pass: passCount,
        warn: warnCount,
        fail: failCount
      },
      results
    });
  } catch (error: any) {
    logger.error("Erro ao executar testes", { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================
// 5. DIAGNÓSTICO DETALHADO
// ============================================================
router.get("/diagnostic", async (req, res) => {
  try {
    // Coleta informações detalhadas
    const diagnostic = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        env: process.env.NODE_ENV || "development"
      },
      dependencies: {
        firebase: {
          initialized: isFirebaseAdminReady(),
          projectId: process.env.FIREBASE_PROJECT_ID || "not set"
        },
        redis: {
          connected: isRedisConnected,
          url: process.env.REDIS_URL ? "configured" : "not set"
        },
        gemini: {
          configured: isGeminiConfigured,
          apiKey: process.env.GEMINI_API_KEY ? "set" : "not set"
        }
      },
      memory: {
        rss: process.memoryUsage().rss,
        heapTotal: process.memoryUsage().heapTotal,
        heapUsed: process.memoryUsage().heapUsed,
        external: process.memoryUsage().external
      },
      uptime: process.uptime(),
      cache: {
        size: getCacheSize()
      },
      routes: {
        total: 8,
        list: [
          "POST /api/licitacoes/scrape",
          "POST /api/licitacoes/predict",
          "POST /api/licitacoes/generate-document",
          "POST /api/pncp/import",
          "GET /api/pncp/search",
          "GET /api/ia/audit/history",
          "GET /api/usage",
          "GET /api/health"
        ]
      }
    };
    
    res.json(diagnostic);
  } catch (error: any) {
    logger.error("Erro no diagnóstico", { error: error.message });
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;