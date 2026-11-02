import { apiFetch } from './client';

export interface JournalActionDto {
  id: number;
  dateHeure: string;
  type: string;
  /** Null pour une action anonyme, ou si le compte auteur a été supprimé depuis. */
  auteur?: string | null;
  detail: string;
}

export interface PageJournalDto {
  total: number;
  page: number;
  taille: number;
  lignes: JournalActionDto[];
}

export interface FiltreJournal {
  page?: number;
  taille?: number;
  type?: string;
  recherche?: string;
  depuis?: string;
  jusqu?: string;
}

// Les types d'action, tels que les renvoie l'API.
export const TYPES_ACTION = [
  'Connexion',
  'Echec',
  'ModificationUtilisateur',
  'ModificationZone',
  'Pointage',
  'ImportAuto',
  'ImportManuel',
] as const;

export function consulterJournal(filtre: FiltreJournal): Promise<PageJournalDto> {
  const params = new URLSearchParams();
  // Les champs vides sont omis : l'API traite l'absence de filtre, pas la
  // chaîne vide.
  for (const [cle, valeur] of Object.entries(filtre)) {
    if (valeur !== undefined && valeur !== null && valeur !== '') {
      params.set(cle, String(valeur));
    }
  }
  return apiFetch<PageJournalDto>(`/api/Journal?${params.toString()}`);
}
