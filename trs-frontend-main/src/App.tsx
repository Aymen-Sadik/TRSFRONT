import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { fetchMesSessionsOuvertes, type SessionOuverteDto } from './api/PointageApi';
import { LoginPage } from './pages/LoginPage';
import { DefinirMotDePassePage } from './pages/DefinirMotDePassePage';
import { ScanOfPage, type OfData, type OperationData } from './pages/ScanOfPage';
import { PointageActifPage } from './pages/PointageActifPage';
import { MesPointagesPage } from './pages/MesPointagesPage';
import { BackOfficeLayout } from './pages/backoffice/BackOfficeLayout';
import { ConsultantLayout } from './pages/consultant/consultantLayout';

import { LivePointageDashboardOp } from './pages/consultant/LivePointageDashboardOp';

import { BoutonDeconnexion } from './components/BoutonDeconnexion';
import { BoutonChangerMotDePasse } from './components/BoutonChangerMotDePasse';

// 1. Import du composant de suivi des pointages en direct
import { LivePointageDashboard } from './pages/consultant/LivePointageDashboard';

// 2. Ajout de 'pointages-actifs' aux étapes de navigation
type NavStep = 'scan' | 'pointage' | 'mes-pointages' | 'backoffice' | 'pointages-actifs';

// Convertit une session renvoyée par le serveur en données d'écran de pointage.
// Le chronomètre est reconstitué à partir de l'horodatage serveur et du temps déjà
// capitalisé, jamais à partir de l'horloge locale.
function versDonneesPointage(session: SessionOuverteDto) {
  const debut = new Date(session.heureDebut);
  return {
    pointageId: session.pointageId,
    sessionId: session.sessionId,
    mfgnum: session.mfgnum ?? '',
    openum: session.openum ?? '',
    opeDesignation: session.opeDesignation ?? '',
    wstref: session.wstref ?? '',
    wstDesignation: session.wstDesignation ?? 'Poste de travail',
    heureDebut: debut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    startTimestamp: debut.getTime(),
    tempsTheoriqueMinutes: Number(session.tempsTheoriqueMinutes ?? 0),
    article: session.article ?? '',
    quantite: session.quantite ?? 0,
    debutSegmentIso: session.heureDebut,
    tempsAccumuleMinutes: Number(session.tempsAccumulePriorMinutes ?? 0),
    enPause: session.statut === 'Interrompu',
  };
}

function MainRouter() {
  const { utilisateur, token } = useAuth();

  // État de navigation
  const [currentStep, setCurrentStep] = useState<NavStep>('scan');
  const [pointageData, setPointageData] = useState<any>(null);
  // Vrai tant qu'on vérifie auprès du serveur si une session est restée ouverte.
  const [restaurationEnCours, setRestaurationEnCours] = useState<boolean>(true);
  // Toutes les sessions encore ouvertes : l'opérateur peut mener plusieurs OF de front.
  const [sessionsOuvertes, setSessionsOuvertes] = useState<SessionOuverteDto[]>([]);
  const [selecteurOuvert, setSelecteurOuvert] = useState<boolean>(false);

  // Recharge la liste des sessions ouvertes (après un démarrage ou une clôture).
  const rafraichirSessions = async () => {
    try {
      setSessionsOuvertes(await fetchMesSessionsOuvertes());
    } catch (err) {
      console.warn('Impossible de rafraîchir les sessions ouvertes :', err);
    }
  };

  // Bascule vers une autre session en cours.
  const ouvrirSession = (session: SessionOuverteDto) => {
    setPointageData(versDonneesPointage(session));
    setCurrentStep('pointage');
    setSelecteurOuvert(false);
  };
  // Ouvre l'écran de pointage à partir d'un sessionId (clic depuis le dashboard live).
const ouvrirSessionParId = async (sessionId: string) => {
  let session = sessionsOuvertes.find((s) => s.sessionId === sessionId);

  // La liste peut être périmée : on la recharge si la session est introuvable.
  if (!session) {
    const sessions = await fetchMesSessionsOuvertes().catch(() => [] as SessionOuverteDto[]);
    setSessionsOuvertes(sessions);
    session = sessions.find((s) => s.sessionId === sessionId);
  }

  if (session) {
    ouvrirSession(session);
  } else {
    console.warn('Session introuvable ou déjà terminée :', sessionId);
  }
};

  // Reprise de session : le pointage vit en base, pas dans le navigateur. À chaque
  // authentification (ou rafraîchissement de page), on demande au serveur si
  // l'opérateur a laissé une session ouverte et, le cas échéant, on rouvre
  // directement l'écran de pointage avec le temps réellement écoulé.
  useEffect(() => {
    let annule = false;

    if (!token) {
      setRestaurationEnCours(false);
      return;
    }

    setRestaurationEnCours(true);
    fetchMesSessionsOuvertes()
      .then((sessions) => {
        if (annule) return;

        setSessionsOuvertes(sessions);
        if (sessions.length === 0) return;

        // Le serveur trie déjà : les pointages qui tournent d'abord, puis les plus
        // récents. On prépare le premier, et on ouvre son écran uniquement s'il
        // tourne réellement — une session en pause est simplement signalée dans la
        // barre de navigation, pour ne pas empêcher d'engager un autre OF.
        const premiere = sessions[0];
        setPointageData(versDonneesPointage(premiere));
        if (premiere.statut === 'Actif') {
          setCurrentStep('pointage');
        }
      })
      .catch((err) => {
        // Un échec de reprise ne doit jamais empêcher l'opérateur de travailler :
        // il retombe simplement sur l'écran de scan.
        console.warn('Reprise de session impossible :', err);
      })
      .finally(() => {
        if (!annule) setRestaurationEnCours(false);
      });

    return () => {
      annule = true;
    };
  }, [token]);

  // Lien de definition de mot de passe : prioritaire sur tout le reste.
  // L'utilisateur arrive ici precisement parce qu'il ne peut pas se connecter,
  // et un titulaire deja connecte qui ouvre son lien doit pouvoir s'en servir.
  const jetonMotDePasse = new URLSearchParams(window.location.search).get('jeton');
  if (jetonMotDePasse) {
    return <DefinirMotDePassePage jeton={jetonMotDePasse} />;
  }

  // Redirection si l'opérateur n'est pas connecté
  if (!utilisateur) {
    return <LoginPage />;
  }

  if (restaurationEnCours) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 font-body">
        <div className="w-10 h-10 border-4 border-slate-300 border-t-[#1F4E79] rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-600 text-sm">Vérification de vos pointages en cours…</p>
      </div>
    );
  }

  // Vérification des droits
  const roleStr = String(utilisateur.role);
  const estConsultant = roleStr === 'Consultant' || roleStr === '4';
  if (estConsultant) {
    return <ConsultantLayout />;
  }

  const estAdminOuResp = 
    roleStr === 'Administrateur' || 
    roleStr === 'ResponsableUsine' || 
    roleStr === '0' || 
    roleStr === '1';

  // 1. Gestionnaire du clic "Démarrer le pointage"
  const handleStartPointage = ({ of, operation, pointage }: { of: OfData; operation: OperationData; pointage?: any }) => {
    const now = new Date();
    const heureDebutStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    
    const rawMinutes = 
      pointage?.tempsTheoriqueMinutes ?? 
      pointage?.TempsTheoriqueMinutes ?? 
      (operation.tempsTheorique ? parseFloat(operation.tempsTheorique) : 0);

    const createdPointageId = pointage?.id ?? pointage?.pointageId;

    // SessionId renvoyé par le backend lors du démarrage
    const sessionId = pointage?.sessionId ?? pointage?.SessionId;

    if (!sessionId) {
      console.warn(
        '⚠️ sessionId manquant dans la réponse de /api/Pointage/demarrer — ' +
        "l'historique des pauses ne pourra pas être chargé pour ce pointage."
      );
    }

    const payload = {
      pointageId: createdPointageId,
      sessionId,
      mfgnum: of.mfgnum,
      openum: operation.openum,
      opeDesignation: operation.designation,
      wstref: operation.wstref?.split(' - ')[0] || operation.wstref,
      wstDesignation: operation.wstref?.split(' - ')[1] || 'Poste de travail',
      heureDebut: heureDebutStr,
      startTimestamp: Date.now(),
      tempsTheoriqueMinutes: Number(rawMinutes),
      article: of.itmref,
      quantite: of.quantite,
    };

    setPointageData(payload);
    setCurrentStep('pointage');
    rafraichirSessions();
  };

  // 2. Gestionnaire du clic "Terminer l'opération"
  const handleTerminerPointage = async (elapsedSeconds: number, motif?: string) => {
    alert(`Pointage terminé ! Durée : ${Math.floor(elapsedSeconds / 60)} min. Motif : ${motif || 'Aucun'}`);
    setPointageData(null);

    const restantes = await fetchMesSessionsOuvertes().catch(() => [] as SessionOuverteDto[]);
    setSessionsOuvertes(restantes);

    const enCours = restantes.find((s) => s.statut === 'Actif');
    if (enCours) {
      setPointageData(versDonneesPointage(enCours));
      setCurrentStep('pointage');
    } else {
      setCurrentStep('mes-pointages');
    }
  };

  // 3. Affichage plein écran du Pointage Actif de l'opérateur connecté.
  if (currentStep === 'pointage' && pointageData) {
    return (
      <PointageActifPage
        key={pointageData.sessionId}
        initialData={pointageData}
        onTerminer={handleTerminerPointage}
        onRetourScan={() => {
          rafraichirSessions();
          setCurrentStep('scan');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-body">
      {/* Barre de navigation globale */}
      <nav className="bg-[#173D61] text-white px-6 py-2.5 flex items-center justify-between border-b border-white/10 shadow-sm">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentStep('scan')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              currentStep === 'scan'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-slate-200'
            }`}
          >
            Scan OF
          </button>

          <button
            onClick={() => setCurrentStep('mes-pointages')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              currentStep === 'mes-pointages'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-slate-200'
            }`}
          >
            Mes pointages
          </button>

          {/* Bouton de suivi en direct : Accessible à l'Admin ET à l'Opérateur */}
          <button
            onClick={() => setCurrentStep('pointages-actifs')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors border border-emerald-400/30 flex items-center gap-2 ${
              currentStep === 'pointages-actifs'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            {estAdminOuResp ? 'Pointages actifs' : 'Mes pointages en direct'}
          </button>

          {estAdminOuResp && (
            <button
              onClick={() => setCurrentStep('backoffice')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors border border-amber-400/40 ${
                currentStep === 'backoffice'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-200'
              }`}
            >
              Back-Office
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Sélecteur de sessions pour basculer rapidement d'un OF à l'autre */}
          {sessionsOuvertes.length > 0 && (
            <div className="relative">
              <button
                onClick={() => {
                  if (!selecteurOuvert) rafraichirSessions();
                  setSelecteurOuvert((ouvert) => !ouvert);
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-full font-bold flex items-center space-x-2 transition shadow-sm"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                <span>
                  {sessionsOuvertes.length === 1
                    ? 'Mon pointage en cours'
                    : `Mes pointages en cours (${sessionsOuvertes.length})`}
                </span>
                <span className="text-[10px]">{selecteurOuvert ? '▲' : '▼'}</span>
              </button>

              {selecteurOuvert && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setSelecteurOuvert(false)}
                  ></div>

                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-20 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                        Pointages ouverts
                      </p>
                    </div>

                    <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {sessionsOuvertes.map((session) => {
                        const actif = session.statut === 'Actif';
                        const courant = pointageData?.sessionId === session.sessionId;
                        return (
                          <li key={session.sessionId}>
                            <button
                              onClick={() => ouvrirSession(session)}
                              className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition ${
                                courant ? 'bg-sky-50' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800 text-sm">
                                  {session.mfgnum || 'OF inconnu'}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    actif
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {actif ? 'En cours' : 'En pause'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Opération {session.openum}
                                {session.opeDesignation ? ` — ${session.opeDesignation}` : ''}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Démarré à{' '}
                                {new Date(session.heureDebut).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                                {courant ? ' · affiché' : ''}
                              </p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}
          <BoutonChangerMotDePasse />
          <BoutonDeconnexion />
        </div>
      </nav>

      {/* Rendu dynamique des vues */}
      <main className="flex-1">
        {currentStep === 'scan' && (
          <ScanOfPage onStartPointage={handleStartPointage} />
        )}

        {currentStep === 'mes-pointages' && (
          <MesPointagesPage />
        )}

        {/* Dashboard de suivi : Transmet la propriété pour restreindre l'affichage si ce n'est pas un admin */}
       {currentStep === 'pointages-actifs' && (
  estAdminOuResp
    ? <LivePointageDashboard estOperateurSeulement={false} />
    : <LivePointageDashboardOp onOuvrirSession={ouvrirSessionParId} />
)}
        {currentStep === 'backoffice' && estAdminOuResp && (
          <BackOfficeLayout />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainRouter />
    </AuthProvider>
  );
}