// Doit rester synchronisé avec Sothema.TRS.Api.Models.Enums.Role
export type Role =
  | 'Administrateur'
  | 'ResponsableUsine'
  | 'ChefSection'
  | 'Operateur'
  | 'Consultant';

export interface LoginRequest {
  identifiant: string;
  motDePasse: string;
}

// Correspond à LoginResponse (AuthService.cs côté binôme)
export interface LoginResponse {
  token: string;
  nom: string;
  prenom: string;
  role: Role;
  identifiant: string; // Ajouté pour l'affichage dans MesPointagesPage
}

export interface Utilisateur {
  nom: string;
  prenom: string;
  role: Role;
  identifiant?: string; // Ajouté pour l'affichage dans MesPointagesPage
}