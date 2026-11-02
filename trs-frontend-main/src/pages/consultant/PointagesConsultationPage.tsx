import React from 'react';
import { useLivePointages } from './useLivePointages';
import { Activity, Clock } from 'lucide-react';

const motifLabels: Record<string, string> = {
  Panne: 'Panne',
  ManqueMatiere: 'Manque de matière',
  Pause: 'Pause',
  Reglage: 'Réglage',
  Autre: 'Autre',
};

function formatMotif(motif?: string | null): string {
  if (!motif) return '';
  return motifLabels[motif] ?? motif;
}

export const PointagesConsultationPage: React.FC = () => {
  const { pointages, loading, isConnected, error } = useLivePointages();

  if (loading) return <div className="p-6">Chargement du suivi en direct...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Activity className={`text-emerald-500 ${isConnected ? 'animate-pulse' : ''}`} />
          Pointages en temps réel
        </h1>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
          {isConnected ? '● En direct (SignalR)' : '○ Hors ligne'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pointages.map((p) => (
          <div key={p.pointageId} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-slate-800">{p.operatorNom}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{p.mfgnum} — {p.openum}</p>
              </div>
              <span className="text-xs font-mono bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded">
                {p.wstref}
              </span>
            </div>

            <p className="text-xs text-slate-600 mt-2">{p.opeDesignation}</p>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Clock size={12} /> Début: {new Date(p.heureDebut).toLocaleTimeString()}
              </span>
              <div className="flex flex-col items-end gap-1">
                
                {p.statut === 'PAUSE' && p.motif && (
                  <span className="text-[10px] text-amber-600 font-medium">
                    {formatMotif(p.motif)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};