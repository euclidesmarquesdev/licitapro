import { logger } from "./logger.js";
import { getCachedData, setCachedData, isRedisConnected } from "../config/redis.js";
import { verifyIdToken, isFirebaseAdminReady } from "../config/firebase.js";
import { isGeminiConfigured } from "../services/gemini.js";

export interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP" | "WARN";
  message?: string;
  duration: number;
  details?: any;
}

export interface TestSuite {
  name: string;
  tests: (() => Promise<TestResult>)[];
}

// ============================================================
// TESTES INDIVIDUAIS
// ============================================================

// 1. Teste de Conexão com Firebase
export async function testFirebaseConnection(): Promise<TestResult> {
  const start = Date.now();
  try {
    const token = process.env.TEST_TOKEN || "VIRTUAL_TOKEN_test|test@test.com";
    const result = await verifyIdToken(token);
    
    if (result && result.uid) {
      return {
        name: "Firebase Connection",
        status: "PASS",
        message: `Autenticado como ${result.email || result.uid}`,
        duration: Date.now() - start
      };
    }
    
    return {
      name: "Firebase Connection",
      status: "FAIL",
      message: "Falha ao verificar token",
      duration: Date.now() - start
    };
  } catch (error: any) {
    return {
      name: "Firebase Connection",
      status: "FAIL",
      message: error.message,
      duration: Date.now() - start
    };
  }
}

// 2. Teste de Conexão com Redis
export async function testRedisConnection(): Promise<TestResult> {
  const start = Date.now();
  try {
    if (!isRedisConnected) {
      return {
        name: "Redis Connection",
        status: "WARN",
        message: "Redis não configurado (modo memória)",
        duration: Date.now() - start
      };
    }
    
    // Tenta escrever e ler
    await setCachedData("test-key", { test: true }, 1000);
    const data = await getCachedData("test-key");
    
    if (data && data.test === true) {
      return {
        name: "Redis Connection",
        status: "PASS",
        message: "Cache Redis operacional",
        duration: Date.now() - start
      };
    }
    
    return {
      name: "Redis Connection",
      status: "FAIL",
      message: "Falha ao escrever/ler do Redis",
      duration: Date.now() - start
    };
  } catch (error: any) {
    return {
      name: "Redis Connection",
      status: "FAIL",
      message: error.message,
      duration: Date.now() - start
    };
  }
}

// 3. Teste de Conexão com Gemini
export async function testGeminiConnection(): Promise<TestResult> {
  const start = Date.now();
  try {
    if (!isGeminiConfigured) {
      return {
        name: "Gemini Connection",
        status: "WARN",
        message: "Gemini não configurado (modo mock)",
        duration: Date.now() - start
      };
    }
    
    const { ai } = await import("../services/gemini.js");
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: "Responda apenas: OK" }] }]
    });
    
    if (response.text && response.text.trim() === "OK") {
      return {
        name: "Gemini Connection",
        status: "PASS",
        message: "Gemini API operacional",
        duration: Date.now() - start
      };
    }
    
    return {
      name: "Gemini Connection",
      status: "FAIL",
      message: "Resposta inesperada da API",
      duration: Date.now() - start
    };
  } catch (error: any) {
    return {
      name: "Gemini Connection",
      status: "FAIL",
      message: error.message,
      duration: Date.now() - start
    };
  }
}

// 4. Teste da API do PNCP
export async function testPncpApi(): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(
      "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=20260601&dataFinal=20260622&pagina=1&tamanhoPagina=1",
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0"
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.data || data.resultado) {
        return {
          name: "PNCP API",
          status: "PASS",
          message: "API do PNCP respondendo",
          duration: Date.now() - start
        };
      }
    }
    
    return {
      name: "PNCP API",
      status: "WARN",
      message: `Status ${response.status}`,
      duration: Date.now() - start
    };
  } catch (error: any) {
    return {
      name: "PNCP API",
      status: "FAIL",
      message: error.message,
      duration: Date.now() - start
    };
  }
}

// 5. Teste de Conexão com Firestore
export async function testFirestoreConnection(): Promise<TestResult> {
  const start = Date.now();
  try {
    if (!isFirebaseAdminReady()) {
      return {
        name: "Firestore Connection",
        status: "WARN",
        message: "Admin SDK não inicializado (modo offline)",
        duration: Date.now() - start
      };
    }
    
    const { getFirestore } = await import("firebase-admin/firestore");
    const db = getFirestore();
    await db.collection("_health_check").doc("ping").set({ timestamp: Date.now() });
    
    return {
      name: "Firestore Connection",
      status: "PASS",
      message: "Firestore operacional",
      duration: Date.now() - start
    };
  } catch (error: any) {
    return {
      name: "Firestore Connection",
      status: "FAIL",
      message: error.message,
      duration: Date.now() - start
    };
  }
}

// ============================================================
// EXECUTOR DE TESTES
// ============================================================

export async function runTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  const tests: (() => Promise<TestResult>)[] = [
    testFirebaseConnection,
    testRedisConnection,
    testGeminiConnection,
    testPncpApi,
    testFirestoreConnection
  ];
  
  for (const test of tests) {
    try {
      const result = await test();
      results.push(result);
      // Log do resultado
      const icon = result.status === "PASS" ? "✅" :
                   result.status === "WARN" ? "⚠️" : "❌";
      logger.info(`${icon} ${result.name} - ${result.status} (${result.duration}ms)`);
    } catch (error: any) {
      results.push({
        name: test.name || "Unknown Test",
        status: "FAIL",
        message: error.message,
        duration: 0
      });
    }
  }
  
  // Log do resumo
  const passCount = results.filter(r => r.status === "PASS").length;
  const warnCount = results.filter(r => r.status === "WARN").length;
  const failCount = results.filter(r => r.status === "FAIL").length;
  
  logger.info(`Testes concluídos: ${passCount} PASS, ${warnCount} WARN, ${failCount} FAIL`);
  
  return results;
}