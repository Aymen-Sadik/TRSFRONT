import { apiFetch } from './client';
import { getUserById, getUsers } from './userApi';
import type { ArborescenceUsineDto } from '../types/zone';

export interface PointageDto {
    pointageId: number;
    // Session de travail : les segments issus d'une mise en pause la partagent.
    sessionId?: string;
    operatorNom?: string;
    mfgnum?: string;
    openum?: string;
    opeDesignation?: string;
    wstref?: string;
    wstDesignation?: string;
    heureDebut: string;
    heureFin?: string;
    dureeMinutes?: number;
    tempsTheoriqueMinutes: number;
    article?: string;
    quantite: number;
    statut: string;
    motif?: string;
}

export interface OperationDto {
    id: number;
    mfgnum: string;
    openum: string;
    wstref: string;
    wstdes: string;
}

type UserAvecSections = {
    sectionIds?: number[];
};

export function getPointagesActifs() {
    return apiFetch<PointageDto[]>('/api/Pointage/actifs');
}

// Plage facultative, bornes en UTC. Sans plage, toute la table est renvoyee :
// a conserver pour un export, mais le tableau de bord borne sa demande a la
// periode affichee.
export function getPointages(debut?: Date, fin?: Date) {
    const params = new URLSearchParams();
    if (debut) params.set('debut', debut.toISOString());
    if (fin) params.set('fin', fin.toISOString());
    const suffixe = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<PointageDto[]>(`/api/Pointage${suffixe}`);
}

export function getAllPointages() {
    return getPointages();
}

export function getAllOperations() {
    return apiFetch<OperationDto[]>('/api/Operation');
}

export function getAllUsers() {
    return getUsers();
}

function getUserIdFromToken(): number | null {
    const token = sessionStorage.getItem('trs_token');
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1])) as Record<string, string>;
        const raw =
            payload.nameid ??
            payload.sub ??
            payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
        const id = Number(raw);
        return Number.isFinite(id) ? id : null;
    } catch {
        return null;
    }
}

export async function getMesSectionNoms(): Promise<string[]> {
    const userId = getUserIdFromToken();
    if (!userId) return [];

    const [user, arborescence] = await Promise.all([
        getUserById(userId) as Promise<UserAvecSections>,
        apiFetch<ArborescenceUsineDto[]>('/api/Zone/arborescence'),
    ]);

    const sectionIds = user.sectionIds ?? [];
    if (sectionIds.length === 0) return [];

    const noms: string[] = [];
    for (const usine of arborescence) {
        for (const section of usine.sections ?? []) {
            if (sectionIds.includes(section.id)) {
                noms.push(section.nom);
            }
        }
    }
    return noms.sort((a, b) => a.localeCompare(b, 'fr'));
}