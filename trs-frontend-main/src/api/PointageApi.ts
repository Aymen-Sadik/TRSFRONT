import { apiFetch } from './client';

export interface PointageDto {
  id: number;
  pointageId?: number;   // 🆕 le backend renvoie "pointageId", pas "id" — les deux sont acceptés
  sessionId: string;
  utilisateurId: number;
  operationId: number;
  ordreFabricationId?: number | string;
  heureDebut: string;
  heureFin: string | null;
  statut: number | string;
  dureeMinutes: number | null;
}

// 🆕 Normalise la réponse backend : "pointageId" (nom réel renvoyé par PointageDto C#)
// est ramené sur "id" pour que tout le front puisse utiliser un seul champ fiable.
function normalizePointage(dto: any): PointageDto {
  return {
    ...dto,
    id: dto.id ?? dto.pointageId ?? dto.PointageId,
  };
}
interface CreatePointageRequestBody {
  operationId: number;
  ordreFabricationId?: number | string;
  utilisateurId?: number; 
}

// POST /api/Pointage/demarrer
export async function demarrerPointage(
  operationId: number,
  ordreFabricationId?: number | string
): Promise<PointageDto> {
  const body: CreatePointageRequestBody = { operationId, ordreFabricationId };
  const data = await apiFetch<any>('/api/Pointage/demarrer', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return normalizePointage(data);
}

// POST /api/Pointage/terminer/{id}
export async function terminerPointage(pointageId: number): Promise<PointageDto> {
  if (!pointageId || isNaN(pointageId)) {
    console.error("Erreur: ID de pointage invalide ou undefined", pointageId);
    throw new Error("Impossible de terminer : l'identifiant du pointage est manquant.");
  }
  const data = await apiFetch<any>(`/api/Pointage/terminer/${pointageId}`, {
    method: 'POST',
  });
  return normalizePointage(data);
}

export async function interromprePointage(pointageId: number, motif?: string): Promise<PointageDto> {
  const data = await apiFetch<any>(`/api/Pointage/interrompre/${pointageId}`, {
    method: 'POST',
    body: JSON.stringify({ motif }),
  });
  return normalizePointage(data);
}

export async function reprendrePointage(pointageId: number): Promise<PointageDto> {
  const data = await apiFetch<any>(`/api/Pointage/reprendre/${pointageId}`, {
    method: 'POST',
  });
  return normalizePointage(data);
}

// Structure flexible renvoyée par le backend C# (Pointage avec jointure Operation/OF)
export interface PointageBackendDTO {
  id: number;
  operationId: number;
  mfgnum?: string;
  mfgNum?: string;
  openum?: string | number;
  opeDesignation?: string;
  designation?: string;
  wstref?: string;
  wstRef?: string;
  heureDebut: string;
  heureFin?: string | null;
  statut?: number | string;
  dureeMinutes?: number | null;
  tempsReelMinutes?: number | null;
  tempsTheoriqueMinutes?: number | null;
  tempsTheo?: number | null;
  operation?: {
    mfgnum?: string;
    openum?: string | number;
    openam?: string;
    wstref?: string;
    timTot?: number;
  };
}

// Structure attendue par MesPointagesPage.tsx
export interface PointageHistoryDTO {
  id: number;
  mfgnum: string;
  openum: string;
  opeDesignation: string;
  wstref: string;
  heureDebut: string;
  heureFin: string | null;
  tempsTheoriqueMin: number;
  tempsReelMin: number;
  // Nécessaires à l'écran de détail : l'identifiant de session permet de charger
  // le déroulé des segments, le statut et le nombre d'interruptions s'affichent
  // directement dans la liste.
  sessionId: string;
  statut: string;
  nombreInterruptions: number;
}

export const getMesPointages = async (): Promise<PointageHistoryDTO[]> => {
  const rawData = await apiFetch<PointageBackendDTO[]>('/api/Pointage/mes-pointages');

  // Mapping dynamique sans valeurs hardcodées
  return rawData.map((p: any) => {
    const op = p.operation || {};

    const mfgnum = p.mfgnum || p.mfgNum || op.mfgnum || `OF-${p.operationId}`;
    const openum = p.openum || p.opeNum || op.openum || `OP-${p.operationId}`;
    const opeDesignation = p.opeDesignation || p.designation || op.openam || op.designation || `Opération #${p.operationId}`;
    const wstref = p.wstref || p.wstRef || op.wstref || op.wstRef || 'Non assigné';

    // Extraction sécurisée du temps théorique (ex: 0.42 ou 45 si c'est la vraie valeur en BDD)
    const tempsTheoRaw = p.tempsTheoriqueMin ?? p.tempsTheoriqueMinutes ?? p.tempsTheo ?? op.timTot ?? 0;
    const tempsTheoriqueMin = typeof tempsTheoRaw === 'string' ? parseFloat(tempsTheoRaw) : Number(tempsTheoRaw) || 0;

    // Temps réel
    const tempsReelRaw = p.tempsReelMin ?? p.tempsReelMinutes ?? p.dureeMinutes ?? 0;
    const tempsReelMin = typeof tempsReelRaw === 'string' ? parseFloat(tempsReelRaw) : Number(tempsReelRaw) || 0;

    return {
      id: p.id,
      mfgnum,
      openum: String(openum),
      opeDesignation,
      wstref,
      heureDebut: p.heureDebut,
      heureFin: p.heureFin || null,
      tempsTheoriqueMin,
      tempsReelMin: Number(tempsReelMin.toFixed(2)),
      sessionId: p.sessionId ?? '',
      statut: String(p.statut ?? ''),
      nombreInterruptions: Number(p.nombreInterruptions ?? 0),
    };
  });
};

// --- AJOUTS POUR LA VUE CONSULTANT ---

// Structure d'un pointage pour le suivi en direct
export interface PointageLiveDTO {
  id: number;
  sessionId: string; 
  utilisateurId: number;
  nomOperateur: string;
  wstref: string;
  mfgnum: string;
  openum: string;
  opeDesignation: string;
  heureDebut: string;
  heureFin?: string | null;
  statut: 'EN_COURS' | 'PAUSE' | 'TERMINE' | number | string;
}

// --- HISTORIQUE DES PAUSES / INTERRUPTIONS D'UNE SESSION ---

export interface SegmentPointageDto {
  pointageId: number;
  heureDebut: string;
  heureFin: string | null;
  statut: string;       // "Actif" | "Interrompu" | "Termine"
  motif: string | null;
  dureeMinutes: number | null;
}

export interface HistoriqueSessionDto {
  sessionId: string;
  /** Les seules interruptions (utilisé par l'écran de pointage actif). */
  segments: SegmentPointageDto[];
  /**
   * Déroulé chronologique complet : segments de travail et interruptions
   * intercalés dans l'ordre. Le champ `statut` vaut « Travail » ou « Interruption ».
   */
  deroule?: SegmentPointageDto[];
  nombreInterruptions: number;
  tempsTotalArretMinutes: number;
  /** Somme des segments de travail, hors temps d'arrêt. */
  tempsTravailMinutes?: number;
}

// GET /api/Pointage/session/{sessionId}/historique
export async function getHistoriqueSession(sessionId: string): Promise<HistoriqueSessionDto> {
  return apiFetch<HistoriqueSessionDto>(`/api/Pointage/session/${sessionId}/historique`);
}

/**
 * GET /api/Pointage/en-cours
 * Récupère la liste initiale de tous les pointages actifs (pour la vue Consultant)
 */
export async function getPointagesEnCours(): Promise<PointageLiveDTO[]> {
  return apiFetch<PointageLiveDTO[]>('/api/Pointage/en-cours');
}

/** Session de pointage encore ouverte pour l'opérateur connecté. */
export interface SessionOuverteDto {
  pointageId: number;
  sessionId: string;
  mfgnum?: string;
  openum?: string;
  opeDesignation?: string;
  wstref?: string;
  wstDesignation?: string;
  heureDebut: string;
  statut: string;
  motif?: string | null;
  tempsAccumulePriorMinutes: number;
  tempsTheoriqueMinutes: number;
  article?: string;
  quantite: number;
}

/**
 * GET /api/Pointage/ma-session-ouverte
 * Renvoie le dernier segment de la session encore ouverte de l'opérateur connecté,
 * ou null s'il n'en a aucune (le serveur répond alors 204).
 * Sert à rouvrir l'écran de pointage après une déconnexion ou un rafraîchissement.
 */
export async function fetchMaSessionOuverte(): Promise<SessionOuverteDto | null> {
  const data = await apiFetch<SessionOuverteDto | undefined>('/api/Pointage/ma-session-ouverte');
  return data ?? null;
}

/**
 * GET /api/Pointage/mes-sessions-ouvertes
 * Toutes les sessions encore ouvertes de l'opérateur, une entrée par session.
 * L'opérateur pouvant mener plusieurs OF de front, cette liste alimente le
 * sélecteur qui lui permet de basculer de l'un à l'autre.
 * Triées : les pointages qui tournent d'abord, puis les plus récents.
 */
export async function fetchMesSessionsOuvertes(): Promise<SessionOuverteDto[]> {
  const data = await apiFetch<SessionOuverteDto[] | undefined>(
    '/api/Pointage/mes-sessions-ouvertes',
  );
  return data ?? [];
}