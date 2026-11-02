// Adresse de l'API, en un seul endroit.
//
// Elle était écrite en dur dans cinq fichiers, ce qui rendait l'application
// indéployable : une fois installée sur un serveur, le navigateur de chaque
// opérateur serait allé chercher l'API sur sa propre machine.
//
// La valeur vient de VITE_API_BASE_URL, lue au moment de la compilation — Vite
// remplace l'expression par sa valeur dans le bundle, il n'y a donc rien à
// configurer sur le serveur qui sert les fichiers.
//
//   développement : .env, déjà présent, pointe sur https://localhost:7231
//   production    : .env.production, ou la variable d'environnement de la
//                   machine qui compile
//
// Le repli conserve l'adresse de développement : sans fichier .env, le projet
// fonctionne comme avant.
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:7231';

// Point d'entrée SignalR du suivi temps réel. Toujours sur la même origine que
// l'API : c'est le même programme qui l'expose.
export const HUB_POINTAGE_URL: string = `${API_BASE_URL.replace(/\/$/, '')}/hubs/pointage`;

/** Construit une URL absolue vers l'API à partir d'un chemin (« /api/… »). */
export function urlApi(chemin: string): string {
  return `${API_BASE_URL.replace(/\/$/, '')}${chemin.startsWith('/') ? chemin : '/' + chemin}`;
}
