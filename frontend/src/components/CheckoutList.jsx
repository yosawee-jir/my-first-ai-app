import { useState, useEffect, useCallback } from 'react';
import { getCheckouts, returnAsset } from '../services/api.js';

function buildReceiptHTML(c) {
  const now = new Date().toLocaleString();
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Check-Out Receipt</title>
  <style>
    body{font-family:Arial,sans-serif;max-width:600px;margin:40px auto;color:#333}
    h1{text-align:center;color:#1a237e;border-bottom:2px solid #1a237e;padding-bottom:10px}
    .section{margin:20px 0}.section h2{font-size:13px;text-transform:uppercase;color:#888;margin-bottom:8px}
    table{width:100%;border-collapse:collapse}td{padding:6px 0;font-size:13px}
    td:first-child{font-weight:bold;width:38%;color:#555}
    .sig-row{display:flex;justify-content:space-between;margin-top:50px}
    .sig-box{text-align:center;width:220px}.sig-line{border-top:1px solid #333;padding-top:6px;font-size:12px}
    .footer{text-align:center;margin-top:30px;font-size:11px;color:#aaa}
  </style></head><body>
  <h1>Equipment Check-Out Receipt</h1>
  <div class="section"><h2>Asset Information</h2><table>
    <tr><td>Asset Code</td><td>${c.asset_code||'—'}</td></tr>
    <tr><td>Asset Name</td><td>${c.asset_name||'—'}</td></tr>
    <tr><td>Check-Out Date</td><td>${new Date(c.checkout_date).toLocaleString()}</td></tr>
  </table></div>
  <div class="section"><h2>Borrower Information</h2><table>
    <tr><td>Staff Name</td><td>${c.employee_name||'—'}</td></tr>
    <tr><td>Staff ID</td><td>${c.employee_id||'—'}</td></tr>
    <tr><td>Department</td><td>${c.department||'—'}</td></tr>
    <tr><td>Purpose</td><td>${c.purpose||'—'}</td></tr>
    <tr><td>Notes</td><td>${c.notes||'—'}</td></tr>
  </table></div>
  <div class="sig-row">
    <div class="sig-box"><div class="sig-line">Asset Manager Signature</div></div>
    <div class="sig-box"><div class="sig-line">Borrower Signature</div></div>
  </div>
  <div class="footer">Printed: ${now} — IT Asset Management System</div>
  </body></html>`;
}

export default function CheckoutList({ onRefresh }) {
  const [checkouts, setCheckouts] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setCheckouts(await getCheckouts()); } catch (e) {
      console.error(e);
      setError('Failed to load checkouts. Please try refreshing.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleReturn = async (id, name, equipmentId) => {
    if (!confirm(`Mark "${name}" as returned?`)) return;
    try {
      await returnAsset(id, equipmentId);
      load();
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Return failed. Please try again.');
    }
  };

  const printReceipt = (c) => {
    const win = window.open('', '_blank', 'width=720,height=620');
    win.document.write(buildReceiptHTML(c));
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  };

  return (
    <div className="checkout-list-page">
      <div className="page-header">
        <h2 className="section-title">Active Checkouts</h2>
        <button className="btn-secondary" onClick={load}>↻ Refresh</button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading-row">Loading...</div>
      ) : checkouts.length === 0 ? (
        <div className="empty-state">No assets currently checked out.</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Asset Code</th>
                <th>Staff Name</th>
                <th>Department</th>
                <th>Purpose</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {checkouts.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="asset-name">{c.asset_name}</div>
                    <div className="asset-sub">{[c.brand, c.type].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td><code>{c.asset_code || '—'}</code></td>
                  <td>
                    <div>{c.employee_name}</div>
                    {c.employee_id && <div className="asset-sub">Staff ID: {c.employee_id}</div>}
                  </td>
                  <td>{c.department || '—'}</td>
                  <td>{c.purpose || '—'}</td>
                  <td>{new Date(c.checkout_date).toLocaleDateString()}</td>
                  <td className="actions-cell">
                    <button className="btn-return" onClick={() => handleReturn(c.id, c.asset_name, c.equipment_id)}>↩ Return</button>
                    <button className="btn-action" title="Print Receipt" onClick={() => printReceipt(c)}>🖨️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
