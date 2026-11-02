import { apiClient } from './apiClient';
import {
  type ArborescenceUsineDto,
  type PosteDeChargeDto,
  type CreateUsineDto,
  type UpdateUsineDto,
  type CreateSectionDto,
  type UpdateSectionDto,
  type CreateLigneDto,
  type UpdateLigneDto,
  type AffecterPosteDto,
  type RetirerPosteDto,
  type UsineDto
} from '../types/zone';

const API_URL = '/api/Zone';

export const zoneApi = {
  // 🟢 Arborescence & Postes
  getArborescence: async (): Promise<ArborescenceUsineDto[]> => {
    const response = await apiClient.get<ArborescenceUsineDto[]>(`${API_URL}/arborescence`);
    return response.data;
  },

  getPostesNonAffectes: async (): Promise<PosteDeChargeDto[]> => {
    const response = await apiClient.get<PosteDeChargeDto[]>(`${API_URL}/postes/non-affectes`);
    return response.data;
  },

  // ================= Usines =================
  createUsine: async (dto: CreateUsineDto): Promise<UsineDto> => {
    const response = await apiClient.post<UsineDto>(`${API_URL}/usines`, dto);
    return response.data;
  },

  updateUsine: async (id: number, dto: UpdateUsineDto): Promise<void> => {
    await apiClient.put(`${API_URL}/usines/${id}`, dto);
  },

  deleteUsine: async (id: number): Promise<void> => {
    await apiClient.delete(`${API_URL}/usines/${id}`);
  },

  // ================= Sections =================
  createSection: async (dto: CreateSectionDto) => {
    const response = await apiClient.post(`${API_URL}/sections`, dto);
    return response.data;
  },

  updateSection: async (id: number, dto: UpdateSectionDto) => {
    await apiClient.put(`${API_URL}/sections/${id}`, dto);
  },

  deleteSection: async (id: number) => {
    await apiClient.delete(`${API_URL}/sections/${id}`);
  },

  // ================= Lignes =================
  createLigne: async (dto: CreateLigneDto) => {
    const response = await apiClient.post(`${API_URL}/lignes`, dto);
    return response.data;
  },

  updateLigne: async (id: number, dto: UpdateLigneDto) => {
    await apiClient.put(`${API_URL}/lignes/${id}`, dto);
  },

  deleteLigne: async (id: number) => {
    await apiClient.delete(`${API_URL}/lignes/${id}`);
  },

  // ================= Postes =================
  affecterPoste: async (posteId: number, ligneId: number) => {
    const dto: AffecterPosteDto = { ligneId };
    await apiClient.post(`${API_URL}/postes/${posteId}/affecter`, dto);
  },

  // ligneId : la ligne d'ou part le clic. Un poste mutualise n'est retire que
  // de celle-ci et reste en place sous ses autres lignes.
  retirerPoste: async (posteId: number, ligneId?: number) => {
    const dto: RetirerPosteDto = { ligneId };
    await apiClient.post(`${API_URL}/postes/${posteId}/retirer`, dto);
  },

  deletePoste: async (posteId: number) => {
    await apiClient.delete(`${API_URL}/postes/${posteId}`);
  },

  createPoste: async (dto: { wstref: string; wstdes: string; ligneIds: number[] }) => {
    const response = await apiClient.post('/api/Zone/postes', dto);
    return response.data;
  }

 
};