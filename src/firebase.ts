/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigJson.measurementId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Resolves the appropriate authentication token for API requests.
 * Supports native Firebase user session or virtual offline user fallback sessions.
 */
export async function getClientAuthToken(): Promise<string> {
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const idToken = await currentUser.getIdToken();
      if (idToken) return idToken;
    } catch (e) {
      console.warn("Falha ao obter token nativo do Firebase, usando fallback virtual:", e);
    }
  }

  // Fallback checking for local/virtual session in localStorage (useful for iFrame safe-mode)
  const savedVirtual = localStorage.getItem("LICI_TRACK_V1_virtual_user");
  if (savedVirtual) {
    try {
      const parsed = JSON.parse(savedVirtual);
      if (parsed && parsed.uid) {
        return `VIRTUAL_TOKEN_${parsed.uid}|${parsed.email || "anonimo@licitapro.gov"}`;
      }
    } catch (_) {}
  }

  // General guest mode fallback
  return "VIRTUAL_TOKEN_guest-user|guest@licitapro.dev";
}

export { signInWithPopup, signOut };
