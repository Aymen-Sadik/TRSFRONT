// src/api/userApi.ts
import { apiFetch } from './client';
import type { UserDTO } from '../types/users';
import type { ZoneType, ZoneItem } from '../pages/backoffice/UserFormPage';

// GET /api/Utilisateur
export async function getUsers(): Promise<UserDTO[]> {
  return await apiFetch<UserDTO[]>('/api/Utilisateur');
}

// GET /api/Utilisateur/{id}
export async function getUserById(id: number): Promise<UserDTO> {
  return await apiFetch<UserDTO>(`/api/Utilisateur/${id}`);
}

// POST /api/Utilisateur
export async function createUser(userData: Partial<UserDTO>): Promise<UserDTO> {
  return await apiFetch<UserDTO>('/api/Utilisateur', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

// PUT /api/Utilisateur/{id}
export async function updateUser(id: number, userData: Partial<UserDTO>): Promise<UserDTO> {
  return await apiFetch<UserDTO>(`/api/Utilisateur/${id}`, {
    method: 'PUT',
    body: JSON.stringify(userData),
  });
}

// DELETE /api/Utilisateur/{id}
export async function deleteUser(id: number): Promise<void> {
  return await apiFetch<void>(`/api/Utilisateur/${id}`, {
    method: 'DELETE',
  });
}

// Reponse de la reinitialisation. emailEnvoye distingue les deux cas que
// l'administrateur doit pouvoir separer : le mot de passe est parti chez
// l'utilisateur, ou il doit le lui transmettre lui-meme.
export interface ResetPasswordResponse {
  message: string;
  identifiant: string;
  emailEnvoye: boolean;
  email?: string | null;
}

// POST /api/Utilisateur/changer-mot-de-passe
// Changement par le titulaire du compte. L'identifiant vient du jeton cote
// serveur : on ne peut pas viser le compte d'un autre.
export const changerMotDePasse = async (
  motDePasseActuel: string,
  nouveauMotDePasse: string
): Promise<{ message: string }> => {
  return await apiFetch<{ message: string }>('/api/Utilisateur/changer-mot-de-passe', {
    method: 'POST',
    body: JSON.stringify({ motDePasseActuel, nouveauMotDePasse }),
  });
};

// POST /api/Utilisateur/{identifiant}/reset-password
// L'administrateur declenche l'envoi d'un lien : il ne choisit aucun mot de
// passe et la reponse n'en contient aucun.
export const resetPasswordApi = async (
  identifiant: string
): Promise<ResetPasswordResponse> => {
  return await apiFetch<ResetPasswordResponse>(
    `/api/Utilisateur/${identifiant}/reset-password`,
    { method: 'POST' }
  );
};

// GET /api/Zone/... (Adapté selon Swagger)
export const getAvailableZones = async (type: ZoneType): Promise<ZoneItem[]> => {
  // 1. Si on demande la liste des usines, l'endpoint GET direct existe :
  if (type === 'usine') {
    const usines = await apiFetch<any[]>('/api/Zone/usines');
    return usines.map((u: any) => ({
      id: u.id || u.usineId,
      type: 'usine',
      nom: u.nom || u.designation || u.libelle,
    }));
  }

  // 2. Pour les Sections, Lignes et Postes, on parcourt l'arborescence complète
  const arborescence = await apiFetch<any[]>('/api/Zone/arborescence');
  const items: ZoneItem[] = [];

  arborescence.forEach((usine: any) => {
    if (type === 'section') {
      usine.sections?.forEach((sec: any) => {
        items.push({
          id: sec.id || sec.sectionId,
          type: 'section',
          nom: sec.nom || sec.designation,
          parentNom: usine.nom || usine.designation,
        });
      });
    } else if (type === 'ligne') {
      usine.sections?.forEach((sec: any) => {
        sec.lignes?.forEach((lig: any) => {
          items.push({
            id: lig.id || lig.ligneId,
            type: 'ligne',
            nom: lig.nom || lig.designation,
            parentNom: `${usine.nom || usine.designation} > ${sec.nom || sec.designation}`,
          });
        });
      });
    } else if (type === 'poste') {
      usine.sections?.forEach((sec: any) => {
        sec.lignes?.forEach((lig: any) => {
          lig.postes?.forEach((pos: any) => {
            items.push({
              id: pos.id || pos.posteId,
              type: 'poste',
              nom: pos.nom || pos.wstdes || pos.designation,
              parentNom: lig.nom || lig.designation,
            });
          });
        });
      });
    }
  });

  return items;
};