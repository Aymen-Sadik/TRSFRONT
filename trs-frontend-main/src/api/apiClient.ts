// src/api/apiClient.ts
import axios from 'axios';
import { terminerSessionExpiree, estRouteAuthentification } from './session';
import { API_BASE_URL } from './config';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Intercepteur dynamique exécuté AVANT chaque requête HTTP
apiClient.interceptors.request.use(
  (config) => {
    // 1. Extraction directe de la clé 'trs_token'
    const token = sessionStorage.getItem('trs_token');

    // 2. Vérification et injection forcée
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      console.warn('⚠️ Aucun token trouvé dans sessionStorage pour la clé "trs_token"');
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur de reponse : meme traitement de l'expiration que pour fetch.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error?.config?.url ?? '';
    if (error?.response?.status === 401 && !estRouteAuthentification(url)) {
      terminerSessionExpiree();
    }
    return Promise.reject(error);
  }
);