import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { demanderLienMotDePasse } from '../api/authApi';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { seConnecter, seConnecterParBadge, chargement } = useAuth();

  // Formulaire classique
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  // Demande de lien : le message de retour est le meme que le compte
  // existe ou non, pour ne pas transformer cet ecran en annuaire.
  const [demandeEnCours, setDemandeEnCours] = useState(false);
  const [messageLien, setMessageLien] = useState<string | null>(null);
  const [afficherAideMotDePasse, setAfficherAideMotDePasse] = useState(false);

  // Scanner Badge
  const [badgeCode, setBadgeCode] = useState('');
  const badgeInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus initial au chargement
  useEffect(() => {
    focusBadgeInput();
  }, []);

  const focusBadgeInput = () => {
    // Si l'utilisateur est déjà en train de taper dans Identifiant ou Mot de Passe, on NE vole PAS le focus
    const activeElement = document.activeElement;
    if (
      activeElement?.id === 'identifiant' ||
      activeElement?.id === 'motDePasse'
    ) {
      return;
    }

    if (badgeInputRef.current) {
      badgeInputRef.current.focus();
    }
  };

  // --- Connexion Classique (Formulaire) ---
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    try {
      await seConnecter({ identifiant, motDePasse });
    } catch (err) {
      setErreur(
        err instanceof ApiError
          ? 'Identifiants incorrects — veuillez réessayer'
          : 'Connexion au serveur impossible. Réessayez.'
      );
    }
  }

  // --- Connexion par Badge (Scan Douchette) ---
  async function handleBadgeScanSubmit(e: FormEvent) {
    e.preventDefault();
    if (!badgeCode.trim()) return;

    setErreur(null);
    try {
      await seConnecterParBadge(badgeCode.trim());
    } catch (err) {
      setErreur(
        err instanceof ApiError
          ? 'Badge non reconnu ou désactivé.'
          : 'Connexion au serveur impossible. Réessayez.'
      );
      setBadgeCode('');
      focusBadgeInput();
    }
  }

  return (
    <div className="min-h-screen bg-bg font-body flex flex-col">
      {/* Bandeau d'application */}
      <header className="bg-button text-white px-6 py-3 flex items-center justify-between">
        <span className="font-semibold tracking-wide">Pointage OF</span>
        <span className="text-xs text-white/60">v6.0</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-card rounded-xl shadow-sm border border-border/60 p-8">
          {/* Avatar */}
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="text-muted"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
              </svg>
            </div>
          </div>

          <h1 className="text-center text-lg font-semibold text-text">Connexion opérateur</h1>
          <p className="text-center text-sm text-muted mt-1 mb-6">
            Entrez vos identifiants ou scannez votre badge
          </p>

          {/* Formulaire classique */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="identifiant" className="block text-sm font-medium text-text mb-1">
                Identifiant <span className="text-danger">*</span>
              </label>
              <input
                id="identifiant"
                name="identifiant"
                type="text"
                autoComplete="username"
                required
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-border bg-white text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:border-navy transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="motDePasse" className="block text-sm font-medium text-text">
                  Mot de passe <span className="text-danger">*</span>
                </label>
                <button
                  type="button"
                  disabled={demandeEnCours}
                  onClick={async () => {
                    if (!identifiant.trim()) {
                      setAfficherAideMotDePasse(true);
                      return;
                    }
                    setAfficherAideMotDePasse(false);
                    setDemandeEnCours(true);
                    try {
                      const r = await demanderLienMotDePasse(identifiant.trim());
                      setMessageLien(r.message);
                    } catch {
                      // Meme message en cas d'echec reseau : ne rien laisser
                      // deduire de la reponse.
                      setMessageLien(
                        "Si ce compte existe, un lien vient d'être envoyé à l'adresse associée."
                      );
                    } finally {
                      setDemandeEnCours(false);
                    }
                  }}
                  className="text-xs text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy rounded disabled:opacity-50"
                >
                  {demandeEnCours ? 'Envoi…' : 'Mot de passe oublié ?'}
                </button>
              </div>
              <input
                id="motDePasse"
                name="motDePasse"
                type="password"
                autoComplete="current-password"
                required
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-border bg-white text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:border-navy transition"
              />
            </div>

            {afficherAideMotDePasse && (
              <p className="text-xs text-muted bg-slate-50 border border-border rounded-md px-3 py-2">
                Saisissez d'abord votre identifiant, puis cliquez à nouveau :
                un lien vous sera envoyé par e-mail.
              </p>
            )}

            {messageLien && (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                {messageLien}
              </p>
            )}

            <button
              type="submit"
              disabled={chargement}
              className="w-full h-11 rounded-md bg-button text-white font-medium hover:bg-navy-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {chargement ? 'Connexion en cours…' : 'Se connecter'}
            </button>
          </form>

          {/* Séparateur */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted">OU</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Scan badge */}
          <div
            onClick={focusBadgeInput}
            className="w-full cursor-pointer border border-dashed border-blue-300 bg-blue-50/50 rounded-md py-4 flex flex-col items-center gap-1.5 hover:bg-blue-50 transition"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="text-blue-600"
              aria-hidden="true"
            >
              <rect x="3" y="6" width="18" height="12" rx="2" />
              <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h6" />
            </svg>
            <span className="text-sm font-medium text-blue-700">Scanner badge opérateur</span>
            <span className="text-xs text-blue-500">Approcher le badge du lecteur</span>

            {/* Input masqué avec gestion de focus propre */}
            <form onSubmit={handleBadgeScanSubmit} className="h-0 w-0 opacity-0 overflow-hidden">
              <input
                ref={badgeInputRef}
                type="text"
                value={badgeCode}
                onChange={(e) => setBadgeCode(e.target.value)}
                onBlur={() => {
                  setTimeout(focusBadgeInput, 300);
                }}
                autoComplete="off"
              />
            </form>
          </div>

          {/* Message d'erreur */}
          {erreur && (
            <p
              role="alert"
              className="mt-4 text-sm text-danger bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-center gap-1.5"
            >
              <span aria-hidden="true">⚠</span> {erreur}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}