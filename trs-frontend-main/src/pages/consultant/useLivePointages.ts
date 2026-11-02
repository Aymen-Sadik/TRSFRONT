import { useState, useEffect } from 'react';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { apiFetch } from '../../api/client'; // adapte le chemin selon l'emplacement réel
import { HUB_POINTAGE_URL } from '../../api/config';

export type PointageLiveDTO = {
  pointageId: number;
  operatorNom?: string;
  mfgnum?: string;
  openum?: string;
  opeDesignation?: string;
  wstref?: string;
  wstDesignation?: string;
  heureDebut: string;
  heureFin?: string | null;
  statut?: string;
  [key: string]: any;
};

const getPointagesEnCours = async (): Promise<PointageLiveDTO[]> => {
  try {
    return await apiFetch<PointageLiveDTO[]>('/api/Pointage/actifs');
  } catch (e) {
    console.warn('getPointagesEnCours failed:', e);
    return [];
  }
};

export function useLivePointages() {
  const [pointages, setPointages] = useState<PointageLiveDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const data = await getPointagesEnCours();
        setPointages(data);
      } catch (err: any) {
        console.error("Erreur de chargement initial des pointages:", err);
        setError("Impossible de charger les pointages initiaux.");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();

    const connection: HubConnection = new HubConnectionBuilder()
      .withUrl(HUB_POINTAGE_URL, {
        accessTokenFactory: () => sessionStorage.getItem('trs_token') || ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    // Le serveur emet « PointageMisAJour », jamais « NouveauPointage » : ce hook
    // ecoutait un evenement inexistant et la page ne se rafraichissait donc
    // jamais apres son chargement initial.
    //
    // On recharge la liste au lieu de la rapiecer a partir du message. Le
    // message decrit un segment, alors que la liste presente des sessions
    // regroupees : les fusionner correctement cote client reviendrait a
    // reimplementer le regroupement que le serveur fait deja.
    connection.on('PointageMisAJour', () => {
      getPointagesEnCours().then(setPointages);
    });

    connection.start()
      .then(() => setIsConnected(true))
      .catch((err) => {
        console.error('Erreur de connexion SignalR :', err);
        setIsConnected(false);
      });

    return () => {
      connection.off('PointageMisAJour');
      connection.stop();
    };
  }, []);

  return { pointages, loading, isConnected, error };
}