import express from "express";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { sanitizeInput } from "../../utils/sanitization.js";
import { draftGovernmentDocument } from "../../services/gemini.js";
import { addAuditLogEntry, saveAuditLogToFirestore } from "../../services/audit.js";

export async function handleGenerateDocument(req: express.Request, res: express.Response) {
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

    const { docType, licitacao, ourCompanyDetails } = req.body;

    if (!licitacao) {
      return res.status(400).json({ error: "Dados da licitação são necessários." });
    }

    const defaultCompany = {
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

    const sanitizedCompany = {
      name: sanitizeInput(ourCompanyDetails?.name || defaultCompany.name),
      cnpj: sanitizeInput(ourCompanyDetails?.cnpj || defaultCompany.cnpj),
      address: sanitizeInput(ourCompanyDetails?.address || defaultCompany.address),
      partnerName: sanitizeInput(ourCompanyDetails?.partnerName || defaultCompany.partnerName),
      partnerCPF: sanitizeInput(ourCompanyDetails?.partnerCPF || defaultCompany.partnerCPF),
      partnerRole: sanitizeInput(ourCompanyDetails?.partnerRole || defaultCompany.partnerRole)
    };

    const { draft, isMock, usage } = await draftGovernmentDocument(
      docType,
      sanitizedLicitacao,
      sanitizedCompany
    );

    const log = addAuditLogEntry(
      "/api/licitacoes/generate-document",
      { docType },
      { success: true, data: draft },
      isMock,
      undefined,
      usage
    );
    await saveAuditLogToFirestore(token, log, verifiedUser.uid);

    res.json({ success: true, isMock, data: draft });

  } catch (err: any) {
    console.error("[Document] Erro:", err);
    const isTimeout = err.message.includes("timeout") || err.message.includes("deadline");
    res.status(500).json({
      error: isTimeout
        ? "A geração do documento excedeu o limite de tempo."
        : "Erro na geração do documento: " + err.message
    });
  }
}