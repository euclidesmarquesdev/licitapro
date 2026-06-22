/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Carrega configuração APENAS de variáveis de ambiente
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Validação: se alguma credencial estiver faltando, erro claro
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn(
    '[LicitaPro] 🔒 Configuração do Firebase incompleta. ' +
    'Verifique se o arquivo .env.local está configurado corretamente.'
  );
}

const app = initializeApp(firebaseConfig);

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID;
export const db = databaseId 
  ? getFirestore(app, databaseId) 
  : getFirestore(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Obtém o token de autenticação para requisições à API.
 * Em produção, NUNCA usa VIRTUAL_TOKEN.
 * Em desenvolvimento, permite VIRTUAL_TOKEN para testes.
 */
export async function getClientAuthToken(): Promise<string> {
  const currentUser = auth.currentUser;
  
  // 1. PRIORIDADE: Token real do Firebase
  if (currentUser) {
    try {
      const idToken = await currentUser.getIdToken();
      if (idToken) {
        console.log('[Firebase] Token real obtido com sucesso.');
        return idToken;
      }
    } catch (e) {
      console.warn('[Firebase] Falha ao obter token nativo:', e);
    }
  }

  // 2. FALLBACK: VIRTUAL_TOKEN APENAS em desenvolvimento
  const isDev = import.meta.env.DEV;
  const allowVirtual = import.meta.env.VITE_ALLOW_VIRTUAL_TOKEN === 'true';
  
  if (isDev && allowVirtual) {
    const savedVirtual = localStorage.getItem("LICI_TRACK_V1_virtual_user");
    if (savedVirtual) {
      try {
        const parsed = JSON.parse(savedVirtual);
        if (parsed && parsed.uid) {
          const token = `VIRTUAL_TOKEN_${parsed.uid}|${parsed.email || "dev@licitapro.local"}`;
          console.log('[Firebase] Token virtual gerado para desenvolvimento.');
          return token;
        }
      } catch (_) {
        console.warn('[Firebase] Erro ao parsear usuário virtual.');
      }
    }
    
    // ✅ CRUCIAL: Se estamos em desenvolvimento e não temos usuário virtual,
    // Cria um usuário virtual automaticamente para não quebrar o fluxo
    console.log('[Firebase] Criando usuário virtual automaticamente para desenvolvimento...');
    const virtualUser = {
      uid: `dev-user-${Date.now()}`,
      displayName: "Dev User",
      email: "dev@licitapro.local",
      photoURL: null,
      isVirtual: true,
    };
    localStorage.setItem("LICI_TRACK_V1_virtual_user", JSON.stringify(virtualUser));
    
    // Atualiza o estado do auth para refletir o usuário virtual
    // Isso é feito via listener no useAuth
    return `VIRTUAL_TOKEN_${virtualUser.uid}|${virtualUser.email}`;
  }

  // 3. ERRO: Sem autenticação
  console.error('[Firebase] Usuário não autenticado.');
  throw new Error("Usuário não autenticado. Faça login para continuar.");
}

export { signInWithPopup, signOut };