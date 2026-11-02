import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  terminerPointage,
  interromprePointage,
  reprendrePointage,
  getHistoriqueSession,
  type HistoriqueSessionDto,
} from '../api/PointageApi';

export interface PointageData {
  pointageId: number;
  sessionId: string;
  mfgnum: string;
  openum: string;
  opeDesignation: string;
  wstref: string;
  wstDesignation: string;
  heureDebut: string;
  startTimestamp: number;
  tempsTheoriqueMinutes: number; // TIMTOT (si <= 1 ou décimal, géré automatiquement)
  article: string;
  quantite: number;

  // Champs renseignés uniquement lors d'une reprise de session (après déconnexion
  // ou rafraîchissement de page). Ils permettent de reconstituer le chronomètre à
  // partir des données du serveur plutôt que de l'horloge locale au moment du clic.
  debutSegmentIso?: string;      // HeureDebut du segment courant, en UTC
  tempsAccumuleMinutes?: number; // temps déjà capitalisé sur les segments clôturés
  enPause?: boolean;             // vrai si la session reprise est interrompue
}

interface PointageActifProps {
  initialData?: PointageData;
  onTerminer?: (elapsedSeconds: number, motifInterruption?: string) => void;
  onRetourScan?: () => void;
}

export const PointageActifPage: React.FC<PointageActifProps> = ({
  initialData,
  onTerminer,
  onRetourScan,
}) => {
  const { utilisateur } = useAuth();

  // Temps déjà capitalisé sur les segments clôturés de la session (0 pour un
  // démarrage neuf, > 0 lors d'une reprise après déconnexion).
  const accumuleInitialMs = Math.max(0, (initialData?.tempsAccumuleMinutes ?? 0) * 60_000);

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(
    Math.floor(accumuleInitialMs / 1000),
  );
  const [isPaused, setIsPaused] = useState<boolean>(initialData?.enPause ?? false);
  const [motifInterruption, setMotifInterruption] = useState<string>('');

  const [loadingTerminer, setLoadingTerminer] = useState<boolean>(false);
  const [loadingInterruption, setLoadingInterruption] = useState<boolean>(false);
  const [errorTerminer, setErrorTerminer] = useState<string | null>(null);

  // Le pointageId courant change à chaque reprise (nouveau segment côté backend)
  const currentPointageIdRef = useRef<number | undefined>(initialData?.pointageId);

  // Log des pauses de la session
  const [historique, setHistorique] = useState<HistoriqueSessionDto | null>(null);
  const [loadingHistorique, setLoadingHistorique] = useState<boolean>(false);

  // Origine du chronomètre : on privilégie l'horodatage renvoyé par le serveur
  // (HeureDebut du segment courant) afin que le compteur reste juste après une
  // déconnexion ou un rafraîchissement. L'horodatage local ne sert que de repli
  // lors d'un démarrage classique.
  const startRef = useRef<number>(
    initialData?.debutSegmentIso
      ? new Date(initialData.debutSegmentIso).getTime()
      : (initialData?.startTimestamp ?? Date.now()),
  );
  const accumulatedMsRef = useRef<number>(accumuleInitialMs);

  const rafraichirHistorique = async () => {
    if (!initialData?.sessionId) return;
    try {
      setLoadingHistorique(true);
      const data = await getHistoriqueSession(initialData.sessionId);
      setHistorique(data);
    } catch (err) {
      console.error('Erreur chargement historique des pauses', err);
    } finally {
      setLoadingHistorique(false);
    }
  };

  useEffect(() => {
    rafraichirHistorique();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.sessionId]);

  // Chronomètre en temps réel
  useEffect(() => {
    if (!initialData) return;
    if (isPaused) return;

    const tick = () => {
      const elapsedMs = accumulatedMsRef.current + (Date.now() - startRef.current);
      setElapsedSeconds(Math.floor(elapsedMs / 1000));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isPaused, initialData]);

  // Formattage HH:MM:SS pour le grand chrono
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds]
      .map((v) => (v < 10 ? `0${v}` : v))
      .join(':');
  };

  // Formattage intelligent de durée (ex: "45 sec", "1 min 30 sec", "45 min")
  const formatDuration = (totalSec: number) => {
    const sec = Math.round(totalSec);
    if (sec < 60) return `${sec} sec`;
    const min = Math.floor(sec / 60);
    const restSec = sec % 60;
    return restSec > 0 ? `${min} min ${restSec} sec` : `${min} min`;
  };

  const handleToggleInterruption = async () => {
    const pointageIdCourant = currentPointageIdRef.current;
    if (!pointageIdCourant) {
      setErrorTerminer("L'identifiant du pointage est manquant.");
      return;
    }

    try {
      setLoadingInterruption(true);
      setErrorTerminer(null);

      if (!isPaused) {
        await interromprePointage(pointageIdCourant, motifInterruption || 'Pause');
        accumulatedMsRef.current += Date.now() - startRef.current;
        setIsPaused(true);
      } else {
        const nouveauSegment = await reprendrePointage(pointageIdCourant);
        currentPointageIdRef.current = nouveauSegment.id; // suivre le nouveau segment
        startRef.current = Date.now();
        setIsPaused(false);
      }

      await rafraichirHistorique(); // log à jour après chaque action
    } catch (err: any) {
      setErrorTerminer(err?.message ?? "Erreur lors du changement de statut.");
    } finally {
      setLoadingInterruption(false);
    }
  };

  const handleTerminer = async () => {
    const pointageIdCourant = currentPointageIdRef.current;
    if (!pointageIdCourant) return;

    setLoadingTerminer(true);
    setErrorTerminer(null);
    try {
      await terminerPointage(pointageIdCourant);
      onTerminer?.(elapsedSeconds, motifInterruption);
    } catch (err: any) {
      setErrorTerminer(err?.message ?? 'Impossible de terminer le pointage. Réessayez.');
    } finally {
      setLoadingTerminer(false);
    }
  };

  // Écran d'erreur si aucune donnée reçue
  if (!initialData) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
        <header className="bg-[#1F4E79] text-white px-6 py-3.5 flex items-center justify-between shadow-md">
          <h1 className="text-xl font-bold tracking-wide">Pointage en cours</h1>
        </header>

        <main className="flex-1 max-w-xl w-full mx-auto p-6 flex items-center">
          <div className="w-full bg-white rounded-xl border border-red-200 shadow-sm p-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 text-2xl font-bold">
              !
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              Opération introuvable
            </h2>
            <p className="text-sm text-slate-500">
              Aucune opération correspondante n'a été trouvée en base de données.
              Vérifiez le code scanné (OF-OPENUM) ou réessayez le scan.
            </p>
            {onRetourScan && (
              <button
                onClick={onRetourScan}
                className="w-full py-3 bg-[#1F4E79] hover:bg-[#173d61] text-white font-bold text-sm rounded-lg shadow transition-colors"
              >
                Retour au scan
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }

  const data = initialData;

  // Si tempsTheoriqueMinutes est envoyé sous forme de secondes (ex: 45) ou de minutes décimales (ex: 0.5)
  // On détecte la valeur réelle en secondes :
  const isRawSeconds = data.tempsTheoriqueMinutes > 0 && data.tempsTheoriqueMinutes <= 1;
  const tempsTheoriqueSeconds = isRawSeconds
    ? data.tempsTheoriqueMinutes * 60
    : data.tempsTheoriqueMinutes * 60; // Ajuster ici si votre API envoie déjà des secondes

  const progressPercentage = tempsTheoriqueSeconds > 0
    ? Math.min(Math.round((elapsedSeconds / tempsTheoriqueSeconds) * 100), 100)
    : 0;

  const isOvertime = elapsedSeconds > tempsTheoriqueSeconds;
  const diffSeconds = Math.abs(elapsedSeconds - tempsTheoriqueSeconds);

  const pausesTerminees = historique
    ? historique.segments.filter((s) => s.statut === 'Interrompu')
    : [];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-[#1F4E79] text-white px-6 py-3.5 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold tracking-wide">Pointage en cours</h1>
          {/* Sortie vers le scan : l'opérateur peut engager un autre OF sans perdre
              cette session, qui reste ouverte et accessible depuis la barre de navigation. */}
          {onRetourScan && (
            <button
              onClick={onRetourScan}
              title="Revenir au scan pour engager un autre ordre de fabrication"
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
            >
              ← Scanner un autre OF
            </button>
          )}
        </div>
        <div className="flex items-center space-x-2 bg-white/10 text-white px-3 py-1 rounded-full text-sm font-semibold border border-white/20">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
            }`}
          ></span>
          <span>{isPaused ? '• En pause' : '• En direct'}</span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* COLONNE GAUCHE — Infos OF & Actions */}
          <div className="flex flex-col justify-between space-y-6">
            <div className="bg-sky-50/60 border border-sky-100 rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 border-b border-sky-100 pb-3">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase">OF</p>
                  <p className="font-bold text-slate-800 text-base">{data.mfgnum}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase">Opération</p>
                  <p className="font-bold text-slate-800 text-base">
                    {data.openum} — {data.opeDesignation}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase">Poste de charge</p>
                <p className="font-medium text-slate-700 text-sm">
                  {data.wstref} — {data.wstDesignation}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase">Heure début</p>
                  <p className="font-bold text-slate-800 text-sm">{data.heureDebut}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase">Opérateur</p>
                  <p className="font-bold text-slate-800 text-sm">{utilisateur?.nom || 'User 1'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Motif d'interruption (optionnel)
                </label>
                <select
                  value={motifInterruption}
                  onChange={(e) => setMotifInterruption(e.target.value)}
                  disabled={isPaused}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
                >
                  <option value="">Sélectionner un motif...</option>
                  <option value="Panne">Panne</option>
                  <option value="ManqueMatiere">Manque matière</option>
                  <option value="Pause">Pause</option>
                  <option value="Reglage">Réglage</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>

              {errorTerminer && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                  {errorTerminer}
                </div>
              )}

              <button
                onClick={handleTerminer}
                disabled={loadingTerminer || loadingInterruption}
                className="w-full py-3.5 bg-[#B91C1C] hover:bg-red-800 text-white font-bold text-sm rounded-lg shadow transition-colors flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>■</span>
                <span>{loadingTerminer ? 'Enregistrement...' : "Terminer l'opération"}</span>
              </button>

              <button
                onClick={handleToggleInterruption}
                disabled={loadingTerminer || loadingInterruption}
                className="w-full py-2.5 border border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold text-sm rounded-lg transition-colors flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>❚❚</span>
                <span>
                  {loadingInterruption
                    ? 'Traitement...'
                    : isPaused
                    ? 'Reprendre le pointage'
                    : 'Déclarer une interruption'}
                </span>
              </button>
            </div>
          </div>

          {/* COLONNE DROITE — Chronomètre & Progression */}
          <div className="flex flex-col justify-between space-y-6">
            <div className="flex flex-col items-center justify-center text-center space-y-2 py-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Durée en cours {isPaused && '(En pause)'}
              </span>

              <div className="text-5xl font-extrabold text-[#1F4E79] tracking-tight font-mono">
                {formatTime(elapsedSeconds)}
              </div>

              <div className="w-full max-w-md pt-4 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-500">
                    Temps théorique : {formatDuration(tempsTheoriqueSeconds)}
                  </span>
                  <span className={isOvertime ? 'text-red-600' : 'text-emerald-600'}>
                    {isOvertime
                      ? `▲ ${formatDuration(diffSeconds)} de retard`
                      : `▼ ${formatDuration(diffSeconds)} d'avance`}
                  </span>
                </div>

                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    style={{ width: `${progressPercentage}%` }}
                    className={`h-full transition-all duration-500 ${
                      isOvertime ? 'bg-red-600' : 'bg-emerald-500'
                    }`}
                  ></div>
                </div>

                <p className="text-right text-[11px] text-slate-400">
                  {tempsTheoriqueSeconds > 0
                    ? Math.round((elapsedSeconds / tempsTheoriqueSeconds) * 100)
                    : 0}
                  % du temps théorique écoulé
                </p>
              </div>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-xl p-4">
              <h3 className="text-xs font-bold text-emerald-800 uppercase mb-2">
                Récapitulatif OF
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-slate-500 font-medium">Article</p>
                  <p className="font-bold text-slate-800">{data.article}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Quantité</p>
                  <p className="font-bold text-slate-800">
                    {data.quantite.toLocaleString()} unités
                  </p>
                </div>
              </div>
            </div>

            {/* Journal des interruptions */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-600 uppercase">
                  Historique des pauses
                </h3>
                {historique && historique.nombreInterruptions > 0 && (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    {historique.nombreInterruptions} pause{historique.nombreInterruptions > 1 ? 's' : ''} ·{' '}
                    {formatDuration(historique.tempsTotalArretMinutes * 60)}
                  </span>
                )}
              </div>

              {loadingHistorique && (
                <p className="text-xs text-slate-400">Chargement...</p>
              )}

              {!loadingHistorique && pausesTerminees.length === 0 && (
                <p className="text-xs text-slate-400">Aucune interruption pour l'instant.</p>
              )}

              {!loadingHistorique && pausesTerminees.length > 0 && (
                <ul className="space-y-2 max-h-40 overflow-y-auto">
                  {pausesTerminees.map((s) => (
                    <li
                      key={s.pointageId}
                      className="flex items-center justify-between text-xs border-b border-slate-100 pb-1.5 last:border-0"
                    >
                      <div>
                        <span className="font-semibold text-slate-700">
                          {s.motif ?? 'Pause'}
                        </span>
                        <span className="text-slate-400 ml-2">
                          {new Date(s.heureDebut).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {s.heureFin &&
                            ` → ${new Date(s.heureFin).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`}
                        </span>
                      </div>
                      <span className="font-bold text-slate-600">
                        {s.dureeMinutes != null ? formatDuration(s.dureeMinutes * 60) : 'en cours'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};