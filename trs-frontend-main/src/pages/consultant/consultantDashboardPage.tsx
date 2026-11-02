import { useEffect, useMemo, useState } from 'react';
import { getPointages } from '../../api/consultantApi';

import { Clock, CheckCircle, TrendingUp, Search, Timer, Download, ChevronDown } from 'lucide-react';
import { exportToExcel, exportToPdf } from './utils/exportPointages';

const formatHhMM = (totalMinutes: number): string => {
  const safe = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h${m < 10 ? '0' : ''}${m}`;
};

// Hauteur utile des barres du graphique, en pixels.
const HAUTEUR_GRAPHIQUE = 130;

// Affichage d'un taux : une décimale tant qu'il reste dans des ordres de grandeur
// normaux, aucune au-delà — « 1 944 % » se lit mieux que « 1944.32 % ».
const formaterTaux = (taux: number): string => {
  const decimales = Math.abs(taux) < 1000 ? 1 : 0;
  return `${taux.toLocaleString('fr-FR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })} %`;
};

const NOMS_MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

type Recence = 'actif' | 'recent' | 'aujourdhui' | 'semaine' | 'ancien';

function getRecence(ligne: { finRaw?: string; statut: string }): Recence {
  if (ligne.statut === 'Actif') return 'actif';
  if (!ligne.finRaw) return 'ancien';
  const fin = new Date(ligne.finRaw);
  const now = new Date();
  const diffMs = now.getTime() - fin.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffHours < 2) return 'recent';
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (fin >= startOfToday) return 'aujourdhui';
  if (diffDays <= 7) return 'semaine';
  return 'ancien';
}

function formatTempsRelatif(finRaw?: string, statut?: string): string {
  if (statut === 'Actif') return 'En cours';
  if (!finRaw) return '-';
  const fin = new Date(finRaw);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - fin.getTime()) / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} j`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`;
  return fin.toLocaleDateString('fr-FR');
}

function recenceLabel(r: Recence): string {
  if (r === 'ancien') return 'Ancien';
  return 'Récent';
}

function recenceColor(r: Recence): string {
  if (r === 'ancien') return 'bg-slate-100 text-slate-500';
  return 'bg-green-100 text-green-700';
}

function formatStatutLabel(statut: string): string {
  if (statut === 'Termine') return 'Terminer';
  return statut;
}

interface LignePointage {
  id: number;
  // Identifiant de la session de travail. Plusieurs lignes le partagent quand
  // l'operateur a mis son pointage en pause : chaque reprise cree un segment.
  sessionId?: string;
  of: string;
  operation: string;
  poste: string;
  operateur: string;
  debut: string;
  debutRaw: string;
  fin: string;
  finRaw?: string;
  dureeMin: number;
  tpsTheoMin: number;
  statut: string;
}

interface ConsultantDashboardPageProps {
  onVoirPlus?: () => void;
}

export function ConsultantDashboardPage({ onVoirPlus }: ConsultantDashboardPageProps) {
  const [lignes, setLignes] = useState<LignePointage[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [selectedOF, setSelectedOF] = useState('Tous');
  const [recherche, setRecherche] = useState('');

  // Sélection de la période : année, mois et jour, positionnés par défaut sur
  // la date du jour. Chacun accepte « Tous » pour élargir la vue.
  const [annee, setAnnee] = useState<number | 'Tous'>(new Date().getFullYear());
  const [mois, setMois] = useState<number | 'Tous'>(new Date().getMonth());
  const [jour, setJour] = useState<number | 'Tous'>(new Date().getDate());

  // Jour dont on affiche le détail, sélectionné en cliquant une barre du graphique.
  const [jourDetail, setJourDetail] = useState<string | null>(null);

// Plage de donnees a charger, deduite des selecteurs.
//
// Le tableau de bord chargeait toute la table puis filtrait dans le
// navigateur : a 460 octets par ligne et environ 20 000 lignes par an, cela
// faisait 9 Mo apres un an et 26 Mo apres trois. On ne demande desormais que
// la periode affichee.
//
// Le mois est elargi d'une semaine de part et d'autre : le graphique presente
// la semaine calendaire du jour choisi, qui deborde sur le mois voisin quand ce
// jour tombe en debut ou en fin de mois.
function plageAChager(
  annee: number | 'Tous',
  mois: number | 'Tous'
): { debut?: Date; fin?: Date } {
  // « Toutes les annees » est un choix explicite de l'utilisateur : on lui
  // renvoie bien tout l'historique.
  if (annee === 'Tous') return {};

  if (mois === 'Tous') {
    return { debut: new Date(annee, 0, 1), fin: new Date(annee, 11, 31, 23, 59, 59) };
  }

  const debut = new Date(annee, mois, 1);
  debut.setDate(debut.getDate() - 7);

  const fin = new Date(annee, mois + 1, 0, 23, 59, 59);
  fin.setDate(fin.getDate() + 7);

  return { debut, fin };
}

useEffect(() => {
  async function charger() {
    setChargement(true);
    try {
      const { debut, fin } = plageAChager(annee, mois);
      const pointages = await getPointages(debut, fin);

      const enriched: LignePointage[] = pointages.map((p) => ({
        id: p.pointageId,
        sessionId: p.sessionId,
        of: p.mfgnum ?? '-',
        operation: p.opeDesignation ?? p.openum ?? '-',
        poste: p.wstDesignation ?? p.wstref ?? '-',
        operateur: p.operatorNom ?? '-',
        debut: new Date(p.heureDebut).toLocaleString('fr-FR'),
        debutRaw: p.heureDebut,
        fin: p.heureFin ? new Date(p.heureFin).toLocaleString('fr-FR') : '-',
        finRaw: p.heureFin ?? undefined,
        dureeMin: Number(Number(p.dureeMinutes ?? 0).toFixed(2)),
        tpsTheoMin: Number(Number(p.tempsTheoriqueMinutes ?? 0).toFixed(2)),
        statut: p.statut,
      }));

      setLignes(enriched);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setChargement(false);
    }
  }
  charger();
  // Le jour n'y figure pas : il filtre a l'interieur du mois deja charge,
  // inutile de rappeler l'API a chaque changement de jour.
}, [annee, mois]);

  const uniqueOFs = useMemo(() => {
    const ofs = Array.from(new Set(lignes.map((l) => l.of).filter((o) => o !== '-')));
    return ['Tous', ...ofs];
  }, [lignes]);

  // Années réellement présentes dans les données, plus l'année courante.
  const anneesDisponibles = useMemo(() => {
    const set = new Set<number>();
    for (const l of lignes) {
      const d = new Date(l.debutRaw);
      if (!isNaN(d.getTime())) set.add(d.getFullYear());
    }
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [lignes]);

  // Nombre de jours du mois sélectionné, pour ne pas proposer un 31 février.
  const nbJoursDuMois = useMemo(() => {
    if (annee === 'Tous' || mois === 'Tous') return 31;
    return new Date(annee, mois + 1, 0).getDate();
  }, [annee, mois]);

  // Si l'on passe d'un mois long à un mois court, on ramène le jour dans les bornes.
  useEffect(() => {
    if (jour !== 'Tous' && jour > nbJoursDuMois) setJour(nbJoursDuMois);
  }, [nbJoursDuMois, jour]);

  // Fermeture au clavier du détail de journée.
  useEffect(() => {
    if (!jourDetail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setJourDetail(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jourDetail]);

  // Clé de regroupement par jour, en heure locale. Important : le filtrage et le
  // graphique doivent utiliser le même référentiel, sinon un pointage de début de
  // nuit bascule d'un jour à l'autre entre les deux.
  const cleJour = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;

  // Filtres indépendants de la date : sert au graphique, qui doit montrer
  // l'activité de la semaine même lorsqu'un seul jour est sélectionné.
  const filtreesSansDate = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return lignes
      .filter((l) => l.statut === 'Termine')
      .filter((l) => {
        if (selectedOF !== 'Tous' && l.of !== selectedOF) return false;
        if (q) {
          const texte = `${l.of} ${l.operation} ${l.poste} ${l.operateur}`.toLowerCase();
          if (!texte.includes(q)) return false;
        }
        return true;
      });
  }, [lignes, selectedOF, recherche]);

  const filtrees = useMemo(() => {
    return filtreesSansDate
      .filter((l) => {
        const d = new Date(l.debutRaw);
        if (isNaN(d.getTime())) return false;
        if (annee !== 'Tous' && d.getFullYear() !== annee) return false;
        if (mois !== 'Tous' && d.getMonth() !== mois) return false;
        if (jour !== 'Tous' && d.getDate() !== jour) return false;
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.finRaw ?? a.debutRaw).getTime();
        const dateB = new Date(b.finRaw ?? b.debutRaw).getTime();
        return dateB - dateA;
      });
  }, [filtreesSansDate, annee, mois, jour]);

  // Libellé lisible de la période retenue, affiché sous les sélecteurs.
  const libellePeriode = useMemo(() => {
    if (annee === 'Tous' && mois === 'Tous' && jour === 'Tous') return 'toutes périodes';
    const mm = mois === 'Tous' ? null : NOMS_MOIS[mois];
    if (jour !== 'Tous' && mm && annee !== 'Tous') return `${jour} ${mm} ${annee}`;
    if (mm && annee !== 'Tous') return `${mm} ${annee}`;
    if (annee !== 'Tous' && !mm && jour === 'Tous') return `année ${annee}`;
    const morceaux = [
      jour === 'Tous' ? null : `jour ${jour}`,
      mm,
      annee === 'Tous' ? null : String(annee),
    ].filter(Boolean);
    return morceaux.join(' · ');
  }, [annee, mois, jour]);

  // Somme des temps théoriques sans double compte.
  //
  // Une ligne du tableau est un *segment* de pointage, pas une opération : dès que
  // l'opérateur met son travail en pause, la reprise crée un second segment qui
  // porte le même temps théorique de gamme. Additionner naïvement toutes les
  // lignes compte donc ce temps deux, trois fois — autant de fois qu'il y a eu de
  // pauses — alors que les durées réelles, elles, se cumulent correctement. Le
  // temps théorique n'est retenu qu'une fois par session de travail.
  function sommeTheoriqueParSession(lignes: LignePointage[]): number {
    const parSession = new Map<string, number>();
    let sansSession = 0;
    for (const l of lignes) {
      if (l.sessionId) parSession.set(l.sessionId, l.tpsTheoMin);
      else sansSession += l.tpsTheoMin; // pointage antérieur au suivi par session
    }
    let total = sansSession;
    for (const valeur of parSession.values()) total += valeur;
    return total;
  }

  // 🟢 KPIs mis à jour avec précision à 2 décimales
  const kpis = useMemo(() => {
    const totalOps = filtrees.length;
    const totalReel = Number(filtrees.reduce((s, l) => s + l.dureeMin, 0).toFixed(2));
    const totalTheo = Number(sommeTheoriqueParSession(filtrees).toFixed(2));

    // Taux de performance, au sens de la composante « Performance » du TRS :
    //   somme des temps théoriques / somme des temps réels.
    //
    // On ne fait surtout pas la moyenne des ratios opération par opération : une
    // opération d'une minute pèserait alors autant qu'une opération de dix heures,
    // et un seul ratio aberrant suffit à faire exploser le résultat. Le rapport des
    // totaux est pondéré par les durées, donc robuste.
    //
    // Un taux supérieur à 100 % n'est pas un bug : il signale que les temps
    // théoriques de la gamme sont supérieurs aux temps réellement mesurés — donc
    // des standards à revoir. La carte le signale explicitement.
    const baseCalcul = filtrees.filter((l) => l.dureeMin > 0 && l.tpsTheoMin > 0);
    const reelBase = baseCalcul.reduce((s, l) => s + l.dureeMin, 0);
    const theoBase = sommeTheoriqueParSession(baseCalcul);

    const efficacite = reelBase > 0 && theoBase > 0 ? (theoBase / reelBase) * 100 : null;

    const recents = filtrees.filter((l) => getRecence(l) !== 'ancien').length;
    const anciens = filtrees.filter((l) => getRecence(l) === 'ancien').length;
    return { totalOps, totalReel, totalTheo, efficacite, recents, anciens };
  }, [filtrees]);

  const operationsRecentes = useMemo(() => {
    return [...filtrees]
      .filter((l) => l.finRaw)
      .sort((a, b) => new Date(b.finRaw!).getTime() - new Date(a.finRaw!).getTime())
      .slice(0, 8);
  }, [filtrees]);

  // Semaine calendaire — du lundi au dimanche — contenant la date choisie.
  // Le jour sélectionné garde ainsi sa place réelle dans la semaine, au lieu
  // d'être systématiquement poussé à droite du graphique.
  const graphiqueSemaine = useMemo(() => {
    const maintenant = new Date();

    // Date de référence : le jour choisi ; à défaut la fin du mois retenu si elle
    // est passée ; à défaut aujourd'hui.
    let ancre = maintenant;
    if (annee !== 'Tous' && mois !== 'Tous') {
      if (jour !== 'Tous') {
        ancre = new Date(annee, mois, jour);
      } else {
        const finDeMois = new Date(annee, mois + 1, 0);
        ancre = finDeMois < maintenant ? finDeMois : maintenant;
      }
    }

    // Lundi de cette semaine (getDay() renvoie 0 pour dimanche).
    const lundi = new Date(ancre.getFullYear(), ancre.getMonth(), ancre.getDate());
    lundi.setDate(lundi.getDate() - ((ancre.getDay() + 6) % 7));

    const cleSelection =
      annee !== 'Tous' && mois !== 'Tous' && jour !== 'Tous'
        ? cleJour(new Date(annee, mois, jour))
        : null;

    const jours: {
      label: string; count: number; key: string; selectionne: boolean;
    }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(lundi);
      d.setDate(lundi.getDate() + i);
      const cle = cleJour(d);
      jours.push({
        key: cle,
        label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
        count: 0,
        selectionne: cle === cleSelection,
      });
    }

    // On compte sur les données non filtrées par date : sinon, sélectionner un
    // jour viderait les six autres barres et donnerait une lecture trompeuse.
    for (const l of filtreesSansDate) {
      const d = new Date(l.debutRaw);
      if (isNaN(d.getTime())) continue;
      const cible = jours.find((j) => j.key === cleJour(d));
      if (cible) cible.count++;
    }

    const max = Math.max(...jours.map((j) => j.count), 1);
    const dimanche = new Date(lundi);
    dimanche.setDate(lundi.getDate() + 6);

    const memeMois = lundi.getMonth() === dimanche.getMonth();
    const libelle = memeMois
      ? `du ${lundi.getDate()} au ${dimanche.toLocaleDateString('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric' })}`
      : `du ${lundi.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ` +
        `${dimanche.toLocaleDateString('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric' })}`;

    return { jours: jours.map((j) => ({ ...j, max })), libelle };
  }, [filtreesSansDate, annee, mois, jour]);

  // Opérations du jour ouvert depuis le graphique. On repart des données non
  // filtrées par date, comme le graphique lui-même, pour rester cohérent.
  const operationsJourDetail = useMemo(() => {
    if (!jourDetail) return [];
    return filtreesSansDate
      .filter((l) => {
        const d = new Date(l.debutRaw);
        return !isNaN(d.getTime()) && cleJour(d) === jourDetail;
      })
      .sort((a, b) => new Date(a.debutRaw).getTime() - new Date(b.debutRaw).getTime());
  }, [filtreesSansDate, jourDetail]);

  const libelleJourDetail = useMemo(() => {
    if (!jourDetail) return '';
    const [a, m, j] = jourDetail.split('-').map(Number);
    return new Date(a, m - 1, j).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }, [jourDetail]);

  const exportRows = filtrees.map((l) => ({
    OF: l.of,
    Operation: l.operation,
    Poste: l.poste,
    Operateur: l.operateur,
    Debut: l.debut,
    Fin: l.fin,
    Quand: formatTempsRelatif(l.finRaw, l.statut),
    Periode: recenceLabel(getRecence(l)),
    'Duree (min)': l.dureeMin.toFixed(2),
    'Tps theo (min)': l.tpsTheoMin.toFixed(2),
    Statut: formatStatutLabel(l.statut),
  }));

  const dateExport = new Date().toISOString().slice(0, 10);

  const statutColor = (statut: string) => {
    if (statut === 'Termine') return 'bg-sky-100 text-sky-700';
    return 'bg-slate-100 text-slate-600';
  };

  if (chargement) return <p className="text-center py-20 text-slate-500">Chargement...</p>;
  if (erreur) return <p className="m-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{erreur}</p>;

  return (
    <div className="p-6 space-y-6">
      {/* Barre de Recherche et Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher OF, opérateur, poste..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg bg-white shadow-sm w-64"
          />
        </div>
        <select
          value={selectedOF}
          onChange={(e) => setSelectedOF(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white shadow-sm"
        >
          {uniqueOFs.map((of) => (
            <option key={of} value={of}>
              {of === 'Tous' ? 'Tous les OF' : of}
            </option>
          ))}
        </select>
      </div>

      {/* Sélection de la période : année, mois, jour.
          Positionnés sur la date du jour à l'ouverture ; chacun se déroule pour
          consulter une autre période. « Toutes » élargit le niveau correspondant. */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm block cursor-pointer hover:border-sky-400 transition-colors">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Année
            </span>
            <div className="relative mt-1">
              <select
                value={String(annee)}
                onChange={(e) =>
                  setAnnee(e.target.value === 'Tous' ? 'Tous' : Number(e.target.value))
                }
                className="appearance-none w-full bg-transparent text-2xl font-bold text-slate-800 cursor-pointer focus:outline-none pr-7"
              >
                <option value="Tous">Toutes</option>
                {anneesDisponibles.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={18}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </label>

          <label className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm block cursor-pointer hover:border-sky-400 transition-colors">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Mois
            </span>
            <div className="relative mt-1">
              <select
                value={String(mois)}
                onChange={(e) =>
                  setMois(e.target.value === 'Tous' ? 'Tous' : Number(e.target.value))
                }
                className="appearance-none w-full bg-transparent text-2xl font-bold text-slate-800 capitalize cursor-pointer focus:outline-none pr-7"
              >
                <option value="Tous">Tous</option>
                {NOMS_MOIS.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={18}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </label>

          <label className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm block cursor-pointer hover:border-sky-400 transition-colors">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Jour
            </span>
            <div className="relative mt-1">
              <select
                value={String(jour)}
                onChange={(e) =>
                  setJour(e.target.value === 'Tous' ? 'Tous' : Number(e.target.value))
                }
                className="appearance-none w-full bg-transparent text-2xl font-bold text-slate-800 cursor-pointer focus:outline-none pr-7"
              >
                <option value="Tous">Tous</option>
                {Array.from({ length: nbJoursDuMois }, (_, i) => i + 1).map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={18}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <p className="text-sm text-slate-500">
            <span className="font-bold text-slate-800">{filtrees.length}</span> opération
            {filtrees.length > 1 ? 's' : ''} — {libellePeriode}
          </p>
          <button
            onClick={() => {
              const d = new Date();
              setAnnee(d.getFullYear());
              setMois(d.getMonth());
              setJour(d.getDate());
            }}
            className="text-xs font-semibold text-sky-700 hover:text-sky-900 underline underline-offset-2"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => {
              setAnnee('Tous');
              setMois('Tous');
              setJour('Tous');
            }}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 underline underline-offset-2"
          >
            Toutes les dates
          </button>
        </div>
      </div>

      {/* Cartes KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Opérations</p>
            <p className="text-3xl font-extrabold text-slate-800 mt-2">{kpis.totalOps}</p>
            <p className="text-xs text-slate-400 mt-1">
              {kpis.recents} récent(s) · {kpis.anciens} ancien(s)
            </p>
          </div>
          <div className="bg-sky-50 text-sky-600 p-3 rounded-xl">
            <CheckCircle size={22} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Temps réel</p>
            <p className="text-3xl font-extrabold text-slate-800 mt-2">{formatHhMM(kpis.totalReel)}</p>
          </div>
          <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Temps théorique</p>
            <p className="text-3xl font-extrabold text-slate-800 mt-2">{formatHhMM(kpis.totalTheo)}</p>
          </div>
          <div className="bg-violet-50 text-violet-600 p-3 rounded-xl">
            <Timer size={22} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Efficacité</p>
            <p
              className={`text-3xl font-extrabold mt-2 ${
                kpis.efficacite === null
                  ? 'text-slate-400'
                  : kpis.efficacite > 105
                  ? 'text-amber-600'
                  : kpis.efficacite >= 90
                  ? 'text-emerald-600'
                  : 'text-amber-600'
              }`}
            >
              {kpis.efficacite !== null ? formaterTaux(kpis.efficacite) : 'N/A'}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-[15rem]">
              {kpis.efficacite === null
                ? 'Données insuffisantes sur cette période'
                : kpis.efficacite > 105
                ? 'Temps théoriques supérieurs aux temps mesurés : standards à vérifier'
                : 'Temps théorique rapporté au temps réel'}
            </p>
          </div>
          <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
            <TrendingUp size={22} />
          </div>
        </div>
      </div>

      {/* Graphique 7 jours */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">
          Pointages — semaine {graphiqueSemaine.libelle}
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Toute la semaine du jour choisi. Cliquez sur une barre pour voir le détail
          des opérations de cette journée.
        </p>
        <div className="flex items-end justify-between gap-2">
          {graphiqueSemaine.jours.map((j) => {
            const cliquable = j.count > 0;
            // Hauteur calculée en pixels : un pourcentage ne se résout pas ici,
            // la colonne n'ayant pas de hauteur définie, et toutes les barres
            // retombaient sur leur hauteur minimale.
            const hauteur = Math.max(4, Math.round((j.count / j.max) * HAUTEUR_GRAPHIQUE));
            return (
              <button
                key={j.key}
                type="button"
                disabled={!cliquable}
                onClick={() => setJourDetail(j.key)}
                title={
                  cliquable
                    ? `Voir les ${j.count} opération${j.count > 1 ? 's' : ''} de ce jour`
                    : 'Aucune opération ce jour-là'
                }
                className={`flex-1 flex flex-col items-center gap-2 rounded-lg px-1 pt-1 transition-colors ${
                  cliquable ? 'cursor-pointer hover:bg-sky-50' : 'cursor-default'
                } ${j.selectionne ? 'bg-sky-50 ring-1 ring-sky-300' : ''}`}
              >
                <span
                  className={`text-xs font-semibold ${
                    j.selectionne ? 'text-[#1F4E79]' : 'text-slate-600'
                  }`}
                >
                  {j.count}
                </span>
                <div
                  className="w-full flex items-end"
                  style={{ height: HAUTEUR_GRAPHIQUE }}
                >
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      j.selectionne ? 'bg-[#1F4E79]' : cliquable ? 'bg-sky-500' : 'bg-slate-200'
                    }`}
                    style={{ height: hauteur }}
                  />
                </div>
                <span
                  className={`text-[10px] text-center ${
                    j.selectionne ? 'text-slate-700 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {j.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Activité récente */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Activité récente</h2>

        <style>{`
          .activite-scroll::-webkit-scrollbar { width: 8px; }
          .activite-scroll::-webkit-scrollbar-track { background: transparent; }
          .activite-scroll::-webkit-scrollbar-thumb {
            background-color: rgba(31, 78, 121, 0.35);
            border-radius: 9999px;
          }
          .activite-scroll::-webkit-scrollbar-thumb:hover {
            background-color: rgba(31, 78, 121, 0.55);
          }
          .activite-scroll {
            scrollbar-width: thin;
            scrollbar-color: rgba(31, 78, 121, 0.4) transparent;
          }
        `}</style>

        {operationsRecentes.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune opération terminée récemment.</p>
        ) : (
          <div className="activite-scroll space-y-2 max-h-72 overflow-y-auto pr-1">
            {operationsRecentes.map((op) => {
              const r = getRecence(op);
              return (
                <div
                  key={op.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-sky-50/50 border-sky-100"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {op.of} — Op {op.operation}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {op.poste} · {op.operateur} · Fin: {op.fin}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${recenceColor(r)}`}>
                      {recenceLabel(r)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatTempsRelatif(op.finRaw, op.statut)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tableau des Pointages */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Pointages</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {Math.min(filtrees.length, 5)} sur {filtrees.length} affiché(s)
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => exportToExcel(exportRows, `pointages_${dateExport}.xlsx`)}
              className="inline-flex items-center gap-2 text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download size={14} /> Excel (.xlsx)
            </button>
            <button
              onClick={() => exportToPdf(exportRows, `pointages_${dateExport}.pdf`)}
              className="inline-flex items-center gap-2 text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download size={14} /> PDF
            </button>
            {onVoirPlus && (
              <button
                onClick={onVoirPlus}
                className="text-xs text-[#1F4E79] hover:text-[#173D61] font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                Voir plus →
              </button>
            )}
          </div>
        </div>

        {filtrees.length === 0 ? (
          <p className="text-center py-12 text-slate-400 text-sm">Aucun pointage trouvé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-600">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-400 uppercase font-semibold">
                  <th className="py-3 px-5 text-left">OF</th>
                  <th className="py-3 px-5 text-left">Opération</th>
                  <th className="py-3 px-5 text-left">Poste</th>
                  <th className="py-3 px-5 text-left">Opérateur</th>
                  <th className="py-3 px-5 text-left">Début</th>
                  <th className="py-3 px-5 text-left">Fin</th>
                  <th className="py-3 px-5 text-left">Quand</th>
                  <th className="py-3 px-5 text-left">Période</th>
                  <th className="py-3 px-5 text-center">Réel</th>
                  <th className="py-3 px-5 text-center">Théo</th>
                  <th className="py-3 px-5 text-left">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrees.slice(0, 5).map((row) => {
                  const r = getRecence(row);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-5 font-medium text-slate-800">{row.of}</td>
                      <td className="py-3 px-5">{row.operation}</td>
                      <td className="py-3 px-5 text-slate-500">{row.poste}</td>
                      <td className="py-3 px-5">{row.operateur}</td>
                      <td className="py-3 px-5">{row.debut}</td>
                      <td className="py-3 px-5">{row.fin}</td>
                      <td className="py-3 px-5 text-slate-500 whitespace-nowrap">
                        {formatTempsRelatif(row.finRaw, row.statut)}
                      </td>
                      <td className="py-3 px-5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${recenceColor(r)}`}>
                          {recenceLabel(r)}
                        </span>
                      </td>
                      {/* Affichage à 2 décimales pour les valeurs numériques */}
                      <td className="py-3 px-5 text-center font-medium">{row.dureeMin.toFixed(2)}</td>
                      <td className="py-3 px-5 text-center font-medium">{row.tpsTheoMin.toFixed(2)}</td>
                      <td className="py-3 px-5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statutColor(row.statut)}`}>
                          {formatStatutLabel(row.statut)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Détail d'une journée, ouvert en cliquant une barre du graphique */}
      {jourDetail && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          onClick={() => setJourDetail(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="bg-[#1F4E79] text-white px-6 py-4 flex items-start justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-sky-200 font-semibold">
                  Opérations de la journée
                </p>
                <h2 className="text-xl font-bold mt-0.5 capitalize">{libelleJourDetail}</h2>
                <p className="text-sm text-sky-100 mt-0.5">
                  {operationsJourDetail.length} opération
                  {operationsJourDetail.length > 1 ? 's' : ''} terminée
                  {operationsJourDetail.length > 1 ? 's' : ''}
                  {selectedOF !== 'Tous' ? ` · OF ${selectedOF}` : ''}
                  {recherche.trim() ? ` · recherche « ${recherche.trim()} »` : ''}
                </p>
              </div>
              <button
                onClick={() => setJourDetail(null)}
                aria-label="Fermer"
                className="text-white/80 hover:text-white text-2xl leading-none px-2"
              >
                ×
              </button>
            </header>

            <div className="flex-1 overflow-auto p-6">
              {operationsJourDetail.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune opération ce jour-là.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-400 font-semibold uppercase bg-slate-50/50">
                      <th className="py-3 px-3">OF</th>
                      <th className="py-3 px-3">Opération</th>
                      <th className="py-3 px-3">Poste</th>
                      <th className="py-3 px-3">Opérateur</th>
                      <th className="py-3 px-3">Début</th>
                      <th className="py-3 px-3">Fin</th>
                      <th className="py-3 px-3 text-center">Tps réel</th>
                      <th className="py-3 px-3 text-center">Tps théo</th>
                      <th className="py-3 px-3 text-right">Écart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {operationsJourDetail.map((l) => {
                      const ecart = Number((l.dureeMin - l.tpsTheoMin).toFixed(2));
                      const enRetard = ecart > 0;
                      return (
                        <tr key={l.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3 font-medium text-slate-800">{l.of}</td>
                          <td className="py-3 px-3 text-slate-700">{l.operation}</td>
                          <td className="py-3 px-3 text-slate-500 font-mono text-xs">{l.poste}</td>
                          <td className="py-3 px-3 text-slate-700">{l.operateur}</td>
                          <td className="py-3 px-3 text-slate-600">{l.debut}</td>
                          <td className="py-3 px-3 text-slate-600">{l.fin}</td>
                          <td className="py-3 px-3 text-center font-medium">
                            {formatHhMM(l.dureeMin)}
                          </td>
                          <td className="py-3 px-3 text-center font-medium">
                            {formatHhMM(l.tpsTheoMin)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold">
                            <span className={enRetard ? 'text-red-600' : 'text-emerald-600'}>
                              {enRetard ? '+' : ecart < 0 ? '−' : ''}
                              {formatHhMM(Math.abs(ecart))}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <footer className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => {
                  const [a, m, j] = jourDetail.split('-').map(Number);
                  setAnnee(a);
                  setMois(m - 1);
                  setJour(j);
                  setJourDetail(null);
                }}
                className="text-sm font-semibold text-sky-700 hover:text-sky-900 underline underline-offset-2"
              >
                Filtrer tout le tableau de bord sur ce jour
              </button>
              <button
                onClick={() => setJourDetail(null)}
                className="px-4 py-2 rounded-lg bg-[#1F4E79] hover:bg-[#173d61] text-white text-sm font-semibold"
              >
                Fermer
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}