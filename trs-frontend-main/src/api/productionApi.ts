import { apiFetch } from './client';

// DTOs bruts renvoyés par le backend — mêmes colonnes que les tables OF/Opération
// (noms en camelCase : System.Text.Json applique la policy Web par défaut sur AddControllers()).
// Si le backend ne configure PAS cette policy, les clés JSON seront en fait en MAJUSCULES
// (MFGNUM, ITMREF, ...) — à vérifier avec un appel réel/Swagger avant de tester F2.
export interface OrdreFabricationDto {
  mfgnum: string;
  itmref: string;
  itmdes: string;
  mfgqty: number;
  extdatstr: string; // date de début (non affichée pour l'instant côté F2)
  extdatend: string;
  mfgsta: string;
  site: string; // non affiché pour l'instant côté F2
}

export interface OperationDto {
  id: number;
  mfgnum: string;
  openum: string;
  wstref: string;
  wstdes: string;
  openam: string;
  posteDeChargeId: number;
  timset: number; // temps de réglage (minutes) — non affiché pour l'instant
  timrun: number; // temps d'exécution (minutes) — non affiché pour l'instant
  timtot: number; // temps théorique total (minutes) — utilisé pour "Tps théorique"
}

// Routes à confirmer avec Aymen (cf. AuthController pour le pattern d'URL/base utilisé)
export async function fetchOrdreFabrication(mfgnum: string): Promise<OrdreFabricationDto> {
  return apiFetch<OrdreFabricationDto>(`/api/OrdreFabrication/${encodeURIComponent(mfgnum)}`);
}

export async function fetchOperation(mfgnum: string, openum: string): Promise<OperationDto> {
  return apiFetch<OperationDto>(
    `/api/Operation/recherche?mfgnum=${encodeURIComponent(mfgnum)}&openum=${encodeURIComponent(openum)}`
  );
}