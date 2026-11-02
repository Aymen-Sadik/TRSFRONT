import { useState } from 'react';
import { BoutonChangerMotDePasse } from '../../components/BoutonChangerMotDePasse';
import {UsersPage} from './UsersPage';
import {AffectationZonePage} from './AffectationZonePage';
import {JournauxPage} from './JournauxPage';// ou { AffectationZoneSection } si c'est un named export
// Types pour tes onglets
// Onglets reellement implementes. « import » a disparu avec le module CSV,
// abandonne au profit de la lecture directe du referentiel de production.
type TabType = 'utilisateurs' | 'affectation' | 'journaux';

export function BackOfficeLayout() {
  const [activeTab, setActiveTab] = useState<TabType>('utilisateurs');

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* --- SIDEBAR --- */}
      <aside className="w-56 bg-[#1F4E79] text-white p-4 shrink-0">
        <div className="text-xs uppercase tracking-wider text-slate-300 font-semibold mb-4 px-2">
          Navigation
        </div>

        <div className="mb-4 px-1">
          <BoutonChangerMotDePasse />
        </div>
        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab('utilisateurs')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition ${
              activeTab === 'utilisateurs'
                ? 'bg-white/20 text-white font-semibold'
                : 'text-slate-200 hover:bg-white/5'
            }`}
          >
            Utilisateurs
          </button>

          <button
            onClick={() => setActiveTab('affectation')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition ${
              activeTab === 'affectation'
                ? 'bg-white/20 text-white font-semibold'
                : 'text-slate-200 hover:bg-white/5'
            }`}
          >
            Affectation zone
          </button>

          <button
            onClick={() => setActiveTab('journaux')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition ${
              activeTab === 'journaux'
                ? 'bg-white/20 text-white font-semibold'
                : 'text-slate-200 hover:bg-white/5'
            }`}
          >
            Journal des actions
          </button>
        </nav>
      </aside>

      {/* --- CONTENU PRINCIPAL DYNAMIQUE --- */}
      <main className="flex-1 p-6">
        {activeTab === 'utilisateurs' && <UsersPage />}
        {activeTab === 'affectation' && <AffectationZonePage />}
        {activeTab === 'journaux' && <JournauxPage />}
      </main>
    </div>
  );
}