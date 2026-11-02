// ========================= Poste de Charge =========================
export interface LigneBreveDto {
  id: number;
  nom: string;
}

export interface PosteDeChargeDto {
  id: number;
  wstref: string;
  // Designation renvoyee par l'API. Le champ s'appelait « designation » cote
  // front alors que l'API envoie « wstdes » : il etait donc toujours vide.
  wstdes?: string;
  // Toutes les lignes que ce poste equipe. Une machine coûteuse et peu
  // sollicitee est mutualisee entre plusieurs lignes.
  lignes: LigneBreveDto[];
  affecte?: boolean;
  partage?: boolean;
}

// ========================= Entities Base DTOs =========================
export interface UsineDto {
  id: number;
  nom: string;
  code: string;
  adresse?: string;
  statut: boolean;
}

export interface SectionDto {
  id: number;
  nom: string;
  usineId: number;
}

export interface LigneDto {
  id: number;
  nom: string;
  sectionId: number;
}

// ========================= Requests DTOs =========================
export interface CreateUsineDto {
  nom: string;
  code: string;
  adresse?: string;
}

export interface UpdateUsineDto {
  nom: string;
  adresse?: string;
  statut: boolean;
}

export interface CreateSectionDto {
  nom: string;
  usineId: number;
}

export interface UpdateSectionDto {
  nom: string;
}

export interface CreateLigneDto {
  nom: string;
  sectionId: number;
}

export interface UpdateLigneDto {
  nom: string;
}

export interface AffecterPosteDto {
  ligneId: number;
}

// Retrait d'un poste : ligneId designe la ligne d'ou part le clic. Sans elle,
// le poste est detache de toutes ses lignes.
export interface RetirerPosteDto {
  ligneId?: number;
}

// ================= Arborescence DTOs (Écran B3) =================
export interface ArborescenceLigneDto {
  id: number;
  nom: string;
  postes: PosteDeChargeDto[];
}

export interface ArborescenceSectionDto {
  id: number;
  nom: string;
  lignes: ArborescenceLigneDto[];
}

export interface ArborescenceUsineDto {
  id: number;
  nom: string;
  code: string;
  statut: boolean;
  sections: ArborescenceSectionDto[];
}