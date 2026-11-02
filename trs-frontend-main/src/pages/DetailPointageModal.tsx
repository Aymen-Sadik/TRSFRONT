import React, { useEffect, useState } from 'react';
import {
  getHistoriqueSession,
  type HistoriqueSessionDto,
  type PointageHistoryDTO,
} from '../api/PointageApi';

// Formatteurs locaux : on évite d'importer ceux de MesPointagesPage, qui rendrait
// l'import circulaire (la page importe ce composant).
function formaterDuree(minutesDecimales: number): string {
  if (!minutesDecimales || minutesDecimales <= 0) return '0s';
  const totalSecondes = Math.round(minutesDecimales * 60);
  const heures = Math.floor(totalSecondes / 3600);
  const minutes = Math.floor((totalSecondes % 3600) / 60);
  const secondes = totalSecondes % 60;
  if (heures > 0) return `${heures}h ${minutes.toString().padStart(2, '0')}m`;
  if (minutes > 0) return secondes > 0 ? `${minutes}m ${secondes}s` : `${minutes}m`;
  return `${secondes}s`;
}

function formaterHeure(valeur: string | null | undefined): string {
  if (!valeur) return '—';
  const d = new Date(valeur.includes(' ') ? valeur.replace(' ', 'T') : valeur);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formaterDateComplete(valeur: string | null | undefined): string {
  if (!valeur) return '—';
  const d = new Date(valeur.includes(' ') ? valeur.replace(' ', 'T') : valeur);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Durée en minutes entre deux horodatages ISO.
function ecartMinutes(debut: string | null, fin: string | null): number {
  if (!debut || !fin) return 0;
  const d = new Date(debut).getTime();
  const f = new Date(fin).getTime();
  if (isNaN(d) || isNaN(f)) return 0;
  return Math.max(0, (f - d) / 60000);
}

interface Props {
  pointage: PointageHistoryDTO;
  onFermer: () => void;
}

export const DetailPointageModal: React.FC<Props> = ({ pointage, onFermer }) => {
  const [historique, setHistorique] = useState<HistoriqueSessionDto | null>(null);
  const [chargement, setChargement] = useState<boolean>(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;

    if (!pointage.sessionId) {
      setChargement(false);
      setErreur("Ce pointage ne porte pas d'identifiant de session : le détail des "
        + 'interruptions ne peut pas être reconstitué.');
      return;
    }

    setChargement(true);
    getHistoriqueSession(pointage.sessionId)
      .then((data) => {
        if (!annule) setHistorique(data);
      })
      .catch((err: any) => {
        if (!annule) setErreur(err?.message ?? 'Impossible de charger le détail de la session.');
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });

    return () => {
      annule = true;
    };
  }, [pointage.sessionId]);

  // Fermeture au clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFermer]);

  const ecart = Number((pointage.tempsReelMin - pointage.tempsTheoriqueMin).toFixed(2));
  const enRetard = ecart > 0;

  // Déroulé complet si le serveur le fournit ; sinon on retombe sur les seules
  // interruptions, pour rester compatible avec une API plus ancienne.
  const evenements =
    historique?.deroule && historique.deroule.length > 0
      ? historique.deroule
      : (historique?.segments ?? []).map((p) => ({ ...p, statut: 'Interruption' }));

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      onClick={onFermer}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <header className="bg-[#1F4E79] text-white px-6 py-4 flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-sky-200 font-semibold">
              Détail du pointage
            </p>
            <h2 className="text-xl font-bold mt-0.5">
              {pointage.mfgnum}
              <span className="mx-2 text-sky-300">·</span>
              <span className="font-semibold">Opération {pointage.openum}</span>
            </h2>
            <p className="text-sm text-sky-100 mt-0.5">
              {pointage.opeDesignation} — poste {pointage.wstref}
            </p>
          </div>
          <button
            onClick={onFermer}
            aria-label="Fermer"
            className="text-white/80 hover:text-white text-2xl leading-none px-2"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Chiffres clés */}
          <section>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">
              {formaterDateComplete(pointage.heureDebut)}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Début', valeur: formaterHeure(pointage.heureDebut) },
                { label: 'Fin', valeur: formaterHeure(pointage.heureFin) },
                { label: 'Temps théorique', valeur: formaterDuree(pointage.tempsTheoriqueMin) },
                { label: 'Temps réel', valeur: formaterDuree(pointage.tempsReelMin) },
              ].map((item) => (
                <div key={item.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[11px] text-slate-400 font-semibold uppercase">{item.label}</p>
                  <p className="text-base font-bold text-slate-800 mt-1">{item.valeur}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Écart et interruptions */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div
              className={`rounded-xl p-4 border ${
                enRetard ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
              }`}
            >
              <p className="text-[11px] font-semibold uppercase text-slate-500">
                Écart au temps théorique
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  enRetard ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {ecart > 0 ? '+' : ecart < 0 ? '−' : ''}
                {formaterDuree(Math.abs(ecart))}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {enRetard ? 'Plus long que prévu' : 'Dans le temps imparti'}
              </p>
            </div>

            <div className="rounded-xl p-4 border border-slate-100 bg-slate-50">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Interruptions</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {historique?.nombreInterruptions ?? pointage.nombreInterruptions ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">pause(s) sur cette session</p>
            </div>

            <div className="rounded-xl p-4 border border-amber-100 bg-amber-50">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Temps d'arrêt</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {formaterDuree(historique?.tempsTotalArretMinutes ?? 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">hors temps de travail</p>
            </div>
          </section>

          {/* Déroulé chronologique de la session : segments de travail et interruptions
              intercalés, tels que le serveur les a ordonnés. */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-700">Déroulé de la session</h3>
              {historique?.tempsTravailMinutes !== undefined && (
                <p className="text-xs text-slate-500">
                  Travail effectif&nbsp;
                  <span className="font-bold text-slate-700">
                    {formaterDuree(historique.tempsTravailMinutes)}
                  </span>
                </p>
              )}
            </div>

            {chargement && (
              <div className="flex items-center space-x-3 text-slate-500 text-sm py-6">
                <span className="w-5 h-5 border-2 border-slate-300 border-t-[#1F4E79] rounded-full animate-spin"></span>
                <span>Chargement du détail…</span>
              </div>
            )}

            {!chargement && erreur && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                {erreur}
              </p>
            )}

            {!chargement && !erreur && evenements.length === 0 && (
              <p className="text-sm text-slate-500">Aucun segment enregistré pour cette session.</p>
            )}

            {!chargement && evenements.length > 0 && (
              <ol className="space-y-2">
                {evenements.map((evenement, index) => {
                  const estTravail = evenement.statut === 'Travail';
                  const enCours = !evenement.heureFin;
                  // Numérotation indépendante pour le travail et pour les arrêts.
                  const rang =
                    evenements.slice(0, index + 1).filter((e) => e.statut === evenement.statut)
                      .length;

                  return (
                    <li
                      key={`${evenement.statut}-${evenement.pointageId}-${index}`}
                      className={`flex items-center rounded-lg px-4 py-3 border ${
                        estTravail
                          ? 'bg-white border-slate-200'
                          : 'bg-amber-50 border-amber-100 ml-6'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center mr-3 shrink-0 ${
                          estTravail ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      >
                        {rang}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-semibold ${
                            estTravail ? 'text-slate-800' : 'text-amber-900'
                          }`}
                        >
                          {estTravail
                            ? 'Travail'
                            : `Interruption — ${evenement.motif || 'motif non précisé'}`}
                        </p>
                        <p
                          className={`text-xs ${
                            estTravail ? 'text-slate-500' : 'text-amber-700/80'
                          }`}
                        >
                          {formaterHeure(evenement.heureDebut)} →{' '}
                          {enCours
                            ? estTravail
                              ? 'en cours'
                              : 'toujours en pause'
                            : formaterHeure(evenement.heureFin)}
                        </p>
                      </div>

                      <span
                        className={`text-sm font-bold ml-3 shrink-0 ${
                          estTravail ? 'text-slate-700' : 'text-amber-800'
                        }`}
                      >
                        {formaterDuree(
                          evenement.dureeMinutes ??
                            ecartMinutes(evenement.heureDebut, evenement.heureFin),
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <footer className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onFermer}
            className="px-4 py-2 rounded-lg bg-[#1F4E79] hover:bg-[#173d61] text-white text-sm font-semibold transition-colors"
          >
            Fermer
          </button>
        </footer>
      </div>
    </div>
  );
};
