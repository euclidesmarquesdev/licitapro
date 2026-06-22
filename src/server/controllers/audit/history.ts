import express from "express";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { getAuditLogsFromFirestore, getInMemoryAuditLogs } from "../../services/audit.js";

export async function handleGetAuditHistory(req: express.Request, res: express.Response) {
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

    const logs = await getAuditLogsFromFirestore(token, verifiedUser.uid);
    res.json({ success: true, logs });

  } catch (err: any) {
    console.error("[Audit History] Erro:", err);
    res.json({ success: true, logs: getInMemoryAuditLogs() });
  }
}