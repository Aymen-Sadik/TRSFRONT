import { useState } from 'react';
import { ConsultantDashboardPage } from './consultantDashboardPage';
import { PointagesConsultationPage } from './PointagesConsultationPage';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, ClipboardList } from 'lucide-react';
import { BoutonChangerMotDePasse } from '../../components/BoutonChangerMotDePasse';

type ConsultantPage = 'dashboard' | 'pointages';

export function ConsultantLayout() {
    const { utilisateur } = useAuth();
    const [page, setPage] = useState<ConsultantPage>('dashboard');

    return (
        <div className= "min-h-screen bg-slate-100 flex flex-col font-body" >
        <header className="bg-[#173D61] text-white px-6 py-3 flex items-center justify-between shadow-sm shrink-0" >
            <h1 className="text-sm font-semibold" >
            { page === 'dashboard' ? 'Tableau de bord' : 'Pointages'
}
</h1>
    <div className="flex items-center gap-3">
        <BoutonChangerMotDePasse />
        <span className="bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white" />
            {utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : 'Consultant'}
        </span>
    </div>
            </header>

            < div className = "flex flex-1 min-h-0" >
                <aside className="w-64 bg-[#1F4E79] text-white flex flex-col shrink-0" >
                    <nav className="p-4 space-y-1" >
                        <button
              onClick={ () => setPage('dashboard') }
className = {`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${page === 'dashboard'
        ? 'bg-white/20 text-white font-medium'
        : 'text-slate-300 hover:bg-white/10'
    }`}
            >
    <LayoutDashboard size={ 18 } />
Dashboard
    </button>
    < button
onClick = {() => setPage('pointages')}
className = {`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${page === 'pointages'
        ? 'bg-white/20 text-white font-medium'
        : 'text-slate-300 hover:bg-white/10'
    }`}
            >
    <ClipboardList size={ 18 } />
Pointages
    </button>
    </nav>

  
    </aside>

    < main className = "flex-1 overflow-auto" >
    { page === 'dashboard' ? (
        <ConsultantDashboardPage onVoirPlus= {() => setPage('pointages')} />
          ) : (
    <PointagesConsultationPage />
)}
</main>
    </div>
    </div>
  );
}