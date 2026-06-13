import express from "express";
import { verifyIdToken } from "../config/firebase";

export interface AuthenticatedRequest extends express.Request {
  user?: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
  };
}

export async function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "LicitaPro Security: Acesso não autorizado. Token de sessão do Google/Firebase ausente."
    });
  }

  const token = authHeader.split(" ")[1];
  const verifiedUser = await verifyIdToken(token);
  if (!verifiedUser) {
    return res.status(403).json({
      error: "LicitaPro Security: Token expirado ou assinatura inválida. Por favor, refaça o login na aplicação."
    });
  }

  (req as AuthenticatedRequest).user = verifiedUser;
  next();
}
