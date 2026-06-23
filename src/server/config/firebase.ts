import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

let isFirebaseAdminInitialized = false;

try {
  if (!getApps().length) {
    initializeApp();
  }
  isFirebaseAdminInitialized = true;
  console.log("[LicitaPro Firebase] Firebase Admin SDK inicializado com sucesso.");
} catch (error: any) {
  console.warn("[LicitaPro Firebase] Alerta: Falha ao inicializar o Firebase Admin SDK (pode ser ausência de credenciais default no localdev). Utilizando REST API de fallback. Erro:", error.message);
}

// Load firebase config JSON for REST fallbacks & cloud logging parameters
export let firebaseConfig: any = {};
try {
  const rawConfig = fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8");
  firebaseConfig = JSON.parse(rawConfig);
} catch (error) {
  console.warn("[LicitaPro Firebase] Alerta: Não foi possível obter o firebase-applet-config.json. Backend operando em modo offline.");
}

export async function verifyIdToken(idToken: string): Promise<{ uid: string; email?: string; emailVerified?: boolean } | null> {
  if (!idToken) return null;

  // 0. Support VIRTUAL_TOKEN_ prefix bypass for iframe/nested development sessions and guest support
  if (idToken.startsWith("VIRTUAL_TOKEN_")) {
    const rawPayload = idToken.substring("VIRTUAL_TOKEN_".length);
    const parts = rawPayload.split("|");
    const uid = parts[0] || "guest-dev-user";
    const email = parts[1] || "guest@licitapro.dev";
    return {
      uid,
      email,
      emailVerified: true
    };
  }

  // 1. Try Native Firebase Admin SDK
  if (isFirebaseAdminInitialized) {
    try {
      const decodedToken = await getAuth().verifyIdToken(idToken);
      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified
      };
    } catch (err: any) {
      console.warn("[LicitaPro Firebase] Verificação nativa Admin SDK falhou. Tentando REST API fallback... Erro:", err.message);
    }
  }

  // 2. REST API fallback for local development or custom client-toolkit validations
  const apiKey = firebaseConfig.apiKey || process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.error("[LicitaPro Firebase] Erro Crítico de Segurança: API Key do Firebase não configurada no ambiente de produção. Operação negada.");
      return null;
    }
    console.warn("[LicitaPro Firebase] Alerta: API Key do Firebase não encontrada. Utilizando fallback local para desenvolvimento offline.");
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
      console.error("[LicitaPro Firebase] Erro na verificação do token no Google Client-Toolkit:", errBody);
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
    console.error("[LicitaPro Firebase] Falha geral ao verificar token via API do Google Auth:", err);
    return null;
  }
}

// ✅ EXPORTA A FUNÇÃO PARA SER USADA NOS TESTES
export function isFirebaseAdminReady(): boolean {
  return isFirebaseAdminInitialized;
}