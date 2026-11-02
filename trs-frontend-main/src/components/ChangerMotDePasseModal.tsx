import { useState } from 'react';
import { KeyRound, X, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { changerMotDePasse } from '../api/userApi';

// Même minimum que le serveur. Dupliqué à dessein : le contrôle côté client
// évite un aller-retour, mais c'est le serveur qui fait foi.
const LONGUEUR_MINIMALE = 8;

interface ChangerMotDePasseModalProps {
  onFermer: () => void;
}

export function ChangerMotDePasseModal({ onFermer }: ChangerMotDePasseModalProps) {
  const [actuel, setActuel] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [afficher, setAfficher] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  // La confirmation ne part jamais au serveur : elle ne sert qu'à détecter une
  // faute de frappe avant de verrouiller l'utilisateur hors de son compte.
  const confirmationDiverge = confirmation.length > 0 && nouveau !== confirmation;
  const tropCourt = nouveau.length > 0 && nouveau.length < LONGUEUR_MINIMALE;
  const identique = nouveau.length > 0 && nouveau === actuel;

  const peutValider =
    actuel.length > 0 &&
    nouveau.length >= LONGUEUR_MINIMALE &&
    nouveau === confirmation &&
    !identique &&
    !envoi;

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    if (!peutValider) return;

    setEnvoi(true);
    setErreur(null);
    try {
      await changerMotDePasse(actuel, nouveau);
      setSucces(true);
    } catch (err: any) {
      // Le serveur distingue « actuel incorrect » de « nouveau invalide » :
      // son message est plus utile que le nôtre.
      setErreur(err?.message ?? 'Le changement a échoué. Réessayez.');
    } finally {
      setEnvoi(false);
    }
  }

  if (succes) {
    return (
      <Cadre onFermer={onFermer}>
        <div className="text-center py-4">
          <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={44} />
          <h3 className="text-lg font-bold text-slate-800">Mot de passe modifié</h3>
          <p className="text-sm text-slate-600 mt-2">
            Votre nouveau mot de passe est actif immédiatement. Un e-mail de
            confirmation vous a été envoyé — il ne contient pas votre mot de passe.
          </p>
          <button
            onClick={onFermer}
            className="mt-6 w-full py-2.5 bg-[#1F4E79] text-white font-medium text-sm rounded-lg hover:bg-[#183d60] transition"
          >
            Fermer
          </button>
        </div>
      </Cadre>
    );
  }

  return (
    <Cadre onFermer={onFermer}>
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={18} className="text-[#1F4E79]" />
        <h3 className="text-lg font-bold text-slate-800">Changer mon mot de passe</h3>
      </div>
      <p className="text-xs text-slate-500 mb-5">
        Vous seul connaîtrez ce mot de passe : l'administrateur n'y a pas accès.
      </p>

      <form onSubmit={valider} className="space-y-4">
        <Champ
          libelle="Mot de passe actuel"
          valeur={actuel}
          onChange={setActuel}
          type={afficher ? 'text' : 'password'}
          autoFocus
        />

        <div>
          <Champ
            libelle="Nouveau mot de passe"
            valeur={nouveau}
            onChange={setNouveau}
            type={afficher ? 'text' : 'password'}
          />
          {tropCourt && (
            <p className="text-xs text-amber-700 mt-1">
              Au moins {LONGUEUR_MINIMALE} caractères.
            </p>
          )}
          {identique && (
            <p className="text-xs text-amber-700 mt-1">
              Choisissez un mot de passe différent de l'actuel.
            </p>
          )}
        </div>

        <div>
          <Champ
            libelle="Confirmer le nouveau mot de passe"
            valeur={confirmation}
            onChange={setConfirmation}
            type={afficher ? 'text' : 'password'}
          />
          {confirmationDiverge && (
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
          {afficher ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
        </button>

        {erreur && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {erreur}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onFermer}
            className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-50 transition"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!peutValider}
            className="flex-1 py-2.5 bg-[#1F4E79] text-white font-medium text-sm rounded-lg hover:bg-[#183d60] transition disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {envoi ? 'Modification…' : 'Modifier'}
          </button>
        </div>
      </form>
    </Cadre>
  );
}

function Cadre({ children, onFermer }: { children: React.ReactNode; onFermer: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 relative">
        <button
          onClick={onFermer}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
          aria-label="Fermer"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

function Champ({
  libelle,
  valeur,
  onChange,
  type,
  autoFocus,
}: {
  libelle: string;
  valeur: string;
  onChange: (v: string) => void;
  type: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{libelle}</label>
      <input
        type={type}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        autoComplete={type === 'password' ? 'off' : undefined}
        className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
      />
    </div>
  );
}
