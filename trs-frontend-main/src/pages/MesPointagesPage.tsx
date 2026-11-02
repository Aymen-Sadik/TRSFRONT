import React, { useState, useEffect, useMemo } from 'react';
import { getMesPointages, type PointageHistoryDTO } from '../api/PointageApi';
import { useAuth } from '../context/AuthContext';
import { DetailPointageModal } from './DetailPointageModal';

// Fonction pour convertir des minutes décimales (ex: 0.02 => "1s", 15.5 => "15m 30s")
export function formaterDuree(minutesDecimales: number): string {
  if (!minutesDecimales || minutesDecimales <= 0) return "0s";

  const totalSecondes = Math.round(minutesDecimales * 60);

  const heures = Math.floor(totalSecondes / 3600);
  const minutes = Math.floor((totalSecondes % 3600) / 60);
  const secondes = totalSecondes % 60;

  const parties = [];

  if (heures > 0) {
    parties.push(`${heures}h`);
    parties.push(`${minutes.toString().padStart(2, '0')}m`);
  } else if (minutes > 0) {
    parties.push(`${minutes}m`);
    if (secondes > 0) {
      parties.push(`${secondes.toString().padStart(2, '0')}s`);
    }
  } else {
    parties.push(`${secondes}s`);
  }

  return parties.join(' ');
}

// Helper pour afficher les écarts proprement (+1s, -2m 15s, etc.)
function formaterEcart(ecartMinutes: number): string {
  if (ecartMinutes === 0) return "0s";
  const formatted = formaterDuree(Math.abs(ecartMinutes));
  return ecartMinutes > 0 ? `+${formatted}` : `-${formatted}`;
}

// --- Helper Functions ---
const formatHhMM = (totalMinutes: number): string => {
  if (!totalMinutes || totalMinutes <= 0) return '0h00';
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  return `${h}h${m < 10 ? '0' : ''}${m}`;
};

// 🟢 Helper pour convertir n'importe quel format de date backend en objet Date JS valide
const parseDate = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr) return null;
  const formattedStr = dateStr.includes(' ') ? dateStr.replace(' ', 'T') : dateStr;
  const d = new Date(formattedStr);
  return isNaN(d.getTime()) ? null : d;
};

// 🟢 Helper pour afficher uniquement "HH:mm" (ex: "09:48")
const formatTimeOnly = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '-';
  if (/^\d{2}:\d{2}$/.test(dateStr.trim())) return dateStr.trim();
  
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

// 🟢 Safely extract numerical and string values regardless of C# JSON serialization casing
const getSafePoste = (item: any): string => {
  return item.wstref || item.wstRef || item.wstDesignation || item.poste || 'Non renseigné';
};

const getSafeTheoMin = (item: any): number => {
  const val = item.tempsTheoriqueMin ?? item.tempsTheoriqueMinutes ?? item.tempsTheo ?? item.timTot ?? 0;
  return typeof val === 'string' ? parseFloat(val) || 0 : Number(val) || 0;
};

const getSafeReelMin = (item: any): number => {
  const val = item.tempsReelMin ?? item.tempsReelMinutes ?? item.tempsReel ?? 0;
  return typeof val === 'string' ? parseFloat(val) || 0 : Number(val) || 0;
};

export const MesPointagesPage: React.FC = () => {
  const { utilisateur } = useAuth();

  // --- Network & Data States ---
  const [pointages, setPointages] = useState<PointageHistoryDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filter States ---
  const [periode, setPeriode] = useState<string>("Tous");
  const [selectedOF, setSelectedOF] = useState<string>('Tous');

  // Pointage dont on affiche le détail (déroulé des segments et des interruptions).
  const [pointageSelectionne, setPointageSelectionne] = useState<PointageHistoryDTO | null>(null);

  // --- Fetch API Data ---
  useEffect(() => {
    const fetchPointages = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMesPointages();
        console.log('📊 Données reçues depuis la BDD :', data);
        setPointages(data || []);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Erreur lors du chargement des données depuis la base de données.';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchPointages();
  }, []);

  // --- Extract Unique Work Order Numbers (OF) ---
  const uniqueOFs = useMemo(() => {
    const ofs = Array.from(new Set(pointages.map((p) => p.mfgnum).filter(Boolean)));
    return ['Tous', ...ofs];
  }, [pointages]);

  // --- Dynamic Filtering (OF & Period) ---
  const filteredPointages = useMemo(() => {
    const now = new Date();
    
    // Début d'aujourd'hui (00:00:00)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Début de la semaine (Lundi 00:00:00)
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() + diffToMonday);

    return pointages.filter((item) => {
      // 1. Filtre par OF
      if (selectedOF !== 'Tous' && item.mfgnum !== selectedOF) {
        return false;
      }

      // 2. Filtre par Période
      if (periode !== 'Tous') {
        const itemDate = parseDate(item.heureDebut);
        if (!itemDate) return false;

        if (periode === "Aujourd'hui") {
          if (itemDate < startOfToday) return false;
        }

        if (periode === 'Cette semaine') {
          if (itemDate < startOfWeek) return false;
        }
      }

      return true;
    });
  }, [pointages, selectedOF, periode]);

  // --- Calculated KPIs ---
  const kpis = useMemo(() => {
    const totalOps = filteredPointages.length;
    
    const totalReelMin = filteredPointages.reduce(
      (acc, curr) => acc + getSafeReelMin(curr),
      0
    );
    
    const totalTheoMin = filteredPointages.reduce(
      (acc, curr) => acc + getSafeTheoMin(curr),
      0
    );

    // Efficacité = (Temps Théorique / Temps Réel) * 100
    const efficacite =
      totalReelMin > 0 ? Math.round((totalTheoMin / totalReelMin) * 100) : 100;

    return {
      totalOps,
      tempsReelTotal: formatHhMM(totalReelMin),
      tempsTheoTotal: formatHhMM(totalTheoMin),
      efficacite,
    };
  }, [filteredPointages]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <header className="bg-[#1F4E79] text-white px-6 py-3.5 flex items-center justify-between">
          <h1 className="text-lg md:text-xl font-semibold tracking-wide">Mes pointages</h1>
          <div className="flex items-center space-x-3 text-xs md:text-sm">
            <span className="bg-white/20 text-white font-medium px-3 py-1 rounded-full">
              {utilisateur?.nom || 'Opérateur'}
            </span>
          </div>
        </header>

        <div className="p-6 space-y-6">

          {/* Loading & Error States */}
          {loading && (
            <div className="text-center py-12 text-slate-500 font-medium">
              Chargement des données depuis la base de données...
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Filter Controls */}
              <div className="flex flex-wrap items-center gap-4">
                <select
                  value={periode}
                  onChange={(e) => setPeriode(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
                >
                  <option value="Tous">Toutes les dates</option>
                  <option value="Aujourd'hui">Aujourd'hui</option>
                  <option value="Cette semaine">Cette semaine</option>
                </select>

                <select
                  value={selectedOF}
                  onChange={(e) => setSelectedOF(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
                >
                  {uniqueOFs.map((of) => (
                    <option key={of} value={of}>
                      {of === 'Tous' ? 'Tous les OF' : of}
                    </option>
                  ))}
                </select>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-400 uppercase">Opérations réalisées</p>
                  <p className="text-3xl font-extrabold text-slate-800 mt-1">{kpis.totalOps}</p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-400 uppercase">Temps réel total</p>
                  <p className="text-3xl font-extrabold text-slate-800 mt-1">{kpis.tempsReelTotal}</p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-400 uppercase">Temps théorique</p>
                  <p className="text-3xl font-extrabold text-slate-800 mt-1">{kpis.tempsTheoTotal}</p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-400 uppercase">Efficacité</p>
                  <p className={`text-3xl font-extrabold mt-1 ${kpis.efficacite >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {kpis.efficacite}%
                  </p>
                </div>
              </div>

              {/* Data Table */}
              {filteredPointages.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Aucun pointage trouvé pour cette sélection.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-left text-sm text-slate-600 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-400 font-semibold uppercase bg-slate-50/50">
                        <th className="py-3 px-4">OF</th>
                        <th className="py-3 px-4">Opération</th>
                        <th className="py-3 px-4">Poste</th>
                        <th className="py-3 px-4">Début</th>
                        <th className="py-3 px-4">Fin</th>
                        <th className="py-3 px-4 text-center">Tps théo</th>
                        <th className="py-3 px-4 text-center">Tps réel</th>
                        <th className="py-3 px-4 text-right">Écart</th>
                        <th className="py-3 px-4 text-right w-16">Détail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPointages.map((row) => {
                        const poste = getSafePoste(row);
                        const tpsTheo = getSafeTheoMin(row);
                        const tpsReel = getSafeReelMin(row);
                        
                        // Écart (Temps réel - Temps théorique)
                        const ecart = Number((tpsReel - tpsTheo).toFixed(2));
                        const isPositive = ecart > 0;

                        return (
                          <tr
                            key={row.id}
                            onClick={() => setPointageSelectionne(row)}
                            title="Voir le détail de ce pointage"
                            className="hover:bg-sky-50 cursor-pointer transition-colors"
                          >
                            <td className="py-3 px-4 font-medium text-slate-800">{row.mfgnum}</td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-700">{row.openum}</span>
                              <span className="mx-1.5 text-slate-400">—</span>
                              <span>{row.opeDesignation || 'Opération'}</span>
                              {row.nombreInterruptions > 0 && (
                                <span
                                  title={`${row.nombreInterruptions} interruption(s) durant cette session`}
                                  className="ml-2 inline-block bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full align-middle"
                                >
                                  {row.nombreInterruptions} pause
                                  {row.nombreInterruptions > 1 ? 's' : ''}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-500 font-mono text-xs">{poste}</td>
                            <td className="py-3 px-4 text-slate-600">{formatTimeOnly(row.heureDebut)}</td>
                            <td className="py-3 px-4 text-slate-600">{formatTimeOnly(row.heureFin)}</td>
                            <td className="py-3 px-4 text-center font-medium">{formaterDuree(tpsTheo)}</td>
                            <td className="py-3 px-4 text-center font-medium">{formaterDuree(tpsReel)}</td>
                            <td className="py-3 px-4 text-right font-bold">
                              <span className={isPositive ? 'text-red-600' : 'text-emerald-600'}>
                                {formaterEcart(ecart)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-slate-400 font-bold">›</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {pointageSelectionne && (
        <DetailPointageModal
          pointage={pointageSelectionne}
          onFermer={() => setPointageSelectionne(null)}
        />
      )}
    </div>
  );
};