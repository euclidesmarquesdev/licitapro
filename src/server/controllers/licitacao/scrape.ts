import express from "express";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { sanitizeInput } from "../../utils/sanitization.js";
import { getCachedData, setCachedData } from "../../config/redis.js";
import { extractBiddingMetadata } from "../../services/gemini.js";
import { addAuditLogEntry, saveAuditLogToFirestore } from "../../services/audit.js";

// Domínios permitidos para scraping
const ALLOWED_DOMAINS = [
  "pncp.gov.br",
  "comprasnet.gov.br",
  "comprasgovernamentais.gov.br",
  "transparencia.gov.br",
  "portaldatransparencia.gov.br"
];

function isUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname.endsWith(".gov.br")) return true;
    return ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export async function handleScrapeBidding(req: express.Request, res: express.Response) {
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

    const { url, rawText } = req.body;
    const sanitizedUrl = sanitizeInput(url);
    const sanitizedRawText = sanitizeInput(rawText);

    // ✅ SSRF Protection
    if (sanitizedUrl && !isUrlAllowed(sanitizedUrl)) {
      return res.status(400).json({
        error: "URL não autorizada. Apenas domínios governamentais (.gov.br) são permitidos.",
        code: "SCRAPE_001"
      });
    }

    const cacheKey = sanitizedUrl
      ? `scrape-${sanitizedUrl}`
      : `scrape-hash-${(sanitizedRawText || "").substring(0, 100)}-${(sanitizedRawText || "").length}`;

    // Check cache
    const cached = await getCachedData(cacheKey);
    if (cached) {
      const log = addAuditLogEntry(
        "/api/licitacoes/scrape (cache)",
        { url: sanitizedUrl },
        { success: true, data: cached },
        false
      );
      await saveAuditLogToFirestore(token, log, verifiedUser.uid);
      return res.json({ success: true, data: cached, isCached: true });
    }

    let textToAnalyze = sanitizedRawText || "";
    let useUrlContextTool = false;

    // Fetch if URL provided but no text
    if (sanitizedUrl && !textToAnalyze) {
      try {
        const fetchRes = await fetch(sanitizedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          textToAnalyze = html
            .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
            .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .substring(0, 45000);
        } else {
          useUrlContextTool = true;
        }
      } catch {
        useUrlContextTool = true;
      }
    }

    if (!useUrlContextTool && (!textToAnalyze || textToAnalyze.trim().length === 0)) {
      return res.status(400).json({
        error: "Nenhum texto ou URL de edital válido foi fornecido."
      });
    }

    // Extract metadata
    const { parsed, isMock, usage } = await extractBiddingMetadata(
      textToAnalyze,
      sanitizedUrl,
      useUrlContextTool
    );

    await setCachedData(cacheKey, parsed);

    const log = addAuditLogEntry(
      "/api/licitacoes/scrape",
      { url: sanitizedUrl, textLength: textToAnalyze?.length || 0 },
      { success: true, data: parsed },
      isMock,
      undefined,
      usage
    );
    await saveAuditLogToFirestore(token, log, verifiedUser.uid);

    res.json({ success: true, isMock, data: parsed });

  } catch (err: any) {
    console.error("[Scrape] Erro:", err);
    const isTimeout = err.message.includes("timeout") || err.message.includes("deadline");
    res.status(500).json({
      error: isTimeout
        ? "O processamento excedeu o limite de tempo. Tente com trechos menores."
        : "Erro ao processar o documento: " + err.message
    });
  }
}