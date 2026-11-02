// src/components/BoutonDeconnexion.tsx
import { useAuth } from '../context/AuthContext';

export function BoutonDeconnexion() {
  const { seDeconnecter } = useAuth();

  return (
    <button
      onClick={seDeconnecter}
      className="px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-red-500/90 hover:bg-red-600 text-white transition-colors"
    >
      Déconnexion
    </button>
  );
}