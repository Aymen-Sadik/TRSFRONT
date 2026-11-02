import { useEffect, useState } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { definirMotDePasse, verifierJeton } from '../api/authApi';

const LONGUEUR_MINIMALE = 8;

type Etat = 'verification' | 'pret' | 'lienInvalide' | 'succes';

/**
 * Écran atteint depuis le lien reçu par courriel : activation d'un compte neuf
 * ou mot de passe oublié. Accessible sans être connecté, par nécessité —
 * l'utilisateur ne peut précisément pas se connecter.
 */
export function DefinirMotDePassePage({ jeton }: { jeton: string }) {
  const [etat, setEtat] = useState<Etat>('verification');
  const [messageLien, setMessageLien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [afficher, setAfficher] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Le lien est verifie avant d'afficher le formulaire : inutile de faire saisir
  // un mot de passe pour annoncer ensuite que le lien a expire.
  useEffect(() => {
    let annule = false;
    verifierJeton(jeton)
      .then(() => {
        if (!annule) setEtat('pret');
      })
      .catch((err: any) => {
        if (annule) return;
        setMessageLien(err?.message ?? "Ce lien n'est pas valide.");
        setEtat('lienInvalide');
      });
    return () => {
      annule = true;
    };
  }, [jeton]);

  const tropCourt = nouveau.length > 0 && nouveau.length < LONGUEUR_MINIMALE;
  const diverge = confirmation.length > 0 && nouveau !== confirmation;
  const peutValider =
    nouveau.length >= LONGUEUR_MINIMALE && nouveau === confirmation && !envoi;

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    if (!peutValider) return;

    setEnvoi(true);
    setErreur(null);
    try {
      await definirMotDePasse(jeton, nouveau);
      setEtat('succes');
    } catch (err: any) {
      setErreur(err?.message ?? 'Le mot de passe n’a pas pu être défini.');
    } finally {
      setEnvoi(false);
    }
  }

  // Retour à l'écran de connexion : on efface le jeton de la barre d'adresse
  // pour qu'il ne traîne ni dans l'historique du navigateur ni dans un signet.
  function versConnexion() {
    window.location.replace(window.location.origin);
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-body">
      <div className="bg-white rounded-xl max-w-md w-full p-7 shadow-lg border border-slate-200">
        {etat === 'verification' && (
          <div className="text-center py-8">
            <div className="w-9 h-9 mx-auto border-4 border-slate-200 border-t-[#1F4E79] rounded-full animate-spin" />
            <p className="mt-4 text-sm text-slate-600">Vérification du lien…</p>
          </div>
        )}

        {etat === 'lienInvalide' && (
          <div className="text-center py-4">
            <AlertTriangle className="mx-auto text-amber-500 mb-3" size={44} />
            <h1 className="text-lg font-bold text-slate-800">Lien inutilisable</h1>
            <p className="text-sm text-slate-600 mt-2">{messageLien}</p>
            <button
              onClick={versConnexion}
              className="mt-6 w-full py-2.5 bg-[#1F4E79] text-white font-medium text-sm rounded-lg hover:bg-[#183d60] transition"
            >
              Retour à la connexion
            </button>
          </div>
        )}

        {etat === 'succes' && (
          <div className="text-center py-4">
            <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={44} />
            <h1 className="text-lg font-bold text-slate-800">Mot de passe défini</h1>
            <p className="text-sm text-slate-600 mt-2">
              Vous pouvez maintenant vous connecter. Vous seul connaissez ce mot de
              passe.
            </p>
            <button
              onClick={versConnexion}
              className="mt-6 w-full py-2.5 bg-[#1F4E79] text-white font-medium text-sm rounded-lg hover:bg-[#183d60] transition"
            >
              Se connecter
            </button>
          </div>
        )}

        {etat === 'pret' && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <KeyRound size={18} className="text-[#1F4E79]" />
              <h1 className="text-lg font-bold text-slate-800">Choisir mon mot de passe</h1>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Personne d'autre ne le connaîtra : ni votre chef de section, ni
              l'administrateur de l'application.
            </p>

            <form onSubmit={valider} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Nouveau mot de passe
                </label>
                <input
                  type={afficher ? 'text' : 'password'}
                  value={nouveau}
                  onChange={(e) => setNouveau(e.target.value)}
                  autoFocus
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                {tropCourt && (
                  <p className="text-xs text-amber-700 mt-1">
                    Au moins {LONGUEUR_MINIMALE} caractères.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Confirmer le mot de passe
                </label>
                <input
                  type={afficher ? 'text' : 'password'}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                {diverge && (
                  <p className="text-xs text-red-600 mt-1">
                    Les deux saisies ne correspondent pas.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setAfficher((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
              >
                {afficher ? <EyeOff size={14} /> : <Eye size={14} />}
                {afficher ? 'Masquer' : 'Afficher'}
              </button>

              {erreur && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {erreur}
                </div>
              )}

              <button
                type="submit"
                disabled={!peutValider}
                className="w-full py-2.5 bg-[#1F4E79] text-white font-medium text-sm rounded-lg hover:bg-[#183d60] transition disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {envoi ? 'Enregistrement…' : 'Définir mon mot de passe'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
