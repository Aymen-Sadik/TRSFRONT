import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ChevronDown, ChevronRight, Building2, Folder, 
  Plus, Trash2, X, AlertTriangle 
} from 'lucide-react';

// Imports d'API et de Types corrigés
import {zoneApi} from '../../api/zoneApi';
import type { ArborescenceUsineDto, PosteDeChargeDto } from '../../types/zone';

export const AffectationZonePage: React.FC = () => {
  const [arborescence, setArborescence] = useState<ArborescenceUsineDto[]>([]);
  const [postesNonAffectes, setPostesNonAffectes] = useState<PosteDeChargeDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dépliage des nœuds
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Modals / Formulaires (ajout de 'poste' pour la création manuelle)
  const [activeModal, setActiveModal] = useState<'usine' | 'section' | 'ligne' | 'affecter' | 'poste' | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);

  // Form inputs
  const [inputNom, setInputNom] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [inputAdresse, setInputAdresse] = useState('');
  const [selectedPosteId, setSelectedPosteId] = useState<number | null>(null);

  // 🔄 Chargement des données réelles
  const refreshData = useCallback(async () => {
    try {
      setErrorMsg(null);
      const [arboData, postesData] = await Promise.all([
        zoneApi.getArborescence(),
        zoneApi.getPostesNonAffectes()
      ]);

      setArborescence(arboData || []);
      setPostesNonAffectes(postesData || []);

      // Ouvrir par défaut lors du premier chargement
      setExpanded((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const initExpanded: Record<string, boolean> = {};
        arboData?.forEach((u: ArborescenceUsineDto) => {
          initExpanded[`usine-${u.id}`] = true;
          u.sections?.forEach((s) => {
            initExpanded[`section-${s.id}`] = true;
          });
        });
        return initExpanded;
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erreur de communication avec le serveur API.";
      setErrorMsg(msg);
    } finally { 
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 🟢 Handlers d'actions HTTP
  const handleCreateUsine = async () => {
    if (!inputNom || !inputCode) return;
    try {
      await zoneApi.createUsine({ 
        nom: inputNom, 
        code: inputCode, 
        adresse: inputAdresse || undefined 
      });
      closeModal();
      refreshData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Erreur lors de la création de l'usine.");
    }
  };

  const handleCreateSection = async () => {
    if (!inputNom || !targetId) return;
    try {
      await zoneApi.createSection({ nom: inputNom, usineId: targetId });
      closeModal();
      refreshData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Erreur lors de la création de la section.");
    }
  };

  const handleCreateLigne = async () => {
    if (!inputNom || !targetId) return;
    try {
      await zoneApi.createLigne({ nom: inputNom, sectionId: targetId });
      closeModal();
      refreshData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Erreur lors de la création de la ligne.");
    }
  };

const handleCreatePoste = async () => {
    // targetId correspond ici à l'ID de la ligne
    if (!inputCode || !targetId) return;

    // Le WSTREF est unique : créer un poste dont le code existe déjà échouait sur
    // « existe déjà », sans dire quoi faire. Or c'est le geste naturel pour poser
    // une machine sous une ligne — et depuis que les postes sont partageables,
    // l'intention est presque toujours de rattacher la machine existante.
    const codeSaisi = inputCode.trim().toUpperCase();
    const existant = tousLesPostes.find(
      (p) => p.wstref.trim().toUpperCase() === codeSaisi
    );

    if (existant) {
      if ((existant.lignes ?? []).some((l) => l.id === targetId)) {
        alert(`Le poste ${existant.wstref} équipe déjà cette ligne.`);
        return;
      }

      const lignesActuelles = (existant.lignes ?? []).map((l) => l.nom).join(', ');
      const confirme = window.confirm(
        `Le poste ${existant.wstref} existe déjà` +
          (lignesActuelles ? ` (sur ${lignesActuelles})` : '') +
          `.\n\nLe rattacher aussi à cette ligne ? La machine équipera les deux.`
      );
      if (!confirme) return;

      try {
        await zoneApi.affecterPoste(existant.id, targetId);
        closeModal();
        refreshData();
      } catch (err: any) {
        alert(err?.response?.data?.message || "Erreur lors du rattachement du poste.");
      }
      return;
    }

    try {
      await zoneApi.createPoste({ 
        wstref: inputCode, 
        wstdes: inputNom, 
        ligneIds: [targetId],
      });
      closeModal();
      refreshData();
    } catch (err: any) {
      const message = err?.response?.data?.message as string | undefined;
      alert(
        message?.includes('existe déjà')
          ? `${message}\n\nUtilisez le bouton « Affecter » de cette ligne pour y rattacher la machine existante.`
          : message || "Erreur lors de la création du poste."
      );
    }
  };

  const handleAffecterPoste = async () => {
    if (!selectedPosteId || !targetId) return;
    try {
      await zoneApi.affecterPoste(selectedPosteId, targetId);
      closeModal();
      refreshData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Erreur lors de l'affectation du poste.");
    }
  };

  // Un poste mutualise equipe plusieurs lignes : on ne retire que celle du noeud
  // clique, sinon detacher la machine d'une ligne la ferait disparaitre de toutes.
  const handleRetirerPoste = async (posteId: number, ligneId: number) => {
    try {
      await zoneApi.retirerPoste(posteId, ligneId);
      refreshData();
    } catch (err: any) {
      alert("Erreur lors du retrait du poste.");
    }
  };

  // Tous les postes connus, dedupliques : un poste partage apparait sous chacune
  // de ses lignes dans l'arborescence. Sert a alimenter la liste « Affecter »,
  // qui doit aussi proposer les postes deja rattaches ailleurs — c'est
  // precisement le cas d'usage d'une machine mutualisee.
  const tousLesPostes = useMemo(() => {
    const parId = new Map<number, PosteDeChargeDto>();
    for (const usine of arborescence)
      for (const section of usine.sections ?? [])
        for (const ligne of section.lignes ?? [])
          for (const poste of ligne.postes ?? []) parId.set(poste.id, poste);
    for (const poste of postesNonAffectes) parId.set(poste.id, poste);
    return [...parId.values()].sort((a, b) => a.wstref.localeCompare(b.wstref));
  }, [arborescence, postesNonAffectes]);

  const handleDeleteUsine = async (id: number) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cette usine ?")) return;
    try {
      await zoneApi.deleteUsine(id);
      refreshData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Impossible de supprimer l'usine.");
    }
  };

  const handleDeleteSection = async (id: number) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cette section ?")) return;
    try {
      await zoneApi.deleteSection(id);
      refreshData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Impossible de supprimer la section.");
    }
  };

  const handleDeleteLigne = async (id: number) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cette ligne ?")) return;
    try {
      await zoneApi.deleteLigne(id);
      refreshData();
    } catch (err: any) {
      alert("Impossible de supprimer la ligne.");
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setTargetId(null);
    setInputNom('');
    setInputCode('');
    setInputAdresse('');
    setSelectedPosteId(null);
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      
      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar Header */}
        <header className="bg-[#2C2C2A] text-white px-6 py-3 text-sm font-medium">
          Back-office — Affectation zone
        </header>

        {/* Dynamic Zone */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            
            {/* Header Content */}
            <div className="p-6 flex items-center justify-between border-b border-slate-100">
              <h1 className="text-xl font-bold text-slate-800">Arborescence de production</h1>
              <button 
                onClick={() => setActiveModal('usine')}
                className="flex items-center space-x-2 bg-[#1F4E79] hover:bg-[#163a5c] text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                <Plus size={16} />
                <span>+ Usine</span>
              </button>
            </div>

            {/* Tree View Body */}
            <div className="p-6 space-y-4">
              {loading && <div className="text-center py-8 text-slate-500">Chargement de l'arborescence depuis la BDD...</div>}
              {errorMsg && <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg">{errorMsg}</div>}

              {!loading && arborescence.map((usine) => {
                const uKey = `usine-${usine.id}`;
                const isUsineExpanded = expanded[uKey];

                return (
                  <div key={usine.id} className="border border-slate-200 rounded-lg p-3 bg-white">
                    {/* NIVEAU 1: Usine */}
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center space-x-2 cursor-pointer select-none"
                        onClick={() => toggleExpand(uKey)}
                      >
                        {isUsineExpanded ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronRight size={18} className="text-slate-500" />}
                        <Building2 size={18} className="text-red-600" />
                        <span className="font-bold text-slate-800">{usine.nom} — {usine.code}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${usine.statut ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {usine.statut ? 'Actif' : 'Inactif'}
                        </span>
                        <button 
                          onClick={() => { setTargetId(usine.id); setActiveModal('section'); }}
                          className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded hover:bg-slate-50 text-slate-700 flex items-center space-x-1"
                        >
                          <Plus size={12} />
                          <span>Section</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteUsine(usine.id)}
                          className="p-1 text-slate-400 hover:text-red-600 border border-slate-200 rounded"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* NIVEAU 2: Sections */}
                    {isUsineExpanded && (
                      <div className="ml-6 mt-3 space-y-3 pl-4 border-l-2 border-slate-100">
                        {usine.sections?.map((section) => {
                          const sKey = `section-${section.id}`;
                          const isSectionExpanded = expanded[sKey];

                          return (
                            <div key={section.id} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div 
                                  className="flex items-center space-x-2 cursor-pointer select-none"
                                  onClick={() => toggleExpand(sKey)}
                                >
                                  {isSectionExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                                  <Folder size={16} className="text-amber-500" />
                                  <span className="font-semibold text-slate-700">{section.nom}</span>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <button 
                                    onClick={() => { setTargetId(section.id); setActiveModal('ligne'); }}
                                    className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-700 flex items-center space-x-1"
                                  >
                                    <Plus size={12} />
                                    <span>Ligne</span>
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteSection(section.id)}
                                    className="p-1 text-slate-400 hover:text-red-600 border border-slate-200 rounded"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>

                              {/* NIVEAU 3: Lignes de production */}
                              {isSectionExpanded && (
                                <div className="ml-6 space-y-2 pl-4 border-l-2 border-slate-100">
                                  {section.lignes?.map((ligne) => (
                                    <div key={ligne.id} className="p-2 bg-slate-50 rounded-md border border-slate-200/60">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                          <ChevronRight size={14} className="text-slate-400" />
                                          <span className="font-medium text-slate-800 text-sm">{ligne.nom}</span>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                          <button 
                                            onClick={() => { setTargetId(ligne.id); setActiveModal('affecter'); }}
                                            className="px-2 py-0.5 text-xs border border-slate-300 rounded bg-white hover:bg-slate-100 text-slate-700 flex items-center space-x-1"
                                            title="Affecter à cette ligne un poste existant"
                                          >
                                            <Plus size={12} />
                                            <span>Affecter</span>
                                          </button>
                                          <button 
                                            onClick={() => { setTargetId(ligne.id); setActiveModal('poste'); }}
                                            className="px-2 py-0.5 text-xs border border-sky-300 rounded bg-sky-50 hover:bg-sky-100 text-sky-700 flex items-center space-x-1"
                                            title="Créer un nouveau poste"
                                          >
                                            <Plus size={12} />
                                            <span>Créer</span>
                                          </button>
                                          <button 
                                            onClick={() => handleDeleteLigne(ligne.id)}
                                            className="p-1 text-slate-400 hover:text-red-600 ml-2"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </div>

                                      {/* NIVEAU 4: Postes de charge (WSTREF) */}
                                      {ligne.postes && ligne.postes.length > 0 && (
                                        <div className="mt-2 ml-6 text-xs text-slate-500 flex flex-wrap gap-2 items-center">
                                          <span className="font-semibold text-slate-400">Postes :</span>
                                          {ligne.postes.map((p) => {
                                            const autresLignes = (p.lignes ?? [])
                                              .filter((l) => l.id !== ligne.id)
                                              .map((l) => l.nom);
                                            return (
                                              <span
                                                key={p.id}
                                                className={`inline-flex items-center space-x-1 border px-2 py-0.5 rounded font-mono ${
                                                  autresLignes.length > 0
                                                    ? 'bg-sky-50 border-sky-300 text-sky-800'
                                                    : 'bg-white border-slate-200 text-slate-700'
                                                }`}
                                              >
                                                <span>{p.wstref}</span>
                                                {autresLignes.length > 0 && (
                                                  <span
                                                    className="font-sans text-[10px] font-semibold text-sky-700"
                                                    title={`Machine partagée avec : ${autresLignes.join(', ')}`}
                                                  >
                                                    partagé ×{(p.lignes ?? []).length}
                                                  </span>
                                                )}
                                                <button
                                                  onClick={() => handleRetirerPoste(p.id, ligne.id)}
                                                  className="text-slate-400 hover:text-red-500 ml-1"
                                                  title={
                                                    autresLignes.length > 0
                                                      ? `Retirer de ${ligne.nom} uniquement`
                                                      : 'Retirer ce poste (x)'
                                                  }
                                                >
                                                  <X size={12} />
                                                </button>
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* BANDEAU ORANGE: Postes non affectés (référentiel de production) */}
            <div className="m-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-amber-900 text-sm">
              <div className="flex items-center space-x-3">
                <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold">Postes non affectés ({postesNonAffectes.length})</span>
                  <span className="text-amber-800"> — issus du référentiel de production, à rattacher à une ligne</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {postesNonAffectes.length === 0 ? (
                      <span className="text-xs text-amber-700 italic">Aucun poste en attente d'affectation.</span>
                    ) : (
                      postesNonAffectes.map((p) => (
                        <span key={p.id} className="font-mono bg-amber-100 px-2 py-0.5 rounded text-xs text-amber-900 border border-amber-300">
                          {p.wstref} {p.wstdes ? `(${p.wstdes})` : ''}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* Modals de Création / Affectation */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800">
                {activeModal === 'usine' && 'Ajouter une usine'}
                {activeModal === 'section' && 'Ajouter une section'}
                {activeModal === 'ligne' && 'Ajouter une ligne'}
                {activeModal === 'affecter' && 'Affecter un poste à cette ligne'}
                {activeModal === 'poste' && 'Créer un nouveau poste'}
              </h3>
              <button onClick={closeModal}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
            </div>

            {activeModal === 'usine' && (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nom de l'usine *</label>
                  <input type="text" value={inputNom} onChange={(e) => setInputNom(e.target.value)} className="w-full border rounded-lg p-2 text-slate-800 focus:outline-sky-500" placeholder="Ex: Usine A" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Code Usine (Sage X3) *</label>
                  <input type="text" value={inputCode} onChange={(e) => setInputCode(e.target.value)} className="w-full border rounded-lg p-2 text-slate-800 focus:outline-sky-500" placeholder="Ex: Casablanca" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Adresse</label>
                  <input type="text" value={inputAdresse} onChange={(e) => setInputAdresse(e.target.value)} className="w-full border rounded-lg p-2 text-slate-800 focus:outline-sky-500" placeholder="Adresse optionnelle" />
                </div>
              </div>
            )}

            {(activeModal === 'section' || activeModal === 'ligne') && (
              <div className="text-sm">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nom *</label>
                <input type="text" value={inputNom} onChange={(e) => setInputNom(e.target.value)} className="w-full border rounded-lg p-2 text-slate-800 focus:outline-sky-500" placeholder="Ex: Fabrication / Pesée" />
              </div>
            )}

            {activeModal === 'poste' && (
              <div className="space-y-3 text-sm">
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-2">
                  Pour une machine déjà présente sur une autre ligne, utilisez plutôt
                  « Affecter » : elle équipera les deux lignes au lieu d'être dupliquée.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Référence du poste (WSTREF) *</label>
                  <input type="text" value={inputCode} onChange={(e) => setInputCode(e.target.value)} className="w-full border rounded-lg p-2 text-slate-800 focus:outline-sky-500" placeholder="Ex: MAC-01" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Désignation</label>
                  <input type="text" value={inputNom} onChange={(e) => setInputNom(e.target.value)} className="w-full border rounded-lg p-2 text-slate-800 focus:outline-sky-500" placeholder="Ex: Machine d'emballage" />
                </div>
              </div>
            )}

            {activeModal === 'affecter' && (
              <div className="text-sm">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Sélectionner un poste *</label>
                <select 
                  value={selectedPosteId || ''} 
                  onChange={(e) => setSelectedPosteId(Number(e.target.value))} 
                  className="w-full border rounded-lg p-2 text-slate-800 focus:outline-sky-500"
                >
                  <option value="">-- Sélectionner --</option>
                  {tousLesPostes
                    .filter((p) => !(p.lignes ?? []).some((l) => l.id === targetId))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.wstref}
                        {p.wstdes ? ` — ${p.wstdes}` : ''}
                        {(p.lignes ?? []).length > 0
                          ? ` (déjà sur ${(p.lignes ?? []).map((l) => l.nom).join(', ')})`
                          : ' (non affecté)'}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button onClick={closeModal} className="px-4 py-2 border rounded-lg text-slate-600 text-sm">Annuler</button>
              <button 
                onClick={() => {
                  if (activeModal === 'usine') handleCreateUsine();
                  if (activeModal === 'section') handleCreateSection();
                  if (activeModal === 'ligne') handleCreateLigne();
                  if (activeModal === 'affecter') handleAffecterPoste();
                  if (activeModal === 'poste') handleCreatePoste();
                }} 
                className="px-4 py-2 bg-[#1F4E79] hover:bg-[#163a5c] text-white rounded-lg text-sm font-semibold"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};