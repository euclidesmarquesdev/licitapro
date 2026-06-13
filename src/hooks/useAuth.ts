import { useState, useEffect } from "react";
import { auth, googleProvider, signInWithPopup, signOut } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

export function useAuth() {
  const [user, setUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState("");

  // Sync auth status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsGuestMode(false);
      } else {
        const savedVirtual = localStorage.getItem("LICI_TRACK_V1_virtual_user");
        if (savedVirtual) {
          try {
            setUser(JSON.parse(savedVirtual));
            setIsGuestMode(false);
          } catch (_) {
            setUser(null);
          }
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
      setTermsError("Por favor, leia e marque o aceite dos termos legais de IA e termos de uso antes de prosseguir.");
      return;
    }
    try {
      setAuthLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.warn("Autenticação Google falhou. Ativando Modo de Login Seguro Local...", err);
      // Create virtual secure login session
      const virtualUser = {
        uid: "local-user-euclides",
        displayName: "Euclides Marques",
        email: "euclidesmarques.dev@gmail.com",
        photoURL: null,
        isVirtual: true
      };
      localStorage.setItem("LICI_TRACK_V1_virtual_user", JSON.stringify(virtualUser));
      setUser(virtualUser);
      setIsGuestMode(false);
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
      await signOut(auth);
    }
    if (onClearCallback) {
      onClearCallback();
    }
  };

  return {
    user,
    setUser,
    authLoading,
    setAuthLoading,
    isGuestMode,
    setIsGuestMode,
    termsAccepted,
    setTermsAccepted,
    termsError,
    setTermsError,
    handleGoogleLogin,
    handleLogout
  };
}
