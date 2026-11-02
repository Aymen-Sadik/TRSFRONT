import { useCallback, useEffect, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, ScrollText, AlertTriangle } from 'lucide-react';
import {
  consulterJournal,
  TYPES_ACTION,
  type JournalActionDto,
  type PageJournalDto,
} from '../../api/journalApi';

const TAILLE_PAGE = 50;

// Un refus de connexion n'a pas le même poids qu'une connexion réussie :
// la couleur permet de repérer une série d'échecs en parcourant la liste.
function styleType(type: string): string {
  switch (type) {
    case 'Echec':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'Connexion':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'ModificationUtilisateur':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'ModificationZone':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function libelleType(type: string): string {
  switch (type) {
    case 'ModificationUtilisateur':
      return 'Compte';
    case 'ModificationZone':
      return 'Zone';
    case 'Echec':
      return 'Échec';
    default:
      return type;
  }
}

export function JournauxPage() {
  const [donnees, setDonnees] = useState<PageJournalDto | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [recherche, setRecherche] = useState('');
  // Terme réellement envoyé : découplé de la saisie pour ne pas interroger
  // l'API à chaque frappe.
  const [termeApplique, setTermeApplique] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setDonnees(
        await consulterJournal({
          page,
          taille: TAILLE_PAGE,
          type: type || undefined,
          recherche: termeApplique || undefined,
        })
      );
    } catch (e: any) {
      setErreur(e?.message ?? 'Impossible de charger le journal.');
    } finally {
      setChargement(false);
    }
  }, [page, type, termeApplique]);

  useEffect(() => {
    charger();
  }, [charger]);

  // Changer de filtre doit ramener en première page : rester page 7 d'un
  // résultat qui n'en compte plus que 2 afficherait une liste vide.
  function appliquerRecherche() {
    setPage(1);
    setTermeApplique(recherche.trim());
  }

  const total = donnees?.total ?? 0;
  const dernierePage = Math.max(1, Math.ceil(total / TAILLE_PAGE));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ScrollText size={20} className="text-[#1F4E79]" />
          Journal des actions
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Connexions, cycle de vie des comptes, mots de passe et habilitations.
          Les pointages ne figurent pas ici : ils ont leur propre registre.
        </p>
      </div>

      {/* Filtres */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-56">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && appliquerRecherche()}
            placeholder="Rechercher un identifiant ou un détail…"
            className="w-full h-9 pl-9 pr-3 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-[#1F4E79] focus:outline-none"
          />
        </div>

        <select
          value={type}
          onChange={(e) => {
            setPage(1);
            setType(e.target.value);
          }}
          className="h-9 px-3 border border-slate-300 rounded-md text-sm text-slate-700 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none"
        >
          <option value="">Tous les types</option>
          {TYPES_ACTION.map((t) => (
            <option key={t} value={t}>
              {libelleType(t)}
            </option>
          ))}
        </select>

        <button
          onClick={appliquerRecherche}
          className="h-9 px-4 bg-[#1F4E79] text-white text-sm font-medium rounded-md hover:bg-[#183d60] transition"
        >
          Filtrer
        </button>
      </div>

      {erreur && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle size={16} />
          {erreur}
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left py-2.5 px-4 font-semibold w-44">Date et heure</th>
              <th className="text-left py-2.5 px-4 font-semibold w-32">Type</th>
              <th className="text-left py-2.5 px-4 font-semibold w-36">Auteur</th>
              <th className="text-left py-2.5 px-4 font-semibold">Détail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {chargement && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-slate-400 text-sm">
                  Chargement…
                </td>
              </tr>
            )}

            {!chargement && donnees?.lignes.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-slate-400 text-sm">
                  Aucune action ne correspond à ces critères.
                </td>
              </tr>
            )}

            {!chargement &&
              donnees?.lignes.map((l: JournalActionDto) => (
                <tr key={l.id} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap font-mono text-xs">
                    {new Date(l.dateHeure).toLocaleString('fr-FR')}
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${styleType(l.type)}`}
                    >
                      {libelleType(l.type)}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-700 font-medium">
                    {l.auteur ?? <span className="text-slate-400 italic">anonyme</span>}
                  </td>
                  <td className="py-2.5 px-4 text-slate-700">{l.detail}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {total.toLocaleString('fr-FR')} action{total > 1 ? 's' : ''}
          {total > 0 && ` — page ${donnees?.page ?? page} sur ${dernierePage}`}
        </span>

        <div className="flex gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || chargement}
            className="h-8 px-2 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= dernierePage || chargement}
            className="h-8 px-2 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
