import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchOrdreFabrication, fetchOperation } from '../api/productionApi';
import { demarrerPointage, type PointageDto } from '../api/PointageApi';

export interface OfData {
  mfgnum: string;
  itmref: string;
  designation: string;
  quantite: number;
  dateFin: string;
  statut: string;
}

export interface OperationData {
  id: number;
  openum: string;
  designation: string;
  wstref: string;
  tempsTheorique: string;
}

interface ScanOfPageProps {
  onStartPointage?: (data: { of: OfData; operation: OperationData; pointage: PointageDto }) => void;
}

// Le code-barres opération est au format MFGNUM-OPENUM (ex. OF-2024-0412-OP20).
// Le fallback manuel peut ne contenir que OPENUM : on retire le préfixe s'il est présent.
function extractOpenum(rawCode: string, mfgnum: string): string {
  const upper = rawCode.trim().toUpperCase();
  const prefix = `${mfgnum.toUpperCase()}-`;
  return upper.startsWith(prefix) ? upper.slice(prefix.length) : upper;
}

export const ScanOfPage: React.FC<ScanOfPageProps> = ({ onStartPointage }) => {
  const { utilisateur } = useAuth();

  // États pour la recherche et la validation
  const [ofInput, setOfInput] = useState('');
  const [opInput, setOpInput] = useState('');

  const [confirmedOf, setConfirmedOf] = useState<OfData | null>(null);
  const [confirmedOp, setConfirmedOp] = useState<OperationData | null>(null);

  const [loadingOf, setLoadingOf] = useState(false);
  const [loadingOp, setLoadingOp] = useState(false);
  const [errorOf, setErrorOf] = useState<string | null>(null);
  const [errorOp, setErrorOp] = useState<string | null>(null);
  // Un refus d'habilitation n'est pas une erreur de saisie : rescanner n'y changera
  // rien. On le distingue pour l'afficher comme une consigne, pas comme un incident.
  const [refusZone, setRefusZone] = useState(false);
  const [loadingStart, setLoadingStart] = useState(false);
  const [errorStart, setErrorStart] = useState<string | null>(null);

  // Refs pour garder l'input masqué/focus actif pour la douchette (lecteur code-barres)
  const hiddenOfRef = useRef<HTMLInputElement>(null);
  const hiddenOpRef = useRef<HTMLInputElement>(null);

  // Focus automatique sur la zone de scan active
  useEffect(() => {
    if (!confirmedOf) {
      hiddenOfRef.current?.focus();
    } else if (!confirmedOp) {
      hiddenOpRef.current?.focus();
    }
  }, [confirmedOf, confirmedOp]);

  // Validation séquentielle de l'OF (Étape 1) — appel réel au backend
  const handleValidateOf = async (code: string) => {
    const mfgnum = code.trim().toUpperCase();
    if (!mfgnum) return;

    setLoadingOf(true);
    setErrorOf(null);
    try {
      const dto = await fetchOrdreFabrication(mfgnum);
      setConfirmedOf({
        mfgnum: dto.mfgnum,
        itmref: dto.itmref,
        designation: dto.itmdes,
        quantite: dto.mfgqty,
        dateFin: dto.extdatend,
        statut: dto.mfgsta,
      });
    } catch (err: any) {
      setConfirmedOf(null);
      setErrorOf(
        err?.status === 404
          ? `Aucun OF trouvé pour le code "${mfgnum}".`
          : "Erreur lors de la récupération de l'OF. Réessayez."
      );
    } finally {
      setLoadingOf(false);
    }
  };

  // Validation de l'Opération (Étape 2) — appel réel au backend
// Validation de l'Opération (Étape 2) — appel réel au backend
// Validation de l'Opération (Étape 2) — appel réel au backend
const handleValidateOp = async (code: string) => {
  if (!confirmedOf) return;
  const openum = extractOpenum(code, confirmedOf.mfgnum);
  if (!openum) return;

  setLoadingOp(true);
  setErrorOp(null);
  setRefusZone(false);
  try {
    const dto = await fetchOperation(confirmedOf.mfgnum, openum);

    // FIX TS : OperationDto contient uniquement 'timtot' en minuscules
    const rawTemps = dto.timtot ?? 0;

    setConfirmedOp({
      id: dto.id,
      openum: dto.openum,
      // FIX TS : OperationDto contient 'openam' (pas 'designation')
      designation: dto.openam || 'Opération',
      wstref: dto.wstdes ? `${dto.wstref} - ${dto.wstdes}` : dto.wstref,
      tempsTheorique: `${rawTemps} min`,
    });
  } catch (err: any) {
    setConfirmedOp(null);
    if (err?.status === 403) {
      // Le serveur nomme le poste concerné : son message vaut mieux que le nôtre.
      setRefusZone(true);
      setErrorOp(err.message);
    } else {
      setRefusZone(false);
      setErrorOp(
        err?.status === 404
          ? `Aucune opération "${openum}" trouvée pour cet OF.`
          : "Erreur lors de la récupération de l'opération. Réessayez."
      );
    }
  } finally {
    setLoadingOp(false);
  }
};

  // Réinitialise l'étape 2 si on change d'OF après coup
  const resetOf = () => {
    setConfirmedOf(null);
    setConfirmedOp(null);
    setErrorOf(null);
    setErrorOp(null);
    setRefusZone(false);
  };

  // Action déclenchée au clic sur Démarrer — crée réellement le pointage en base
const handleStartPointage = async () => {
  if (!confirmedOf || !confirmedOp) return;

  setLoadingStart(true);
  setErrorStart(null);

  try {
    const pointage = await demarrerPointage(confirmedOp.id);

    if (!pointage.sessionId) {
      console.warn('⚠️ sessionId manquant dans la réponse du backend — vérifier PointageDto côté API.');
    }

    onStartPointage?.({ of: confirmedOf, operation: confirmedOp, pointage });
  } catch (err: any) {
    setErrorStart(err?.message ?? 'Impossible de démarrer le pointage. Réessayez.');
  } finally {
    setLoadingStart(false);
  }
};
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* En-tête */}
      <header className="bg-[#1E3A8A] text-white px-6 py-3 flex items-center justify-between shadow-md">
        <h1 className="text-xl font-bold tracking-wide">Scan OF & Opération</h1>
        <div className="flex items-center space-x-2 bg-emerald-500 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-sm">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
          <span>{utilisateur?.nom || 'Prénom Nom opérateur'}</span>
        </div>
      </header>

      {/* Contenu Principal */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col justify-between">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* ÉTAPE 1 — OF */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Étape 1 — Ordre de Fabrication
              </h2>
              {confirmedOf && (
                <button
                  onClick={resetOf}
                  className="text-xs font-medium text-slate-400 hover:text-slate-600 underline"
                >
                  Changer d'OF
                </button>
              )}
            </div>

            <div 
              onClick={() => !loadingOf && hiddenOfRef.current?.focus()}
              className={`border-2 border-dashed rounded-lg p-6 bg-blue-50/50 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-50 transition-colors relative ${
                errorOf ? 'border-red-400' : 'border-blue-400'
              }`}
            >
              <svg className="w-8 h-8 text-blue-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <p className="text-sm font-medium text-slate-700">
                {loadingOf ? 'Recherche en cours...' : 'Scanner le code-barres OF'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">(MFGNUM)</p>

              <input
                ref={hiddenOfRef}
                type="text"
                disabled={loadingOf}
                className="opacity-0 absolute inset-0 pointer-events-none"
                value={ofInput}
                onChange={(e) => {
                  setOfInput(e.target.value);
                  if (e.target.value.length >= 8) {
                    const code = e.target.value;
                    setOfInput('');
                    handleValidateOf(code);
                  }
                }}
              />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Numéro OF"
                disabled={loadingOf}
                value={ofInput}
                onChange={(e) => setOfInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && ofInput) {
                    const code = ofInput;
                    setOfInput('');
                    handleValidateOf(code);
                  }
                }}
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
              />
              <button
                disabled={loadingOf || !ofInput}
                onClick={() => { const code = ofInput; setOfInput(''); handleValidateOf(code); }}
                className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
              >
                Valider
              </button>
            </div>

            {errorOf && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {errorOf}
              </div>
            )}

            {confirmedOf && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-950 space-y-2 animate-fade-in">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg text-emerald-900">{confirmedOf.mfgnum}</span>
                  <span className="bg-emerald-600 text-white text-xs px-2.5 py-0.5 rounded-full font-semibold">
                    {confirmedOf.statut}
                  </span>
                </div>
                <div className="text-xs space-y-1 text-emerald-800">
                  <p><span className="font-medium">Article :</span> {confirmedOf.itmref}</p>
                  <p><span className="font-medium">Désignation :</span> {confirmedOf.designation}</p>
                  <div className="flex justify-between pt-1 text-emerald-900 font-medium">
                    <span>Qté: {confirmedOf.quantite.toLocaleString()} unités</span>
                    <span>Date fin: {confirmedOf.dateFin}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ÉTAPE 2 — OPÉRATION */}
          <div className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col space-y-4 ${!confirmedOf ? 'opacity-50 pointer-events-none' : ''}`}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Étape 2 — Opération
            </h2>

            <div 
              onClick={() => confirmedOf && !loadingOp && hiddenOpRef.current?.focus()}
              className={`border-2 border-dashed rounded-lg p-6 bg-blue-50/50 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-50 transition-colors relative ${
                errorOp ? 'border-red-400' : 'border-blue-400'
              }`}
            >
              <svg className="w-8 h-8 text-blue-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <p className="text-sm font-medium text-slate-700">
                {loadingOp ? 'Recherche en cours...' : 'Scanner code-barres opération'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">format MFGNUM-OPENUM</p>

              <input
                ref={hiddenOpRef}
                type="text"
                disabled={!confirmedOf || loadingOp}
                className="opacity-0 absolute inset-0 pointer-events-none"
                value={opInput}
                onChange={(e) => {
                  setOpInput(e.target.value);
                  if (e.target.value.length >= 4) {
                    const code = e.target.value;
                    setOpInput('');
                    handleValidateOp(code);
                  }
                }}
              />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                disabled={!confirmedOf || loadingOp}
                placeholder="Numéro opération"
                value={opInput}
                onChange={(e) => setOpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && opInput) {
                    const code = opInput;
                    setOpInput('');
                    handleValidateOp(code);
                  }
                }}
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
              />
              <button
                disabled={!confirmedOf || loadingOp || !opInput}
                onClick={() => { const code = opInput; setOpInput(''); handleValidateOp(code); }}
                className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
              >
                Valider
              </button>
            </div>

            {errorOp && !refusZone && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {errorOp}
              </div>
            )}

            {refusZone && errorOp && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-1">
                <p className="text-sm font-bold text-amber-900">
                  Opération hors de vos zones
                </p>
                <p className="text-sm text-amber-800">{errorOp}</p>
                <p className="text-xs text-amber-700 pt-1">
                  Scannez une opération de vos postes, ou demandez à votre chef de
                  section de vous rattacher à celui-ci.
                </p>
              </div>
            )}

            {confirmedOp && (
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 text-sky-950 space-y-2 animate-fade-in">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg text-sky-900">{confirmedOp.openum}</span>
                </div>
                <div className="text-xs space-y-1 text-sky-800">
                  <p><span className="font-medium">Désignation :</span> {confirmedOp.designation}</p>
                  <p><span className="font-medium">Poste (WSTREF) :</span> {confirmedOp.wstref}</p>
                  <p><span className="font-medium">Tps théorique :</span> {confirmedOp.tempsTheorique}</p>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Bouton Démarrer le pointage */}
        <div className="mt-8 pt-4">
          {errorStart && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {errorStart}
            </div>
          )}
          <button
            onClick={handleStartPointage}
            disabled={!(confirmedOf && confirmedOp) || loadingStart}
            style={{
              backgroundColor: confirmedOf && confirmedOp && !loadingStart ? '#1F4E79' : '#94A3B8',
            }}
            className="w-full py-4 text-white text-base font-bold rounded-xl shadow-lg transition-all duration-200 active:scale-[0.99] disabled:cursor-not-allowed uppercase tracking-wider"
          >
            {loadingStart ? 'Démarrage en cours...' : 'Démarrer le pointage'}
          </button>
        </div>
      </main>
    </div>
  );
};