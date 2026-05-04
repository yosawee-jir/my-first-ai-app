import { useState, useEffect } from 'react';
import StatusBadge   from './StatusBadge.jsx';
import ImageLightbox from './ImageLightbox.jsx';
import { getHistory, getAssetCheckouts } from '../services/api.js';

const ACTION_ICON = { 'Created': '➕', 'Updated': '✏️', 'Checked Out': '📤', 'Returned': '↩️' };

function parseMemory(memory) {
  if (!memory || memory === 'N/A') return null;
  try {
    const arr = JSON.parse(memory);
    if (Array.isArray(arr)) return arr;
  } catch {}
  return null;
}

function parseStorage(storage) {
  if (!storage || storage === 'N/A') return null;
  try {
    const arr = JSON.parse(storage);
    if (Array.isArray(arr) && arr.length > 0) return arr;
  } catch {}
  return null;
}

function warrantyStatus(dateStr) {
  if (!dateStr) return null;
  const today  = new Date(); today.setHours(0,0,0,0);
  const expiry = new Date(dateStr);
  const days   = Math.ceil((expiry - today) / 86400000);
  if (days < 0)   return { label: `Expired (${Math.abs(days)}d ago)`,  color: '#dc2626', bg: '#fef2f2', dot: '🔴' };
  if (days <= 30) return { label: `Expiring Soon (${days}d left)`,     color: '#d97706', bg: '#fffbeb', dot: '🟡' };
  return              { label: `Valid (${days}d left)`,                color: '#16a34a', bg: '#f0fdf4', dot: '🟢' };
}

function Row({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

function formatPrice(p) {
  if (p == null || p === '') return null;
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(p);
}

export default function AssetDetailModal({ asset, onEdit, onClose }) {
  const [lightbox,   setLightbox]   = useState(false);
  const [history,    setHistory]    = useState([]);
  const [checkouts,  setCheckouts]  = useState([]);
  const [activeTab,  setActiveTab]  = useState('details');

  useEffect(() => {
    getHistory(asset.id).then(setHistory).catch(() => {});
    getAssetCheckouts(asset.id).then(setCheckouts).catch(() => {});
  }, [asset.id]);

  const ramSlots = parseMemory(asset.memory);
  const diskList = parseStorage(asset.storage);
  const wInfo    = warrantyStatus(asset.warranty_expiry_date);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-wide">
        <div className="modal-header">
          <h3>Asset Details</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Sub-tabs */}
        <div className="detail-tabs">
          {[
            { key: 'details',   label: 'Details'   },
            { key: 'lifecycle', label: 'Lifecycle'  },
            { key: 'history',   label: `History (${history.length})` },
            { key: 'checkouts', label: `Ownership (${checkouts.length})` },
          ].map(t => (
            <button
              key={t.key}
              className={`detail-tab-btn ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="detail-body">
          {/* ── Details tab ─────────────────────────────────────────────── */}
          {activeTab === 'details' && (
            <>
              {asset.photo && (
                <div className="detail-photo-wrap">
                  <img
                    src={`/uploads/${asset.photo}`}
                    alt={asset.name}
                    className="detail-photo clickable"
                    onClick={() => setLightbox(true)}
                    title="Click to enlarge"
                  />
                </div>
              )}
              <div className="detail-grid">
                <div className="detail-section">
                  <div className="detail-section-title">Identity</div>
                  <Row label="Asset Code"   value={asset.asset_code || '—'} />
                  <Row label="Name"         value={asset.name} />
                  <Row label="Brand"        value={asset.brand || '—'} />
                  <Row label="Type"         value={asset.type  || '—'} />
                  <Row label="Model"        value={asset.model || '—'} />
                  <Row label="Serial No."   value={asset.serial_number || '—'} />
                </div>
                <div className="detail-section">
                  <div className="detail-section-title">Status</div>
                  <div className="detail-row">
                    <span className="detail-label">Condition</span>
                    <StatusBadge status={asset.status} />
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Stock</span>
                    <StatusBadge status={asset.stock_status} />
                  </div>
                  {asset.stock_status === 'Checked Out' && asset.assigned_user_name && (
                    <Row label="Assigned To" value={asset.assigned_user_name} />
                  )}
                  <Row label="Operating System" value={asset.os !== 'N/A' ? asset.os : '—'} />
                </div>
                <div className="detail-section">
                  <div className="detail-section-title">RAM</div>
                  {ramSlots ? (
                    ramSlots.map((size, i) => (
                      <Row key={i} label={`Slot ${i + 1}`} value={size === 'N/A' ? 'Empty' : size} />
                    ))
                  ) : (
                    <span className="detail-na">N/A</span>
                  )}
                </div>
                <div className="detail-section">
                  <div className="detail-section-title">Storage</div>
                  {diskList ? (
                    diskList.map((d, i) => (
                      <Row key={i} label={`Disk ${i + 1}`} value={`${d.type} — ${d.size}`} />
                    ))
                  ) : (
                    <span className="detail-na">N/A</span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Lifecycle tab ────────────────────────────────────────────── */}
          {activeTab === 'lifecycle' && (
            <div className="detail-grid">
              <div className="detail-section">
                <div className="detail-section-title">Financial</div>
                <Row label="Purchase Date"  value={asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : '—'} />
                <Row label="Purchase Price" value={formatPrice(asset.purchase_price) || '—'} />
              </div>
              <div className="detail-section">
                <div className="detail-section-title">Warranty</div>
                {asset.warranty_expiry_date ? (
                  <>
                    <Row label="Expiry Date" value={new Date(asset.warranty_expiry_date).toLocaleDateString()} />
                    {wInfo && (
                      <div className="detail-row">
                        <span className="detail-label">Status</span>
                        <span className="warranty-badge-sm" style={{ color: wInfo.color, background: wInfo.bg }}>
                          {wInfo.dot} {wInfo.label}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="detail-na">No warranty data</span>
                )}
              </div>
              <div className="detail-section">
                <div className="detail-section-title">Timestamps</div>
                <Row label="Added"   value={new Date(asset.created_at).toLocaleDateString()} />
                {asset.updated_at !== asset.created_at && (
                  <Row label="Updated" value={new Date(asset.updated_at).toLocaleDateString()} />
                )}
              </div>
            </div>
          )}

          {/* ── History tab ──────────────────────────────────────────────── */}
          {activeTab === 'history' && (
            history.length > 0 ? (
              <div className="detail-history-full">
                {history.map(h => (
                  <div key={h.id} className="detail-history-row">
                    <span className="detail-history-icon">{ACTION_ICON[h.action] ?? '•'}</span>
                    <span className="detail-history-action">{h.action}</span>
                    {h.details && <span className="detail-history-detail">{h.details}</span>}
                    <span className="detail-history-time">{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No activity history.</div>
            )
          )}

          {/* ── Ownership/Checkouts tab ──────────────────────────────────── */}
          {activeTab === 'checkouts' && (
            checkouts.length > 0 ? (
              <div className="table-wrapper" style={{ marginTop: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Staff Name</th>
                      <th>Staff ID</th>
                      <th>Department</th>
                      <th>Purpose</th>
                      <th>Checkout Date</th>
                      <th>Return Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkouts.map(c => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.employee_name || '—'}</strong>
                          {c.user_name && c.user_name !== c.employee_name && (
                            <div className="asset-sub">{c.user_name}</div>
                          )}
                        </td>
                        <td>{c.employee_id || '—'}</td>
                        <td>{c.department  || '—'}</td>
                        <td>{c.purpose     || '—'}</td>
                        <td>{new Date(c.checkout_date).toLocaleDateString()}</td>
                        <td>
                          {c.return_date
                            ? new Date(c.return_date).toLocaleDateString()
                            : <span className="status-badge badge-checkout">Active</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No checkout history.</div>
            )
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          {onEdit && <button className="btn-primary" onClick={onEdit}>✏️ Edit</button>}
        </div>
      </div>

      {lightbox && (
        <ImageLightbox
          src={`/uploads/${asset.photo}`}
          alt={asset.name}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  );
}
