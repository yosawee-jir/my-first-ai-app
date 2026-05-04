import { useState, useEffect, useCallback } from 'react';
import { getHistory } from '../services/api.js';

const ACTION_CONFIG = {
  'Created':     { icon: '➕', color: '#2e7d32' },
  'Updated':     { icon: '✏️', color: '#1565c0' },
  'Checked Out': { icon: '📤', color: '#e65100' },
  'Returned':    { icon: '↩️', color: '#6a1b9a' },
};

export default function HistoryTab() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setHistory(await getHistory()); } catch (e) {
      console.error(e);
      setError('Failed to load history. Please try refreshing.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="history-page">
      <div className="page-header">
        <h2 className="section-title">Activity History</h2>
        <button className="btn-secondary" onClick={load}>↻ Refresh</button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading-row">Loading...</div>
      ) : history.length === 0 ? (
        <div className="empty-state">No activity recorded yet.</div>
      ) : (
        <div className="history-list">
          {history.map(h => {
            const cfg = ACTION_CONFIG[h.action] ?? { icon: '•', color: '#999' };
            return (
              <div key={h.id} className="history-item">
                <div className="history-icon" style={{ color: cfg.color }}>{cfg.icon}</div>
                <div className="history-body">
                  <span className="history-action" style={{ color: cfg.color }}>{h.action}</span>
                  <span className="history-asset">
                    &nbsp;—&nbsp;{h.asset_name || `Asset #${h.equipment_id}`}
                    {h.asset_code && <> &nbsp;<code>{h.asset_code}</code></>}
                  </span>
                  {h.details && <div className="history-details">{h.details}</div>}
                </div>
                <div className="history-time">
                  {new Date(h.created_at).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
