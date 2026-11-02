import { terminerSessionExpiree, estRouteAuthentification } from './session';
import { API_BASE_URL } from './config';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem('trs_token');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // Jeton expire ou invalide : on repart proprement sur l'ecran de connexion
  // plutot que d'afficher une erreur technique sur chaque action.
  if (response.status === 401 && !estRouteAuthentification(path)) {
    terminerSessionExpiree();
  }

  if (!response.ok) {
    let message = `Erreur ${response.status}`;
    try {
      const body = await response.json();
      message = body.message ?? message;
    } catch {
      // Corps de réponse non-JSON (ex: erreur 500 brute) : on garde le message par défaut
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}