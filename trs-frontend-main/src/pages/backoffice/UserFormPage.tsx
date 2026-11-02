// src/pages/backoffice/UserFormPage.tsx
import React, { useState, useEffect } from 'react';
import type { UserDTO, RoleUtilisateur } from '../../types/users';
import { 
  createUser, 
  updateUser, 
  getUserById, 
  resetPasswordApi, 
  getAvailableZones
} from '../../api/userApi';

// Types d'entités de zones
export type ZoneType = 'usine' | 'section' | 'ligne' | 'poste';

export interface ZoneItem {
  id: number;
  type: ZoneType;
  nom: string;
  parentNom?: string; // Nom du parent pour lisibilité
}

interface UserFormPageProps {
  userId?: number;
  onRetour?: () => void;
  onSaved?: () => void;
  onBack?: () => void;
  onSuccess?: () => void;
}

// Couleurs déterministes pour l'avatar
const AVATAR_COLORS = [
  'bg-blue-600 text-white',
  'bg-indigo-600 text-white',
  'bg-emerald-600 text-white',
  'bg-amber-600 text-white',
  'bg-purple-600 text-white',
  'bg-rose-600 text-white',
  'bg-teal-600 text-white',
];

function getAvatarColor(identifier: string): string {
  if (!identifier) return 'bg-slate-300 text-slate-700';
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function UserFormPage({ 
  userId, 
  onRetour, 
  onSaved, 
  onBack, 
  onSuccess 
}: UserFormPageProps) {
  const isEditMode = Boolean(userId);
  const handleBack = onBack || onRetour;
  const handleSaved = onSuccess || onSaved;

  // Form State
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [identifiant, setIdentifiant] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoleUtilisateur>('Operateur');
  const [estActif, setEstActif] = useState<boolean>(true);

  // Zones Rattachées (Sélectionnées par l'utilisateur)
  const [selectedZones, setSelectedZones] = useState<ZoneItem[]>([]);
  
  // Zones venant du backend pour la modal
  const [availableZones, setAvailableZones] = useState<ZoneItem[]>([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [filterTypeModal, setFilterTypeModal] = useState<ZoneType>('usine');

  // UI State
  const [chargement, setChargement] = useState(false);
  // Confirmation affichee apres l'envoi du lien de reinitialisation.
  const [lienEnvoye, setLienEnvoye] = useState(false);
  // Suivi de la notification : null tant qu'aucune reinitialisation n'a eu lieu.
  const [envoiEmail, setEnvoiEmail] = useState<{ envoye: boolean; email?: string | null } | null>(null);

  // Déterminer l'onglet par défaut selon le rôle
  useEffect(() => {
    if (role === 'ResponsableUsine') setFilterTypeModal('usine');
    else if (role === 'ChefSection') setFilterTypeModal('section');
    else if (role === 'Operateur') setFilterTypeModal('ligne');
    else setFilterTypeModal('usine');
  }, [role]);

  // 1️⃣ Charger les zones disponibles depuis le backend quand la modal s'ouvre ou que le type change
  useEffect(() => {
    if (isZoneModalOpen) {
      setLoadingZones(true);
      getAvailableZones(filterTypeModal)
        .then((data) => setAvailableZones(data))
        .catch((err) => console.error("Erreur de chargement des zones:", err))
        .finally(() => setLoadingZones(false));
    }
  }, [isZoneModalOpen, filterTypeModal]);

  // 2️⃣ Chargement des données de l'utilisateur en mode Édition
 // 2️⃣ Chargement des données de l'utilisateur en mode Édition
  useEffect(() => {
    if (userId) {
      setChargement(true);
      
      // Récupérer simultanément les données utilisateur et le référentiel des zones
      Promise.all([
        getUserById(userId),
        getAvailableZones('usine'),
        getAvailableZones('section'),
        getAvailableZones('ligne'),
        getAvailableZones('poste'),
      ])
        .then(([user, usinesList, sectionsList, lignesList, postesList]: [any, ZoneItem[], ZoneItem[], ZoneItem[], ZoneItem[]]) => {
          setNom(user.nom || '');
          setPrenom(user.prenom || '');
          setIdentifiant(user.identifiant || '');
          setEmail(user.email || '');
          setRole(user.role || 'Operateur');
          setEstActif(user.statut ?? user.estActif ?? true);

          const initialZones: ZoneItem[] = [];

          // Map des noms par ID pour récupérer les vrais libellés
          const usinesMap = new Map(usinesList.map(item => [item.id, item.nom]));
          const sectionsMap = new Map(sectionsList.map(item => [item.id, item.nom]));
          const lignesMap = new Map(lignesList.map(item => [item.id, item.nom]));
          const postesMap = new Map(postesList.map(item => [item.id, item.nom]));

          // A. Extraction si l'API renvoie des collections d'objets complets
          if (Array.isArray(user.usines) && user.usines.length > 0) {
            user.usines.forEach((u: any) => initialZones.push({ id: u.id || u, type: 'usine', nom: u.nom || usinesMap.get(u.id || u) || `Usine ${u.id || u}` }));
          }
          if (Array.isArray(user.sections) && user.sections.length > 0) {
            user.sections.forEach((s: any) => initialZones.push({ id: s.id || s, type: 'section', nom: s.nom || sectionsMap.get(s.id || s) || `Section ${s.id || s}` }));
          }
          if (Array.isArray(user.lignes) && user.lignes.length > 0) {
            user.lignes.forEach((l: any) => initialZones.push({ id: l.id || l, type: 'ligne', nom: l.nom || lignesMap.get(l.id || l) || `Ligne ${l.id || l}` }));
          }
          if (Array.isArray(user.postes) && user.postes.length > 0) {
            user.postes.forEach((p: any) => initialZones.push({ id: p.id || p, type: 'poste', nom: p.nom || p.wstdes || postesMap.get(p.id || p) || `Poste ${p.id || p}` }));
          }

          // B. Extraction si l'API ne renvoie que des tableaux d'IDs (ex: usineIds: [1, 2])
          if (initialZones.length === 0) {
            if (Array.isArray(user.usineIds)) {
              user.usineIds.forEach((id: number) => initialZones.push({ id, type: 'usine', nom: usinesMap.get(id) || `Usine ${id}` }));
            }
            if (Array.isArray(user.sectionIds)) {
              user.sectionIds.forEach((id: number) => initialZones.push({ id, type: 'section', nom: sectionsMap.get(id) || `Section ${id}` }));
            }
            if (Array.isArray(user.ligneIds)) {
              user.ligneIds.forEach((id: number) => initialZones.push({ id, type: 'ligne', nom: lignesMap.get(id) || `Ligne ${id}` }));
            }
            if (Array.isArray(user.posteIds)) {
              user.posteIds.forEach((id: number) => initialZones.push({ id, type: 'poste', nom: postesMap.get(id) || `Poste ${id}` }));
            }
          }

          setSelectedZones(initialZones);
        })
        .catch((err) => {
          console.error("Erreur lors de la récupération de l'utilisateur :", err);
          alert("Erreur de chargement de l'utilisateur");
        })
        .finally(() => setChargement(false));
    }
  }, [userId]);

  const initiales = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || 'U';

  const toggleZoneSelection = (zone: ZoneItem) => {
    const exists = selectedZones.some((z) => z.id === zone.id && z.type === zone.type);
    if (exists) {
      setSelectedZones(selectedZones.filter((z) => !(z.id === zone.id && z.type === zone.type)));
    } else {
      setSelectedZones([...selectedZones, zone]);
    }
  };

  const removeZone = (id: number, type: ZoneType) => {
    setSelectedZones(selectedZones.filter((z) => !(z.id === id && z.type === type)));
  };

  // 3️⃣ Soumission du formulaire (Appel API Save)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || !prenom.trim() || !identifiant.trim()) {
      alert('Veuillez remplir les champs obligatoires (*)');
      return;
    }

    setChargement(true);

    const payload: Partial<UserDTO> & {
      usineIds?: number[];
      sectionIds?: number[];
      ligneIds?: number[];
      posteIds?: number[];
    } = {
      nom,
      prenom,
      identifiant,
      role,
      statut: estActif,
      ...(email ? { email } : {}),
      usineIds: selectedZones.filter((z) => z.type === 'usine').map((z) => z.id),
      sectionIds: selectedZones.filter((z) => z.type === 'section').map((z) => z.id),
      ligneIds: selectedZones.filter((z) => z.type === 'ligne').map((z) => z.id),
      posteIds: selectedZones.filter((z) => z.type === 'poste').map((z) => z.id),
    };

    try {
      if (isEditMode && userId) {
        await updateUser(userId, payload);
        alert('Fiche utilisateur mise à jour avec succès.');
      } else {
        await createUser(payload);
        alert('Utilisateur créé avec succès.');
      }
      
      // Notifier le composant parent tout en conservant les badges sélectionnés localement
      if (handleSaved) handleSaved();
    } catch (err) {
      console.error("Erreur API Save:", err);
      alert("Erreur lors de l'enregistrement");
    } finally {
      setChargement(false);
    }
  };

  const handleResetPassword = async () => {
    if (!identifiant) return alert("Identifiant introuvable.");

    try {
      setChargement(true);
      const reponse = await resetPasswordApi(identifiant);
      setEnvoiEmail({ envoye: reponse.emailEnvoye, email: reponse.email });
      setLienEnvoye(true);
    } catch (err) {
      alert("Impossible d'envoyer le lien de réinitialisation.");
    } finally {
      setChargement(false);
    }
  };

  const getBadgeStyle = (type: ZoneType) => {
    switch (type) {
      case 'usine':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'section':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ligne':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'poste':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex p-6">
      <div className="w-full max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
        
        <main className="flex-1 p-6 bg-white">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-100">
            <h1 className="text-xl font-bold text-slate-800">
              Back-office — Fiche utilisateur
            </h1>
            {handleBack && (
              <button
                type="button"
                onClick={handleBack}
                className="text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                ← Retour à la liste
              </button>
            )}
          </div>

          <div className="flex items-center space-x-4 mb-8">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shadow-sm ${getAvatarColor(identifiant)}`}>
              {initiales}
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800">
                {prenom || nom ? `${prenom} ${nom}` : 'Nouvel utilisateur'}
              </div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 mt-1">
                {role}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nom <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Nom de famille"
                  className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm text-slate-800 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Prénom <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  placeholder="Prénom"
                  className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm text-slate-800 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Identifiant <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isEditMode}
                  value={identifiant}
                  onChange={(e) => setIdentifiant(e.target.value)}
                  placeholder="ex: user1"
                  className={`w-full h-10 px-3 border rounded-md text-sm focus:ring-2 focus:ring-[#1F4E79] focus:outline-none ${
                    isEditMode ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed' : 'border-slate-300 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@sothema.ma"
                  className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm text-slate-800 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Profil / Rôle <span className="text-rose-500">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as RoleUtilisateur)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm text-slate-800 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none bg-white"
                >
                  <option value="Administrateur">Administrateur</option>
                  <option value="ResponsableUsine">ResponsableUsine</option>
                  <option value="ChefSection">ChefSection</option>
                  <option value="Operateur">Operateur</option>
                  <option value="Consultant">Consultant</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Statut
                </label>
                <select
                  value={estActif ? 'Actif' : 'Inactif'}
                  onChange={(e) => setEstActif(e.target.value === 'Actif')}
                  className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm text-slate-800 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none bg-white"
                >
                  <option value="Actif">Actif</option>
                  <option value="Inactif">Inactif</option>
                </select>
              </div>

              {/* Plus de champ mot de passe : l'administrateur ne doit pas le
                  connaitre. A la creation, l'utilisateur recoit un lien lui
                  permettant de definir le sien ; ensuite il le change seul. */}
              {!isEditMode && (
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5">
                    <strong className="text-slate-800">Mot de passe</strong> — un lien
                    d'activation sera envoyé à l'adresse e-mail saisie. L'utilisateur
                    choisira lui-même son mot de passe ; vous ne le connaîtrez pas.
                  </div>
                </div>
              )}

            </div>

            {/* RATTACHEMENT (ZONES) */}
            {role !== 'Administrateur' && (
              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rattachement (zones) <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md min-h-12.5">
                  
                  {selectedZones.map((zone) => (
                    <span 
                      key={`${zone.type}-${zone.id}`} 
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getBadgeStyle(zone.type)}`}
                    >
                      <span>{zone.nom}</span>
                      <button
                        type="button"
                        onClick={() => removeZone(zone.id, zone.type)}
                        className="font-bold ml-1 hover:opacity-75 focus:outline-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  <button
                    type="button"
                    onClick={() => setIsZoneModalOpen(true)}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-dashed border-slate-400 text-slate-600 hover:bg-slate-100 transition"
                  >
                    + Ajouter une zone
                  </button>
                </div>
              </div>
            )}

            {/* FOOTER */}
            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="submit"
                disabled={chargement}
                className="w-full sm:w-auto px-8 py-2.5 bg-[#1F4E79] hover:bg-[#183d60] text-white text-sm font-semibold rounded-md shadow-sm transition disabled:opacity-50"
              >
                {chargement ? 'Enregistrement...' : 'Enregistrer'}
              </button>

              {isEditMode && (
                <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    className="w-full sm:w-auto px-5 py-2.5 border border-rose-400 text-rose-600 hover:bg-rose-50 text-sm font-medium rounded-md transition"
                  >
                    Réinitialiser MDP
                  </button>

                  <button
                    type="button"
                    onClick={() => setEstActif(!estActif)}
                    className="w-full sm:w-auto px-5 py-2.5 border border-rose-400 text-rose-600 hover:bg-rose-50 text-sm font-medium rounded-md transition"
                  >
                    {estActif ? 'Désactiver le compte' : 'Réactiver le compte'}
                  </button>
                </div>
              )}
            </div>
          </form>
        </main>
      </div>

      {/* MODAL SELECTION ZONES */}
      {isZoneModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Affecter une zone
            </h3>
            
            <div className="flex border-b border-slate-200 mb-4 gap-2">
              {(['usine', 'section', 'ligne', 'poste'] as ZoneType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterTypeModal(type)}
                  className={`py-2 px-3 text-xs font-semibold capitalize border-b-2 transition ${
                    filterTypeModal === type 
                      ? 'border-[#1F4E79] text-[#1F4E79]' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {type === 'usine' ? 'Usines' : type === 'section' ? 'Sections' : type === 'ligne' ? 'Lignes' : 'Postes'}
                </button>
              ))}
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-md p-3 mb-6 bg-slate-50 min-h-[150px]">
              {loadingZones ? (
                <div className="flex items-center justify-center h-32 text-xs text-slate-500">
                  Chargement des zones...
                </div>
              ) : availableZones.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-xs text-slate-400">
                  Aucune zone disponible
                </div>
              ) : (
                availableZones.map((zone) => {
                  const isChecked = selectedZones.some((z) => z.id === zone.id && z.type === zone.type);
                  return (
                    <label
                      key={`${zone.type}-${zone.id}`}
                      className="flex items-center justify-between p-2 rounded hover:bg-white cursor-pointer border border-transparent hover:border-slate-200 transition"
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleZoneSelection(zone)}
                          className="h-4 w-4 text-[#1F4E79] rounded border-slate-300 focus:ring-[#1F4E79]"
                        />
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{zone.nom}</div>
                          {zone.parentNom && (
                            <div className="text-xs text-slate-400">Parent: {zone.parentNom}</div>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsZoneModalOpen(false)}
              className="w-full py-2 bg-[#1F4E79] text-white font-medium text-sm rounded-md hover:bg-[#183d60] transition"
            >
              Terminer ({selectedZones.length} zones sélectionnées)
            </button>
          </div>
        </div>
      )}

      {/* POPUP MOT DE PASSE TEMPORAIRE */}
      {lienEnvoye && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Lien de réinitialisation</h3>

            {envoiEmail?.envoye ? (
              <>
                <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-3">
                  Un lien vient d'être envoyé à <strong>{envoiEmail.email}</strong>.
                  L'utilisateur choisira lui-même son nouveau mot de passe.
                </p>
                <p className="text-xs text-slate-500 mb-4">
                  Le lien est valable 48 heures et ne peut servir qu'une fois. Son mot
                  de passe actuel reste valable tant qu'il ne l'a pas utilisé.
                </p>
              </>
            ) : (
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4">
                <strong>Le lien n'a pas pu être envoyé.</strong> Vérifiez la
                configuration de la messagerie, puis réessayez. Le mot de passe de
                l'utilisateur est inchangé.
              </p>
            )}

            <button
              onClick={() => { setLienEnvoye(false); setEnvoiEmail(null); }}
              className="w-full py-2 bg-[#1F4E79] text-white font-medium text-sm rounded-md hover:bg-[#183d60] transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

    </div>
  );
}