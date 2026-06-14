import crypto from "crypto";
import { firebaseConfig } from "../config/firebase";

export interface AIAuditLog {
  id: string;
  timestamp: string;
  endpoint: string;
  payload: any;
  response: any;
  isMock: boolean;
  signature: string;
  previousSignature: string;
  citations?: { title: string; url: string }[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// In-memory registry state
const inMemoryAuditLogs: AIAuditLog[] = [];
let lastSignature = "GENESIS-INITIAL-BLOCK-HASH-OBC14133-2026-LICITAPRO";

// Utility metrics state
export const tokenUsageMetrics = {
  totalRequests: 0,
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalTokens: 0,
  endpoints: {} as Record<string, { requests: number; tokens: number }>
};

/**
 * Computes a SHA-256 hash for a block-log entry to guarantee compliance ledger immutability (Blockchain-Light)
 */
function computeBlockSignature(log: Omit<AIAuditLog, "signature">): string {
  const payloadStr = JSON.stringify(log.payload || {});
  const responseStr = JSON.stringify(log.response || {});
  const rawBlock = `${log.id}|${log.timestamp}|${log.endpoint}|${payloadStr}|${responseStr}|${log.isMock}|${log.previousSignature}`;
  return crypto.createHash("sha256").update(rawBlock).digest("hex");
}

/**
 * Saves a single block-log entry to Firestore audit-trail using firestore API proxy
 */
export async function saveAuditLogToFirestore(idToken: string, log: AIAuditLog, userId: string) {
  try {
    const projectId = firebaseConfig.projectId;
    if (!projectId || !idToken || idToken.startsWith("VIRTUAL_TOKEN_")) {
      console.log(`[LicitaPro Audit] Sessão offline/virtual detectada para bloco ${log.id}. Mantendo log local em memória.`);
      return;
    }
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
        previousSignature: { stringValue: log.previousSignature },
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
      console.error("[LicitaPro Audit] Falha ao persistir log imutável no Firestore:", await res.text());
    } else {
      console.log(`[LicitaPro Audit] Bloco de auditoria imutável ${logId} assinado com sucesso.`);
    }
  } catch (err) {
    console.error("[LicitaPro Audit] Erro ao sincronizar cadeia de auditoria no Firestore:", err);
  }
}

/**
 * Retrieves the verification history of logs from Firestore
 */
export async function getAuditLogsFromFirestore(idToken: string, userId: string): Promise<AIAuditLog[]> {
  try {
    const projectId = firebaseConfig.projectId;
    if (!projectId || !idToken || idToken.startsWith("VIRTUAL_TOKEN_")) {
      console.log("[LicitaPro Audit] Sessão offline/virtual. Retornando logs locais em memória.");
      return getInMemoryAuditLogs();
    }
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
      console.error("[LicitaPro Audit] Falha ao ler logs estruturados do Firestore:", await res.text());
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
          previousSignature: fields.previousSignature?.stringValue || "",
          payload: fields.payloadStr?.stringValue ? JSON.parse(fields.payloadStr.stringValue) : {},
          response: fields.responseStr?.stringValue ? JSON.parse(fields.responseStr.stringValue) : {},
          citations: fields.citationsStr?.stringValue ? JSON.parse(fields.citationsStr.stringValue) : [],
          usage: fields.usageStr?.stringValue ? JSON.parse(fields.usageStr.stringValue) : undefined
        });
      }
    }

    // Sort by chronological timestamp
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return logs;
  } catch (err) {
    console.error("[LicitaPro Audit] Erro catastrófico ao sincronizar logs de auditoria:", err);
    return [];
  }
}

/**
 * Appends a log entry inside the system with signature chain binding
 */
export function addAuditLogEntry(
  endpoint: string,
  payload: any,
  response: any,
  isMock: boolean,
  citations?: { title: string; url: string }[],
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
): AIAuditLog {
  const partialLog = {
    id: "ia-log-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    endpoint,
    payload,
    response,
    isMock,
    previousSignature: lastSignature,
    citations,
    usage
  };

  // Cryptographically seal the block with its ancestor signature hash (blockchain-light)
  const signature = computeBlockSignature(partialLog);
  const logEntry: AIAuditLog = { ...partialLog, signature };
  
  // Pivot the chain tip pointer
  lastSignature = signature;

  // Track operational metrics
  const tokensObj = usage || {
    promptTokens: isMock ? 350 : 1500,
    completionTokens: isMock ? 50 : 400,
    totalTokens: isMock ? 400 : 1900
  };

  tokenUsageMetrics.totalRequests += 1;
  tokenUsageMetrics.totalPromptTokens += tokensObj.promptTokens;
  tokenUsageMetrics.totalCompletionTokens += tokensObj.completionTokens;
  tokenUsageMetrics.totalTokens += tokensObj.totalTokens;

  if (!tokenUsageMetrics.endpoints[endpoint]) {
    tokenUsageMetrics.endpoints[endpoint] = { requests: 0, tokens: 0 };
  }
  tokenUsageMetrics.endpoints[endpoint].requests += 1;
  tokenUsageMetrics.endpoints[endpoint].tokens += tokensObj.totalTokens;

  inMemoryAuditLogs.unshift(logEntry);
  if (inMemoryAuditLogs.length > 200) {
    inMemoryAuditLogs.pop();
  }

  return logEntry;
}

export function getInMemoryAuditLogs(): AIAuditLog[] {
  return inMemoryAuditLogs;
}
