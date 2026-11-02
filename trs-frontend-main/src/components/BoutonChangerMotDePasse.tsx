import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { ChangerMotDePasseModal } from './ChangerMotDePasseModal';

/**
 * Bouton « Mot de passe » et sa modale, regroupés.
 *
 * L'application a trois coques distinctes — opérateur, consultant, back-office —
 * qui ne partagent pas d'en-tête commun. Porter l'état de la modale ici plutôt
 * que dans chacune d'elles permet de l'ajouter partout en une ligne.
 */
export function BoutonChangerMotDePasse({ variante = 'sombre' }: { variante?: 'sombre' | 'clair' }) {
  const [ouverte, setOuverte] = useState(false);

  const styles =
    variante === 'sombre'
      ? 'bg-white/10 hover:bg-white/20 text-white'
      : 'bg-slate-100 hover:bg-slate-200 text-slate-700';

  return (
    <>
      <button
        onClick={() => setOuverte(true)}
        className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${styles}`}
        title="Changer mon mot de passe"
      >
        <KeyRound size={15} />
        Mot de passe
      </button>

      {ouverte && <ChangerMotDePasseModal onFermer={() => setOuverte(false)} />}
    </>
  );
}
