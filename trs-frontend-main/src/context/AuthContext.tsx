import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LoginRequest, Utilisateur } from '../types/auth';
import {
  login as loginRequest,
  loginByBadge as loginByBadgeRequest,
  signalerDeconnexion,
} from '../api/authApi';


interface AuthContextValue {
  utilisateur: Utilisateur | null;
  token: string | null;
  connecte: boolean;
  chargement: boolean;
  seConnecter: (payload: LoginRequest) => Promise<void>;
  seConnecterParBadge: (badgeCode: string) => Promise<void>;
  seDeconnecter: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY_TOKEN = 'trs_token';
const STORAGE_KEY_USER = 'trs_utilisateur';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(STORAGE_KEY_TOKEN));
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(() => {
    const stocke = sessionStorage.getItem(STORAGE_KEY_USER);
    return stocke ? JSON.parse(stocke) : null;
  });
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (token) sessionStorage.setItem(STORAGE_KEY_TOKEN, token);
    else sessionStorage.removeItem(STORAGE_KEY_TOKEN);
  }, [token]);

  useEffect(() => {
    if (utilisateur) sessionStorage.setItem(STORAGE_KEY_USER, JSON.stringify(utilisateur));
    else sessionStorage.removeItem(STORAGE_KEY_USER);
  }, [utilisateur]);

  // Connexion classique (Identifiant + Mot de passe)
  async function seConnecter(payload: LoginRequest) {
    setChargement(true);
    try {
      const reponse = await loginRequest(payload);
      setToken(reponse.token);
      sessionStorage.setItem('trs_token', reponse.token);
      setUtilisateur({ nom: reponse.nom, prenom: reponse.prenom, role: reponse.role });
    } finally {
      setChargement(false);
    }
  }

  // Connexion par Badge (Douchette / Code 128)
  async function seConnecterParBadge(badgeCode: string) {
    setChargement(true);
    try {
      const reponse = await loginByBadgeRequest(badgeCode);
      setToken(reponse.token);
      sessionStorage.setItem('trs_token', reponse.token);
      setUtilisateur({ nom: reponse.nom, prenom: reponse.prenom, role: reponse.role });
    } finally {
      setChargement(false);
    }
  }

  function seDeconnecter() {
    // Signalement au serveur avant de vider la session, pendant que le jeton
    // est encore valide. Volontairement sans await ni blocage : l'utilisateur
    // doit etre deconnecte meme si le reseau est coupe. L'absence de trace est
    // alors le seul effet.
    signalerDeconnexion().catch(() => {
      /* journal indisponible : sans consequence pour l'utilisateur */
    });

    setToken(null);
    setUtilisateur(null);
  }

  return (
    <AuthContext.Provider
      value={{
        utilisateur,
        token,
        connecte: !!token,
        chargement,
        seConnecter,
        seConnecterParBadge,
        seDeconnecter,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur d'un <AuthProvider>.");
  return ctx;
}