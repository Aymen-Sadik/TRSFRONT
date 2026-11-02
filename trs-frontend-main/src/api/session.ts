// Fin de session côté client.
//
// Les jetons duraient onze ans : l'expiration n'arrivait jamais et un 401
// n'était traité nulle part. Ils couvrent désormais la durée d'un poste, si
// bien qu'un opérateur de l'équipe du matin verra le sien expirer en cours de
// journée. Sans ce traitement, il se heurterait à des messages d'erreur
// incompréhensibles sur chaque action, sans comprendre qu'il doit se
// reconnecter.

const CLE_TOKEN = 'trs_token';
const CLE_UTILISATEUR = 'trs_utilisateur';

// Plusieurs requêtes peuvent échouer en même temps — le tableau de bord en
// lance trois au chargement. Sans ce verrou, on déclencherait autant de
// rechargements concurrents.
let enCours = false;

/**
 * Purge la session et ramène à l'écran de connexion.
 *
 * Le rechargement complet est volontaire : le contexte d'authentification lit
 * sessionStorage à l'initialisation, et cette fonction est appelée depuis des
 * modules hors React (intercepteur axios, enveloppe fetch) qui n'ont aucun
 * moyen de lui notifier le changement.
 */
export function terminerSessionExpiree() {
  if (enCours) return;
  enCours = true;

  try {
    sessionStorage.removeItem(CLE_TOKEN);
    sessionStorage.removeItem(CLE_UTILISATEUR);
  } catch {
    // sessionStorage peut être indisponible (navigation privée verrouillée) :
    // le rechargement reste la bonne issue.
  }

  window.location.reload();
}

/**
 * Un 401 sur les routes d'authentification n'est pas une session expirée mais
 * un refus de connexion — identifiant inconnu, mot de passe erroné, badge non
 * reconnu. Il doit remonter à l'écran de connexion pour y être affiché, pas
 * provoquer un rechargement.
 */
export function estRouteAuthentification(url: string): boolean {
  return url.toLowerCase().includes('/api/auth/');
}
