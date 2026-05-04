import { useState, useEffect, useCallback } from 'react';
import Dashboard       from './components/Dashboard.jsx';
import AssetTable      from './components/AssetTable.jsx';
import CheckoutList    from './components/CheckoutList.jsx';
import HistoryTab      from './components/HistoryTab.jsx';
import MasterDataAdmin from './components/MasterDataAdmin.jsx';
import { getStats }    from './services/api.js';
import './App.css';

const TABS = [
  { key: 'dashboard', label: 'Dashboard'        },
  { key: 'assets',    label: 'Assets'            },
  { key: 'checkouts', label: 'Active Checkouts',  badge: true },
  { key: 'history',   label: 'History'           },
  { key: 'admin',     label: 'Admin Settings'    },
];

export default function App() {
  const [tab,   setTab]   = useState('dashboard');
  const [stats, setStats] = useState({
    total: 0, available: 0, checkedOut: 0, ready: 0, broken: 0,
    warrantyExpired: 0, warrantyExpiringSoon: 0,
    byType: [], byBrand: [],
  });

  const loadStats = useCallback(async () => {
    try { setStats(await getStats()); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <span>🖥️</span>
          <span>IT Asset Manager</span>
        </div>
        <nav className="header-nav">
          {TABS.map(t => (
            <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
              {t.label}
              {t.badge && stats.checkedOut > 0 && (
                <span className="nav-badge">{stats.checkedOut}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {tab === 'dashboard' && <Dashboard stats={stats} />}
        {tab === 'assets'    && <AssetTable   onRefresh={loadStats} />}
        {tab === 'checkouts' && <CheckoutList onRefresh={loadStats} />}
        {tab === 'history'   && <HistoryTab />}
        {tab === 'admin'     && <MasterDataAdmin />}
      </main>
    </div>
  );
}
