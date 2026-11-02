import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import type { UserDTO, RoleUtilisateur } from '../../types/users';
import { getUsers, updateUser, getAvailableZones } from '../../api/userApi';
import { UserFormPage, type ZoneItem } from './UserFormPage';

interface UsersPageProps {
  onAddUser?: () => void;
  onEditUser?: (userId: number) => void;
}

// ---------------------------------------------------------------------------
// Types & helpers pour la résolution des rattachements hiérarchiques
// ---------------------------------------------------------------------------

type NiveauKey = 'usines' | 'sections' | 'lignes' | 'postes';

type ZonesMaps = Record<NiveauKey, Map<number, string>>;

/**
 * Configuration déclarative de chaque niveau hiérarchique.
 * Remplace les 4 blocs if/else if/else if quasi identiques du composant
 * d'origine par une seule fonction générique paramétrée.
 */
interface NiveauConfig {
  cle: NiveauKey;
  // tableau d'objets { id, nom, ... }, ex: u.usines
  objetsKey: string;
  // tableau d'ids bruts, ex: u.usineIds
  idsKey: string;
  // valeur scalaire déjà résolue, ex: u.usineNom (optionnel)
  singleKey?: string;
  prefixe?: string; // ex: "Section "
  labelFallback: string; // ex: "Usine" -> "Usine {id}"
  champsAlternatifs?: string[]; // ex: ['wstdes'] pour les postes
}

const NIVEAUX: NiveauConfig[] = [
  { cle: 'usines', objetsKey: 'usines', idsKey: 'usineIds', singleKey: 'usineNom', labelFallback: 'Usine' },
  { cle: 'sections', objetsKey: 'sections', idsKey: 'sectionIds', singleKey: 'sectionNom', prefixe: 'Section ', labelFallback: 'Section' },
  { cle: 'lignes', objetsKey: 'lignes', idsKey: 'ligneIds', labelFallback: 'Ligne' },
  { cle: 'postes', objetsKey: 'postes', idsKey: 'posteIds', labelFallback: 'Poste', champsAlternatifs: ['wstdes'] },
];

/**
 * Résout les noms d'un niveau hiérarchique pour un utilisateur donné,
 * quel que soit le format renvoyé par l'API (objets, ids, ou valeur scalaire).
 * Retourne null si le niveau n'est pas renseigné.
 */
function resoudreNiveau(u: any, config: NiveauConfig, map: Map<number, string>): string | null {
  const objets = u[config.objetsKey];
  if (Array.isArray(objets) && objets.length > 0) {
    const noms = objets
      .map((x: any) => {
        if (x.nom) return x.nom;
        for (const champ of config.champsAlternatifs ?? []) {
          if (x[champ]) return x[champ];
        }
        const id = x.id ?? x;
        return map.get(id) ?? `${config.labelFallback} ${id}`;
      })
      .join(', ');
    return config.prefixe ? `${config.prefixe}${noms}` : noms;
  }

  const ids = u[config.idsKey];
  if (Array.isArray(ids) && ids.length > 0) {
    const noms = ids.map((id: number) => map.get(id) ?? `${config.labelFallback} ${id}`).join(', ');
    return config.prefixe ? `${config.prefixe}${noms}` : noms;
  }

  if (config.singleKey && u[config.singleKey]) {
    const val = u[config.singleKey];
    return config.prefixe ? `${config.prefixe}${val}` : val;
  }

  return null;
}

/** Extrait, pour un niveau donné, la liste des noms (en minuscule) rattachés à l'utilisateur — utilisé pour le filtrage. */
function nomsNiveauPourFiltre(u: any, config: NiveauConfig, usinesList: ZoneItem[]): string[] {
  const objets = u[config.objetsKey];
  if (Array.isArray(objets) && objets.length > 0) {
    return objets.map((x: any) => (x.nom ?? '').toLowerCase()).filter(Boolean);
  }

  const singleVal = config.singleKey ? u[config.singleKey] : undefined;
  if (singleVal) return [String(singleVal).toLowerCase()];

  const ids: number[] | undefined = u[config.idsKey];
  if (Array.isArray(ids) && ids.length > 0 && config.cle === 'usines') {
    return ids
      .map((id) => usinesList.find((item) => item.id === id)?.nom.toLowerCase())
      .filter((v): v is string => Boolean(v));
  }

  return [];
}

const ROLE_BADGE_STYLES: Record<string, { classes: string; label: string }> = {
  Administrateur: { classes: 'bg-red-100 text-red-700 border-red-200', label: 'Administrateur' },
  ResponsableUsine: { classes: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Resp. usine' },
  ChefSection: { classes: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Chef de section' },
  Operateur: { classes: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Opérateur' },
  Consultant: { classes: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Consultant' },
};

function RoleBadge({ role }: { role: RoleUtilisateur }) {
  const style = ROLE_BADGE_STYLES[role] ?? { classes: 'bg-gray-100 text-gray-700', label: role };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${style.classes}`}>
      {style.label}
    </span>
  );
}

function Rattachement({ u, zonesMaps }: { u: any; zonesMaps: ZonesMaps }) {
  if (u.role === 'Administrateur') {
    return <span className="text-slate-400 italic">Accès global</span>;
  }

  const parts = NIVEAUX.map((config) => resoudreNiveau(u, config, zonesMaps[config.cle])).filter(
    (v): v is string => Boolean(v)
  );

  if (parts.length === 0) {
    if (u.role === 'ResponsableUsine') return <>Toutes usines</>;
    return <span className="text-slate-400 italic">Non rattaché</span>;
  }

  return <>{parts.join(' — ')}</>;
}

// ---------------------------------------------------------------------------
// Ligne de tableau mémoïsée : évite de re-rendre toutes les lignes quand
// seul un filtre change ailleurs dans l'arbre (utile sur de grandes listes).
// ---------------------------------------------------------------------------

interface UserRowProps {
  u: UserDTO & Record<string, any>;
  zonesMaps: ZonesMaps;
  onSelect: (id: number) => void;
  onToggleStatut: (u: UserDTO) => void;
}

const UserRow = memo(function UserRow({ u, zonesMaps, onSelect, onToggleStatut }: UserRowProps) {
  return (
    <tr className="hover:bg-slate-50/80 transition">
      <td className="px-4 py-3 font-semibold text-slate-800">
        <button
          type="button"
          onClick={() => onSelect(u.id!)}
          className="hover:underline text-left text-[#1F4E79] font-medium"
        >
          {u.nom} {u.prenom}
        </button>
      </td>

      <td className="px-4 py-3 text-slate-500">{u.identifiant}</td>

      <td className="px-4 py-3">
        <RoleBadge role={u.role} />
      </td>

      <td className="px-4 py-3 text-slate-600 font-medium">
        <Rattachement u={u} zonesMaps={zonesMaps} />
      </td>

      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 font-medium text-xs">
          <span className={`h-2 w-2 rounded-full ${u.statut ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          <span className={u.statut ? 'text-slate-700' : 'text-slate-400'}>
            {u.statut ? 'Actif' : 'Inactif'}
          </span>
        </span>
      </td>

      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelect(u.id!)}
            className="px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
          >
            Modifier
          </button>
          <button
            type="button"
            onClick={() => onToggleStatut(u)}
            className={`px-3 py-1 text-xs font-medium rounded border transition ${
              u.statut
                ? 'text-rose-600 border-rose-300 hover:bg-rose-50'
                : 'text-emerald-600 border-emerald-300 hover:bg-emerald-50'
            }`}
          >
            {u.statut ? 'Désactiver' : 'Activer'}
          </button>
        </div>
      </td>
    </tr>
  );
});

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

const NIVEAUX_ZONES: Array<{ cle: NiveauKey; type: 'usine' | 'section' | 'ligne' | 'poste' }> = [
  { cle: 'usines', type: 'usine' },
  { cle: 'sections', type: 'section' },
  { cle: 'lignes', type: 'ligne' },
  { cle: 'postes', type: 'poste' },
];

export function UsersPage({ onAddUser, onEditUser }: UsersPageProps) {
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [usinesList, setUsinesList] = useState<ZoneItem[]>([]);
  const [zonesMaps, setZonesMaps] = useState<ZonesMaps>({
    usines: new Map(),
    sections: new Map(),
    lignes: new Map(),
    postes: new Map(),
  });

  const [selectedUserId, setSelectedUserId] = useState<number | 'new' | null>(null);

  const [recherche, setRecherche] = useState('');
  const [roleFiltre, setRoleFiltre] = useState<string>('Tous');
  const [usineFiltre, setUsineFiltre] = useState<string>('Toutes');
  const [statutFiltre, setStatutFiltre] = useState<string>('Tous');

  const chargerDonneesEtUtilisateurs = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [dataUsers, ...zonesResultats] = await Promise.all([
        getUsers(),
        ...NIVEAUX_ZONES.map(({ type }) => getAvailableZones(type).catch(() => [] as ZoneItem[])),
      ]);

      const nouvellesMaps = {} as ZonesMaps;
      NIVEAUX_ZONES.forEach(({ cle }, index) => {
        const liste = zonesResultats[index] as ZoneItem[];
        nouvellesMaps[cle] = new Map(liste.map((i) => [i.id, i.nom]));
        if (cle === 'usines') setUsinesList(liste);
      });

      setZonesMaps(nouvellesMaps);
      setUsers(dataUsers);
    } catch (err) {
      console.error('Erreur lors du chargement des données:', err);
      setErreur('Impossible de charger les utilisateurs. Veuillez réessayer.');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    chargerDonneesEtUtilisateurs();
  }, [chargerDonneesEtUtilisateurs]);

  const handleToggleStatut = useCallback(async (user: UserDTO) => {
    if (user.id === undefined) return;
    const userMaji = { ...user, statut: !user.statut };
    try {
      await updateUser(user.id, userMaji);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? userMaji : u)));
    } catch (err) {
      alert("Impossible de modifier le statut de l'utilisateur.");
    }
  }, []);

  const handleSelectUser = useCallback(
    (id: number) => {
      setSelectedUserId(id);
      onEditUser?.(id);
    },
    [onEditUser]
  );

  const handleAddUser = useCallback(() => {
    setSelectedUserId('new');
    onAddUser?.();
  }, [onAddUser]);

  // Filtrage dynamique côté client — recherche/lowercase calculés une seule
  // fois par rendu plutôt qu'à chaque itération de .filter().
  const utilisateursFiltres = useMemo(() => {
    const rechercheLower = recherche.trim().toLowerCase();
    const usineFiltreLower = usineFiltre.toLowerCase();

    return users.filter((u: any) => {
      if (rechercheLower) {
        const nomComplet = `${u.nom} ${u.prenom}`.toLowerCase();
        const matchNom = nomComplet.includes(rechercheLower);
        const matchId = u.identifiant?.toLowerCase().includes(rechercheLower);
        if (!matchNom && !matchId) return false;
      }

      if (roleFiltre !== 'Tous' && u.role !== roleFiltre) return false;

      if (usineFiltre !== 'Toutes' && u.role !== 'Administrateur') {
        const config = NIVEAUX.find((n) => n.cle === 'usines')!;
        const noms = nomsNiveauPourFiltre(u, config, usinesList);
        if (!noms.includes(usineFiltreLower)) return false;
      }

      if (statutFiltre === 'Actif' && !u.statut) return false;
      if (statutFiltre === 'Inactif' && u.statut) return false;

      return true;
    });
  }, [users, recherche, roleFiltre, usineFiltre, statutFiltre, usinesList]);

  // --- AFFICHAGE FORMULAIRE B2 ---
  if (selectedUserId !== null) {
    return (
      <UserFormPage
        userId={selectedUserId === 'new' ? undefined : selectedUserId}
        onRetour={() => setSelectedUserId(null)}
        onSaved={() => {
          setSelectedUserId(null);
          chargerDonneesEtUtilisateurs();
        }}
      />
    );
  }

  // --- AFFICHAGE LISTE B1 ---
  return (
    <div className="space-y-6">
      {/* ENTÊTE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-800">Liste des utilisateurs</h1>
        <button
          type="button"
          onClick={handleAddUser}
          className="inline-flex items-center justify-center px-4 py-2 bg-[#1F4E79] hover:bg-[#183d60] text-white text-sm font-medium rounded-md shadow-sm transition cursor-pointer"
        >
          + Nouvel utilisateur
        </button>
      </div>

      {/* FILTRES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input
          type="text"
          placeholder="Rechercher (nom, identifiant...)"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full h-10 px-3 bg-white border border-slate-300 rounded-md text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
        />

        <select
          value={roleFiltre}
          onChange={(e) => setRoleFiltre(e.target.value)}
          className="w-full h-10 px-3 bg-white border border-slate-300 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
        >
          <option value="Tous">Tous les profils</option>
          <option value="Operateur">Opérateur</option>
          <option value="ChefSection">Chef de section</option>
          <option value="ResponsableUsine">Resp. usine</option>
          <option value="Consultant">Consultant</option>
          <option value="Administrateur">Administrateur</option>
        </select>

        <select
          value={usineFiltre}
          onChange={(e) => setUsineFiltre(e.target.value)}
          className="w-full h-10 px-3 bg-white border border-slate-300 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
        >
          <option value="Toutes">Toutes les usines</option>
          {usinesList.length > 0 ? (
            usinesList.map((u) => (
              <option key={u.id} value={u.nom}>
                {u.nom}
              </option>
            ))
          ) : (
            <>
              <option value="Usine A">Usine A</option>
              <option value="Usine B">Usine B</option>
            </>
          )}
        </select>

        <select
          value={statutFiltre}
          onChange={(e) => setStatutFiltre(e.target.value)}
          className="w-full h-10 px-3 bg-white border border-slate-300 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
        >
          <option value="Tous">Actif / Inactif</option>
          <option value="Actif">Actif</option>
          <option value="Inactif">Inactif</option>
        </select>
      </div>

      {/* TABLEAU */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Identifiant</th>
                <th className="px-4 py-3">Profil</th>
                <th className="px-4 py-3">Rattachement</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {chargement ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Chargement des utilisateurs…
                  </td>
                </tr>
              ) : erreur ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-rose-500">
                    {erreur}{' '}
                    <button type="button" onClick={chargerDonneesEtUtilisateurs} className="underline">
                      Réessayer
                    </button>
                  </td>
                </tr>
              ) : utilisateursFiltres.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : (
                utilisateursFiltres.map((u: any) => (
                  <UserRow
                    key={u.id}
                    u={u}
                    zonesMaps={zonesMaps}
                    onSelect={handleSelectUser}
                    onToggleStatut={handleToggleStatut}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}