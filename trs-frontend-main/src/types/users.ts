// src/types/users.ts

export type RoleUtilisateur = 
  | 'Administrateur' 
  | 'ResponsableUsine' 
  | 'ChefSection' 
  | 'Operateur' 
  | 'Consultant';

export interface UserDTO {
  id: number; // Made non-optional for loaded users
  nom: string;
  prenom: string;
  identifiant: string;
  role: RoleUtilisateur;
  statut: boolean;      // Added missing property
  usineNom?: string;     // Added missing property (optional for global access)
  sectionNom?: string;   // Added missing property
}