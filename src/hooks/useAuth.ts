import { useState, useEffect } from "react";
import { auth, googleProvider, signInWithPopup, signOut } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

// Gera usuário virtual com dados genéricos
const getVirtualUser = () => ({
  uid: `demo-user-${Date.now()}`,
  displayName: import.meta.env.VITE_DEMO_USER_NAME || "Usuário Demo",
  email: import.meta.env.VITE_DEMO_USER_EMAIL || "demo@licitapro.local",
  photoURL: null,
  isVirtual: true,
});

export function useAuth() {
  const [user, setUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Usuário autenticado via Firebase
        console.log('[useAuth] Usuário Firebase detectado:', currentUser.email);
        setUser(currentUser);
        setIsGuestMode(false);
      } else {
        // ✅ CRUCIAL: Verifica usuário virtual APENAS em desenvolvimento
        const isDev = import.meta.env.DEV;
        const allowVirtual = import.meta.env.VITE_ALLOW_VIRTUAL_TOKEN === 'true';
        
        if (isDev && allowVirtual) {
          const savedVirtual = localStorage.getItem("LICI_TRACK_V1_virtual_user");
          if (savedVirtual) {
            try {
              const parsed = JSON.parse(savedVirtual);
              console.log('[useAuth] Usuário virtual detectado:', parsed.email);
              setUser(parsed);
              setIsGuestMode(false);
              setAuthLoading(false);
              return;
            } catch (_) {
              console.warn('[useAuth] Erro ao parsear usuário virtual.');
            }
          }
          
          // ✅ CRUCIAL: Se não há usuário virtual, cria um automaticamente
          console.log('[useAuth] Criando usuário virtual automaticamente...');
          const virtualUser = getVirtualUser();
          localStorage.setItem("LICI_TRACK_V1_virtual_user", JSON.stringify(virtualUser));
          setUser(virtualUser);
          setIsGuestMode(false);
        } else {
          setUser(null);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    if (!termsAccepted) {
      setTermsError("Por favor, aceite os termos legais antes de prosseguir.");
      return;
    }

    try {
      setAuthLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.warn("Autenticação Google falhou:", err);
      
      // ✅ APENAS DESENVOLVIMENTO: fallback para usuário virtual
      const isDev = import.meta.env.DEV;
      const allowVirtual = import.meta.env.VITE_ALLOW_VIRTUAL_TOKEN === 'true';
      
      if (isDev && allowVirtual) {
        const virtualUser = getVirtualUser();
        localStorage.setItem("LICI_TRACK_V1_virtual_user", JSON.stringify(virtualUser));
        setUser(virtualUser);
        setIsGuestMode(false);
      } else {
        setTermsError("Falha na autenticação. Tente novamente.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async (onClearCallback?: () => void) => {
    localStorage.removeItem("LICI_TRACK_V1_virtual_user");
    
    if (isGuestMode || (user && user.isVirtual)) {
      setIsGuestMode(false);
      setUser(null);
    } else {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Erro ao fazer logout:", error);
      }
    }
    
    if (onClearCallback) {
      onClearCallback();
    }
  };

  const enterGuestMode = () => {
    if (!termsAccepted) {
      setTermsError("Por favor, aceite os termos legais antes de prosseguir.");
      return;
    }

    // ✅ BLOQUEADO EM PRODUÇÃO
    if (import.meta.env.PROD) {
      setTermsError("Modo convidado não disponível em produção.");
      return;
    }

    const guestUser = {
      uid: `guest-${Date.now()}`,
      displayName: "Visitante Demo",
      email: "guest@licitapro.demo",
      photoURL: null,
      isVirtual: true,
      isGuest: true,
    };

    localStorage.setItem("LICI_TRACK_V1_virtual_user", JSON.stringify(guestUser));
    setUser(guestUser);
    setIsGuestMode(true);
  };

  return {
    user,
    setUser,
    authLoading,
    setAuthLoading,
    isGuestMode,
    setIsGuestMode: enterGuestMode,
    termsAccepted,
    setTermsAccepted,
    termsError,
    setTermsError,
    handleGoogleLogin,
    handleLogout,
  };
}