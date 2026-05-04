import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import StatusBadge   from './StatusBadge.jsx';
import AssetForm     from './AssetForm.jsx';
import CheckoutModal from './CheckoutModal.jsx';
import QRModal       from './QRModal.jsx';
import ImageLightbox     from './ImageLightbox.jsx';
import AssetDetailModal  from './AssetDetailModal.jsx';
import { getEquipment, deleteEquipment, getMasterData, createEquipment } from '../services/api.js';
import { sortDropdownOptions } from '../utils/sortOptions.js';

// ── CSV Import helpers ────────────────────────────────────────────────────────
const CSV_HEADER_MAP = {
  'asset code':            'asset_code',
  'serial number':         'serial_number',
  'asset name':            'name',
  'name':                  'name',
  'type':                  'type',
  'brand':                 'brand',
  'model':                 'model',
  'stock status':          'stock_status',
  'condition':             'status',
  'os':                    'os',
  'purchase date':         'purchase_date',
  'purchase price':        'purchase_price',
  'warranty expiry date':  'warranty_expiry_date',
  'assigned user name':    'assigned_user_name',
};

const MANDATORY_CSV_FIELDS = ['asset_code','serial_number','name','type','stock_status','purchase_date'];
const MANDATORY_CSV_LABELS = {
  asset_code:    'Asset Code',
  serial_number: 'Serial Number',
  name:          'Asset Name',
  type:          'Type',
  stock_status:  'Stock Status',
  purchase_date: 'Purchase Date',
};

function parseDateMMDDYYYY(str) {
  if (!str) return '';
  const s = str.trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
}

function downloadErrorLogCSV(errorRows, originalHeaders) {
  const rows = [
    ['Error Reason', ...originalHeaders],
    ...errorRows.map(r => [r.reason, ...originalHeaders.map(h => r.raw[h] ?? '')]),
  ];
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `import_errors_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

function downloadCSVTemplate() {
  const headers = [
    'Asset Code*', 'Serial Number*', 'Asset Name*', 'Type*',
    'Brand', 'Model', 'Stock Status*', 'Condition',
    'OS', 'Purchase Date* (mm/dd/yyyy)', 'Purchase Price',
    'Warranty Expiry Date (mm/dd/yyyy)', 'Assigned User Name',
  ];
  const example = [
    'IT-2024-001', 'SN1234567', 'Dell Laptop Inspiron 15', 'Laptop',
    'Dell', 'Inspiron 15 3000', 'Available', 'Ready',
    'Windows 11', '01/15/2024', '35000',
    '01/15/2027', '',
  ];
  const csv = [headers, example]
    .map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'asset_import_template.csv';
  a.click();
}

function formatMemory(memory) {
  if (!memory || memory === 'N/A') return null;
  try {
    const arr = JSON.parse(memory);
    if (Array.isArray(arr)) {
      const filled = arr.filter(v => v && v !== 'N/A');
      return filled.length ? filled.join(' + ') : null;
    }
  } catch {}
  return memory === 'N/A' ? null : memory;
}

function formatStorage(storage) {
  if (!storage || storage === 'N/A') return null;
  try {
    const arr = JSON.parse(storage);
    if (Array.isArray(arr) && arr.length > 0) return arr.map(d => `${d.type} ${d.size}`).join(', ');
  } catch {}
  return null;
}

const STOCKS   = ['Available', 'Checked Out'];

function warrantyDot(dateStr) {
  if (!dateStr) return null;
  const today  = new Date(); today.setHours(0,0,0,0);
  const expiry = new Date(dateStr);
  const days   = Math.ceil((expiry - today) / 86400000);
  if (days < 0)   return { dot: '🔴', title: `Warranty expired ${Math.abs(days)}d ago` };
  if (days <= 30) return { dot: '🟡', title: `Warranty expiring in ${days}d` };
  return              { dot: '🟢', title: `Warranty valid (${days}d left)` };
}

export default function AssetTable({ onRefresh }) {
  const [assets,   setAssets]  = useState([]);
  const [search,   setSearch]  = useState('');
  const [filters,  setFilters] = useState({ brand: '', type: '', status: '', stock_status: '' });
  const [modal,    setModal]   = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [sortKey,  setSortKey]  = useState('created_at');
  const [sortDir,  setSortDir]  = useState('desc');
  const [typeOpts,   setTypeOpts]   = useState([]);
  const [statusOpts, setStatusOpts] = useState([]);

  // ── Import state ───────────────────────────────────────────────────────────
  const [importResult,  setImportResult]  = useState(null);
  const [importing,     setImporting]     = useState(false);
  const importFileRef = useRef();

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setAssets(await getEquipment()); } catch (e) {
      console.error(e);
      setError('Failed to load assets. Please try refreshing the page.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getMasterData().then(md => {
      setTypeOpts(sortDropdownOptions((md.asset_type || []).map(i => i.value)));
      setStatusOpts((md.condition || []).map(i => i.value));
    }).catch(() => {});
  }, []);

  const filtered = assets.filter(a => {
    const s = search.toLowerCase();
    const matchSearch = !s || [a.name, a.asset_code, a.model, a.serial_number, a.brand, a.os, a.memory, a.storage].some(v => v?.toLowerCase().includes(s));
    return matchSearch
      && (!filters.brand        || a.brand === filters.brand)
      && (!filters.type         || a.type  === filters.type)
      && (!filters.status       || a.status === filters.status)
      && (!filters.stock_status || a.stock_status === filters.stock_status);
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = (a[sortKey] ?? '').toString().toLowerCase();
    const bv = (b[sortKey] ?? '').toString().toLowerCase();
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const brands = sortDropdownOptions([...new Set(assets.map(a => a.brand).filter(Boolean))]);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const clearAll  = () => { setSearch(''); setFilters({ brand: '', type: '', status: '', stock_status: '' }); };
  const hasFilter = search || Object.values(filters).some(Boolean);

  const openModal = (type, asset = null) => { setModal(type); setSelected(asset); };
  const closeModal  = () => { setModal(null); setSelected(null); };
  const afterAction = () => { closeModal(); load(); onRefresh(); };

  const handleDelete = async (id, name) => {
    if (!confirm(`Permanently delete "${name}"?`)) return;
    try {
      await deleteEquipment(id);
      load();
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed. Please try again.');
    }
  };

  // ── CSV Import handler ─────────────────────────────────────────────────────
  const handleImportFile = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb     = XLSX.read(buffer, { type: 'array', raw: false, cellText: true });
      const ws     = wb.Sheets[wb.SheetNames[0]];
      const rows   = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (rows.length < 2) {
        setImportResult({ total: 0, imported: 0, errorRows: [], originalHeaders: [], message: 'CSV file is empty or has no data rows.' });
        setImporting(false);
        return;
      }

      const rawHeaders  = rows[0].map(h => String(h));
      const normHeaders = rawHeaders.map(h => h.replace(/\s*\*.*$/, '').trim().toLowerCase());
      const fieldKeys   = normHeaders.map(h => CSV_HEADER_MAP[h] || null);

      // existing asset_code + serial_number sets for dup check
      const existingCodes   = new Set(assets.map(a => a.asset_code?.trim().toLowerCase()).filter(Boolean));
      const existingSerials = new Set(assets.map(a => a.serial_number?.trim().toLowerCase()).filter(Boolean));
      const batchCodes   = new Set();
      const batchSerials = new Set();

      let imported = 0;
      const errorRows = [];

      for (let i = 1; i < rows.length; i++) {
        const raw = {};
        rawHeaders.forEach((h, idx) => { raw[h] = String(rows[i][idx] ?? '').trim(); });

        const mapped = {};
        fieldKeys.forEach((key, idx) => {
          if (key) mapped[key] = String(rows[i][idx] ?? '').trim();
        });

        // Check mandatory fields
        const missing = MANDATORY_CSV_FIELDS.filter(f => !mapped[f]);
        if (missing.length) {
          errorRows.push({ raw, reason: `Missing required field(s): ${missing.map(f => MANDATORY_CSV_LABELS[f]).join(', ')}` });
          continue;
        }

        // Validate & parse purchase_date
        const pd = parseDateMMDDYYYY(mapped.purchase_date);
        if (pd === null) {
          errorRows.push({ raw, reason: `Invalid Purchase Date format "${mapped.purchase_date}" — expected mm/dd/yyyy` });
          continue;
        }
        mapped.purchase_date = pd;

        // Parse warranty_expiry_date if present
        if (mapped.warranty_expiry_date) {
          const wd = parseDateMMDDYYYY(mapped.warranty_expiry_date);
          if (wd === null) {
            errorRows.push({ raw, reason: `Invalid Warranty Expiry Date format "${mapped.warranty_expiry_date}" — expected mm/dd/yyyy` });
            continue;
          }
          mapped.warranty_expiry_date = wd;
        }

        // Duplicate Asset Code
        const codeKey = mapped.asset_code.toLowerCase();
        if (existingCodes.has(codeKey) || batchCodes.has(codeKey)) {
          errorRows.push({ raw, reason: `Duplicate Asset Code: ${mapped.asset_code}` });
          continue;
        }

        // Duplicate Serial Number
        const snKey = mapped.serial_number.toLowerCase();
        if (existingSerials.has(snKey) || batchSerials.has(snKey)) {
          errorRows.push({ raw, reason: `Duplicate Serial Number: ${mapped.serial_number}` });
          continue;
        }

        // Conditional: Checked Out requires assigned_user_name
        if (mapped.stock_status === 'Checked Out' && !mapped.assigned_user_name?.trim()) {
          errorRows.push({ raw, reason: 'Staff Name is required when Stock Status is Checked Out' });
          continue;
        }

        // Send to backend
        try {
          const fd = new FormData();
          Object.entries(mapped).forEach(([k, v]) => { if (v !== undefined) fd.append(k, v); });
          if (!mapped.status)  fd.append('status', 'Ready');
          if (!mapped.os)      fd.append('os', 'N/A');
          await createEquipment(fd);
          batchCodes.add(codeKey);
          batchSerials.add(snKey);
          imported++;
        } catch (err) {
          const msg = err.response?.data?.error || 'Save failed';
          errorRows.push({ raw, reason: msg });
        }
      }

      setImportResult({ total: rows.length - 1, imported, errorRows, originalHeaders: rawHeaders });
      if (imported > 0) { load(); onRefresh(); }
    } catch (err) {
      setImportResult({ total: 0, imported: 0, errorRows: [], originalHeaders: [], message: `Failed to parse file: ${err.message}` });
    }
    setImporting(false);
  };

  // Export helpers
  const exportCSV = () => {
    const rows = [
      ['Asset Code','Name','Brand','Type','Model','Serial No.','OS','RAM','Storage','Stock Status','Condition'],
      ...filtered.map(a => [
        a.asset_code||'', a.name, a.brand||'', a.type||'', a.model||'', a.serial_number||'',
        a.os||'', formatMemory(a.memory)||'', formatStorage(a.storage)||'',
        a.stock_status, a.status,
      ]),
    ];
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'assets.csv'; a.click();
  };

  const exportExcel = () => {
    const data = filtered.map(a => ({
      'Asset Code':   a.asset_code || '',
      'Name':         a.name,
      'Brand':        a.brand || '',
      'Type':         a.type  || '',
      'Model':        a.model || '',
      'Serial No.':   a.serial_number || '',
      'OS':           a.os    || '',
      'RAM':          formatMemory(a.memory)  || '',
      'Storage':      formatStorage(a.storage) || '',
      'Stock Status': a.stock_status,
      'Condition':    a.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assets');
    XLSX.writeFile(wb, 'assets.xlsx');
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('IT Asset Inventory', 14, 14);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}   |   ${filtered.length} asset(s)`, 14, 21);
    autoTable(doc, {
      startY: 25,
      head:   [['Asset Code','Name','Brand','Type','Model','Serial No.','OS','RAM','Storage','Stock','Condition']],
      body:   filtered.map(a => [
        a.asset_code||'', a.name, a.brand||'', a.type||'',
        a.model||'', a.serial_number||'',
        a.os||'', formatMemory(a.memory)||'', formatStorage(a.storage)||'',
        a.stock_status, a.status,
      ]),
      styles:     { fontSize: 7 },
      headStyles: { fillColor: [26, 35, 126] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    doc.save('assets.pdf');
  };

  return (
    <div className="asset-table-page">
      <div className="page-header">
        <h2 className="section-title">Asset Inventory</h2>
        <button className="btn-primary" onClick={() => openModal('add')}>+ Add Asset</button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Search & Filters */}
      <div className="filter-bar">
        <input
          className="search-input"
          type="text"
          placeholder="Search name, code, model, serial, brand, OS, RAM, disk..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={filters.brand}        onChange={e => setFilter('brand', e.target.value)}>
          <option value="">All Brands</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filters.type}         onChange={e => setFilter('type', e.target.value)}>
          <option value="">All Types</option>
          {typeOpts.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.status}       onChange={e => setFilter('status', e.target.value)}>
          <option value="">All Conditions</option>
          {statusOpts.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.stock_status} onChange={e => setFilter('stock_status', e.target.value)}>
          <option value="">All Stock</option>
          {STOCKS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasFilter && <button className="btn-clear" onClick={clearAll}>✕ Clear</button>}
      </div>

      {/* Import / Export Bar */}
      <div className="export-bar">
        <span className="result-count">{filtered.length} asset{filtered.length !== 1 ? 's' : ''} shown</span>
        <div className="export-buttons">
          <button className="btn-export template" onClick={downloadCSVTemplate}>⬇ Template</button>
          <button className="btn-export import"   onClick={() => importFileRef.current.click()} disabled={importing}>
            {importing ? 'Importing...' : '⬆ Import CSV'}
          </button>
          <input ref={importFileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportFile} />
          <button className="btn-export csv"   onClick={exportCSV}>  ⬇ CSV</button>
          <button className="btn-export excel" onClick={exportExcel}>⬇ Excel</button>
          <button className="btn-export pdf"   onClick={exportPDF}>  ⬇ PDF</button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-row">Loading assets...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {assets.length === 0 ? 'No assets yet. Click "+ Add Asset" to get started.' : 'No assets match your filters.'}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Photo</th>
                {[
                  { key: 'asset_code',   label: 'Asset Code'   },
                  { key: 'name',         label: 'Name / Serial'},
                  { key: 'brand',        label: 'Brand · Type' },
                  { key: 'model',        label: 'Model'        },
                  { key: null,           label: 'Specs'        },
                  { key: 'status',       label: 'Condition'    },
                  { key: 'stock_status', label: 'Stock'        },
                ].map(({ key, label }) => (
                  <th
                    key={label}
                    className={key ? 'th-sortable' : ''}
                    onClick={key ? () => toggleSort(key) : undefined}
                  >
                    {label}
                    {key && (
                      <span className="sort-indicator">
                        {sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
                      </span>
                    )}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(a => (
                <tr key={a.id}>
                  <td>
                    {a.photo
                      ? <img src={`/uploads/${a.photo}`} alt={a.name} className="thumb clickable"
                          onClick={() => setLightbox({ src: `/uploads/${a.photo}`, alt: a.name })} />
                      : <div className="thumb-placeholder">📷</div>
                    }
                  </td>
                  <td><code>{a.asset_code || '—'}</code></td>
                  <td>
                    <div className="asset-name">{a.name}</div>
                    {a.serial_number && <div className="asset-sub">S/N: {a.serial_number}</div>}
                  </td>
                  <td>
                    <div>{a.brand || '—'}</div>
                    <div className="asset-sub">{a.type || '—'}</div>
                  </td>
                  <td>{a.model || '—'}</td>
                  <td>
                    {a.os && a.os !== 'N/A' && <div className="asset-sub">{a.os}</div>}
                    {formatMemory(a.memory) && <div className="asset-sub">RAM: {formatMemory(a.memory)}</div>}
                    {formatStorage(a.storage) && <div className="asset-sub">Disk: {formatStorage(a.storage)}</div>}
                    {(!a.os || a.os === 'N/A') && !formatMemory(a.memory) && !formatStorage(a.storage) && '—'}
                  </td>
                  <td>
                    <StatusBadge status={a.status} />
                    {a.warranty_expiry_date && (() => {
                      const w = warrantyDot(a.warranty_expiry_date);
                      return w ? <span title={w.title} style={{ marginLeft: 4, cursor: 'help' }}>{w.dot}</span> : null;
                    })()}
                  </td>
                  <td>
                    <StatusBadge status={a.stock_status} />
                    {a.stock_status === 'Checked Out' && a.assigned_user_name && (
                      <div className="asset-sub">{a.assigned_user_name}</div>
                    )}
                  </td>
                  <td className="actions-cell">
                    <button className="btn-action" title="View Details" onClick={() => openModal('detail', a)}>👁️</button>
                    <button className="btn-action" title="Edit"         onClick={() => openModal('edit', a)}>✏️</button>
                    <button className="btn-action" title="QR Code"      onClick={() => openModal('qr', a)}>◻️</button>
                    {a.stock_status === 'Available' && (
                      <button className="btn-action" title="Check Out" onClick={() => openModal('checkout', a)}>📤</button>
                    )}
                    <button className="btn-action" title="Delete"       onClick={() => handleDelete(a.id, a.name)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === 'detail' && selected && (
        <AssetDetailModal
          asset={selected}
          onEdit={() => { setModal('edit'); }}
          onClose={closeModal}
        />
      )}
      {(modal === 'add' || modal === 'edit') && (
        <AssetForm asset={modal === 'edit' ? selected : null} onSuccess={afterAction} onClose={closeModal} />
      )}
      {modal === 'checkout' && selected && (
        <CheckoutModal asset={selected} onSuccess={afterAction} onClose={closeModal} />
      )}
      {modal === 'qr' && selected && (
        <QRModal asset={selected} onClose={closeModal} />
      )}
      {lightbox && (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}

      {/* Import Result Modal */}
      {importResult && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setImportResult(null)}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Import Results</h3>
              <button className="modal-close" onClick={() => setImportResult(null)}>✕</button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem' }}>
              {importResult.message ? (
                <p style={{ color: '#dc2626' }}>{importResult.message}</p>
              ) : (
                <>
                  <div className="import-stats">
                    <div className="import-stat success">
                      <span className="import-stat-num">{importResult.imported}</span>
                      <span className="import-stat-label">Imported</span>
                    </div>
                    <div className="import-stat error">
                      <span className="import-stat-num">{importResult.errorRows.length}</span>
                      <span className="import-stat-label">Skipped</span>
                    </div>
                    <div className="import-stat total">
                      <span className="import-stat-num">{importResult.total}</span>
                      <span className="import-stat-label">Total Rows</span>
                    </div>
                  </div>
                  {importResult.errorRows.length > 0 && (
                    <>
                      <p style={{ margin: '1rem 0 .5rem', fontWeight: 600, color: '#b91c1c' }}>
                        {importResult.errorRows.length} row(s) were skipped:
                      </p>
                      <ul className="import-error-list">
                        {importResult.errorRows.slice(0, 10).map((r, i) => (
                          <li key={i}><strong>{r.raw['Asset Code*'] || r.raw['Asset Code'] || `Row ${i + 2}`}:</strong> {r.reason}</li>
                        ))}
                        {importResult.errorRows.length > 10 && (
                          <li style={{ color: '#6b7280' }}>…and {importResult.errorRows.length - 10} more</li>
                        )}
                      </ul>
                      <button
                        className="btn-primary"
                        style={{ marginTop: '1rem', width: '100%' }}
                        onClick={() => downloadErrorLogCSV(importResult.errorRows, importResult.originalHeaders)}
                      >
                        ⬇ Download Error Log
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setImportResult(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
