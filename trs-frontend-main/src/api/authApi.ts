import { apiFetch } from './client';
import type { LoginRequest, LoginResponse } from '../types/auth';

// Connexion classique (Identifiant + Mot de passe)
export function login(payload: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Deconnexion explicite. Ne sert qu'a inscrire le depart dans le journal : le
// client vide sa session lui-meme, que cet appel aboutisse ou non.
export function signalerDeconnexion(): Promise<void> {
  return apiFetch<void>('/api/auth/deconnexion', { method: 'POST' });
}

// Demande d'un lien de definition de mot de passe.
// La reponse est volontairement identique que le compte existe ou non.
export function demanderLienMotDePasse(identifiantOuEmail: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/api/auth/mot-de-passe-oublie', {
    method: 'POST',
    body: JSON.stringify({ identifiantOuEmail }),
  });
}

// Verification prealable du lien, pour annoncer « lien expire » avant la saisie.
export function verifierJeton(jeton: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(
    `/api/auth/verifier-jeton?jeton=${encodeURIComponent(jeton)}`
  );
}

// Definition du mot de passe a partir du lien recu.
export function definirMotDePasse(
  jeton: string,
  nouveauMotDePasse: string
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/api/auth/definir-mot-de-passe', {
    method: 'POST',
    body: JSON.stringify({ jeton, nouveauMotDePasse }),
  });
}

// Connexion par Badge (Douchette / Code 128)
export function loginByBadge(badgeCode: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login-badge', {
    method: 'POST',
    body: JSON.stringify({ badgeCode }),
  });
}