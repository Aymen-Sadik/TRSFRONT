import React, { useEffect, useState, useCallback } from 'react';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { Activity, Clock, User, Cpu, Layers, CheckCircle, PauseCircle, LogOut, AlertTriangle } from 'lucide-react';
import { terminerSessionExpiree } from '../../api/session';
import { HUB_POINTAGE_URL, urlApi } from '../../api/config';

interface PointageDto {
  pointageId: number;
  sessionId: string;
  tempsAccumulePriorMinutes?: number;
  operatorNom: string;
  mfgnum: string;
  openum: string;
  opeDesignation: string;
  wstref: string;
  wstDesignation: string;
  heureDebut: string;
  tempsTheoriqueMinutes: number;
  article: string;
  quantite: number;
  statut: 'EN_POSTE' | 'PAUSE' | 'SORTI';
  motif?: 'Panne' | 'ManqueMatiere' | 'Pause' | 'Reglage' | 'Autre' | string;
}

// 🟢 Helper pour formater le motif de pause
const getMotifDetails = (motif?: string) => {
  switch (motif) {
    case 'Panne':
      return { label: 'Panne machine', badge: 'bg-red-50 text-red-800 border-red-200' };
    case 'ManqueMatiere':
      return { label: 'Manque de matière', badge: 'bg-orange-50 text-orange-800 border-orange-200' };
    case 'Reglage':
      return { label: 'Réglage / Outillage', badge: 'bg-blue-50 text-blue-800 border-blue-200' };
    case 'Pause':
      return { label: 'Pause standard', badge: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'Autre':
    default:
      return { label: motif || 'Autre motif', badge: 'bg-slate-100 text-slate-800 border-slate-200' };
  }
};

// 🟢 Chronomètre synchronisé
const LiveTimer: React.FC<{ heureDebut: string; statut: string; tempsAccumulePriorMinutes?: number }> = ({ 
  heureDebut, 
  statut, 
  tempsAccumulePriorMinutes = 0 
}) => {
  const [elapsed, setElapsed] = useState<string>('00:00');

  useEffect(() => {
    if (!heureDebut || statut !== 'EN_POSTE') return;

    const normalizedHeureDebut = heureDebut.endsWith('Z') || heureDebut.includes('+') || heureDebut.includes('-')
      ? heureDebut 
      : heureDebut + 'Z';

    const calculateTime = () => {
      const start = new Date(normalizedHeureDebut).getTime();
      const now = new Date().getTime();
      let diffMs = now - start;

      if (diffMs < 0) diffMs = 0;

      const currentSegmentSeconds = Math.floor(diffMs / 1000);
      const priorSeconds = Math.floor((tempsAccumulePriorMinutes || 0) * 60);
      const totalSeconds = currentSegmentSeconds + priorSeconds;

      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const formatted = [
        hours > 0 ? String(hours).padStart(2, '0') : null,
        String(minutes).padStart(2, '0'),
        String(seconds).padStart(2, '0')
      ]
        .filter(Boolean)
        .join(':');

      setElapsed(formatted);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [heureDebut, statut, tempsAccumulePriorMinutes]);

  if (statut === 'PAUSE') {
    return (
      <span className="font-mono font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
        En pause
      </span>
    );
  }

  if (statut === 'SORTI') {
    return (
      <span className="font-mono font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded flex items-center gap-1">
        Sorti
      </span>
    );
  }

  return (
    <span className="font-mono font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      {elapsed || '00:00'}
    </span>
  );
};

export const LivePointageDashboard: React.FC = () => {
  const [pointages, setPointages] = useState<PointageDto[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // 🟢 Fonction de chargement des données depuis l'API
  const fetchPointagesActifs = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('trs_token');
      if (!token) return;

      const response = await fetch(urlApi('/api/Pointage/actifs'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Jeton expire : sans ce traitement, le tableau resterait fige sur les
      // dernieres donnees connues, sans que rien ne signale la deconnexion.
      if (response.status === 401) {
        terminerSessionExpiree();
        return;
      }

      if (response.ok) {
        const data: PointageDto[] = await response.json();
        setPointages(data);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des pointages :', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Premier chargement au montage
    
    fetchPointagesActifs();

    // Configuration de SignalR
    const connection: HubConnection = new HubConnectionBuilder()
      .withUrl(HUB_POINTAGE_URL, { 
        accessTokenFactory: () => sessionStorage.getItem('trs_token') || ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    // 🟢 À CHAQUE événement SignalR reçu (Pause, Démarrage, Fin), on réinterroge l'API
    connection.on('PointageMisAJour', () => {
      if (isMounted) {
        fetchPointagesActifs();
      }
    });

    connection.start()
      .then(async () => {
        if (isMounted) setIsConnected(true);
        await connection.invoke('RejoindreDashboard');
      })
      .catch((err) => console.error('Erreur de connexion SignalR :', err));

    connection.onreconnecting(() => { if (isMounted) setIsConnected(false); });
    connection.onreconnected(() => { 
      if (isMounted) {
        setIsConnected(true);
        fetchPointagesActifs(); // Recharger au cas où un événement a été manqué
      }
    });
    connection.onclose(() => { if (isMounted) setIsConnected(false); });

    return () => {
      isMounted = false;
      connection.off('PointageMisAJour');
      connection.stop();
    };
  }, [fetchPointagesActifs]);

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className={`text-emerald-500 ${isConnected ? 'animate-pulse' : ''}`} />
            Suivi des pointages en direct
          </h1>
          <p className="text-xs text-slate-500 mt-1">Vue temps réel des ordres de fabrication et opérateurs actifs</p>
        </div>
        
        <span className={`px-3 py-1 text-xs rounded-full font-semibold border ${
          isConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {isConnected ? '● SignalR Connecté' : '○ Déconnecté'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pointages.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
            En attente de nouveaux pointages actifs...
          </div>
        ) : (
          pointages.map((p) => {
            const motifInfo = getMotifDetails(p.motif);
            return (
              <div key={p.pointageId} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs border border-slate-200">
                        <User size={15} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{p.operatorNom || 'Opérateur inconnu'}</p>
                        <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                          OF : {p.mfgnum}
                        </span>
                      </div>
                    </div>

                    <div>
                      {p.statut === 'EN_POSTE' && <span title="En poste" className="text-emerald-500"><CheckCircle size={22} /></span>}
                      {p.statut === 'PAUSE' && <span title="En pause" className="text-amber-500"><PauseCircle size={22} /></span>}
                      {p.statut === 'SORTI' && <span title="Sorti" className="text-slate-400"><LogOut size={22} /></span>}
                    </div>
                  </div>

                  <div className="mb-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                      📦 <span className="text-slate-900">{p.article}</span> (Qté : <strong className="text-indigo-600">{p.quantite}</strong>)
                    </p>

                    {p.statut === 'PAUSE' && (
                      <div className={`border rounded-lg p-2 text-xs flex items-center gap-1.5 ${motifInfo.badge}`}>
                        <AlertTriangle size={14} className="shrink-0" />
                        <span className="font-semibold">Motif :</span> 
                        <span className="italic">{motifInfo.label}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-slate-600 mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1.5">
                    <div className="font-medium text-slate-700 flex items-center gap-1.5">
                      <Cpu size={13} className="text-slate-400 shrink-0" /> 
                      <span className="truncate">{p.wstref} - {p.wstDesignation}</span>
                    </div>
                    <div className="text-slate-500 flex items-center gap-1.5">
                      <Layers size={13} className="text-slate-400 shrink-0" /> 
                      <span className="truncate">Op. {p.openum} : {p.opeDesignation}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock size={13} /> 
                    <LiveTimer 
                      heureDebut={p.heureDebut} 
                      statut={p.statut} 
                      tempsAccumulePriorMinutes={p.tempsAccumulePriorMinutes} 
                    />
                  </span>

                  
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};