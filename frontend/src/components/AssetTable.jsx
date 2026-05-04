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
import { getEquipment, deleteEquipment, getMasterData, createEquipment, updateEquipmentPartial } from '../services/api.js';
import { sortDropdownOptions } from '../utils/sortOptions.js';

// ── CSV Import helpers ────────────────────────────────────────────────────────
const CSV_HEADER_MAP = {
  'asset code':           'asset_code',
  'serial number':        'serial_number',
  'asset name':           'name',
  'name':                 'name',
  'type':                 'type',
  'asset type':           'type',
  'brand':                'brand',
  'model':                'model',
  'stock status':         'stock_status',
  'condition':            'status',
  'os':                   'os',
  'ram':                  'memory',
  'storage':              'storage',
  'purchase date':        'purchase_date',
  'purchase price':       'purchase_price',
  'warranty expiry date': 'warranty_expiry_date',
  'staff name':           'assigned_user_name',
  'staff id':             'assigned_employee_id',
  'department':           'assigned_department',
  'purpose':              'assigned_purpose',
  'assigned user name':   'assigned_user_name',
};

// Mandatory for NEW assets (stock_status is auto-derived; serial required to prevent dupes)
const MANDATORY_NEW_FIELDS = ['asset_code','serial_number','name','type','purchase_date'];
const MANDATORY_CSV_LABELS = {
  asset_code:    'Asset Code',
  serial_number: 'Serial Number',
  name:          'Asset Name',
  type:          'Type',
  purchase_date: 'Purchase Date',
};

function excelSerialToMMDDYYYY(serial) {
  // Excel epoch is Jan 1 1900 = serial 1, with an off-by-one leap-year bug fixed by -25569
  const utcMs = (Math.floor(parseFloat(serial)) - 25569) * 86400 * 1000;
  const d = new Date(utcMs);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

// All cell values arrive here as already-trimmed strings (no Date objects).
function parseDateMMDDYYYY(val) {
  if (!val && val !== 0) return '';

  const s = String(val).trim();
  if (!s) return '';

  // Excel serial number (numeric string, e.g. "46120" or "46120.0004")
  if (/^\d+(\.\d+)?$/.test(s)) {
    const converted = excelSerialToMMDDYYYY(s);
    const m = converted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    return `${m[3]}-${m[1]}-${m[2]}`;
  }

  // mm/dd/yyyy or m/d/yyyy (CSV string with or without leading zeros)
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, mm, dd, yyyy] = slash;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // yyyy-mm-dd (ISO) — already in backend format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Complex strings like "Thu Sep 25 2025 00:00:00 GMT+0700 (Indochina Time)"
  // Find month-name + day + year anywhere in the string
  const MONTHS_MAP = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const mth = s.match(/\b([A-Za-z]{3,9})\s+(\d{1,2})[,\s]+(\d{4})/);
  if (mth) {
    const monthNum = MONTHS_MAP[mth[1].toLowerCase().slice(0, 3)];
    if (monthNum)
      return `${mth[3]}-${String(monthNum).padStart(2, '0')}-${mth[2].padStart(2, '0')}`;
  }

  return null;
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

// Parse "512GB SSD, 1TB HDD" → [{size:"512GB",type:"SSD"},{size:"1TB",type:"HDD"}] JSON string
function parseStorageCSV(str) {
  if (!str || !str.trim()) return null;
  const items = String(str).split(',').map(s => s.trim()).filter(Boolean);
  if (!items.length) return null;
  const disks = items.map(item => {
    const m = item.match(/^(\d+(?:\.\d+)?\s*(?:GB|TB|MB|KB))\s+(.+)$/i);
    if (m) return { size: m[1].trim(), type: m[2].trim() };
    const m2 = item.match(/^(.+?)\s+(\d+(?:\.\d+)?\s*(?:GB|TB|MB|KB))$/i);
    if (m2) return { type: m2[1].trim(), size: m2[2].trim() };
    return { size: item, type: 'Other' };
  });
  return JSON.stringify(disks);
}

// Parse "16GB" or "16GB, 8GB" → ["16GB","8GB"] JSON string
function parseRAMCSV(str) {
  if (!str || !str.trim()) return null;
  const items = String(str).split(',').map(s => s.trim()).filter(Boolean);
  return items.length ? JSON.stringify(items) : null;
}

function makeCSV(headers, exampleRow) {
  return [headers, exampleRow]
    .map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
    .join('\r\n');
}

function downloadNewTemplate() {
  const headers = [
    'Asset Code*', 'Serial Number*', 'Asset Name*', 'Type*',
    'Brand', 'Model', 'Stock Status', 'Condition',
    'OS', 'RAM', 'Storage',
    'Purchase Date* (mm/dd/yyyy)', 'Purchase Price',
    'Warranty Expiry Date (mm/dd/yyyy)',
    'Staff Name', 'Staff ID', 'Department',
  ];
  const example = [
    'IT-2024-001', 'SN1234567', 'Dell Laptop Inspiron 15', 'Laptop',
    'Dell', 'Inspiron 15 3000', 'Available', 'Ready',
    'Windows 11', '16GB', '512GB SSD',
    '01/15/2024', '35000', '01/15/2027',
    '', '', '',
  ];
  const blob = new Blob(['﻿' + makeCSV(headers, example)], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'new_assets_template.csv'; a.click();
}

function downloadUpdateTemplate() {
  const headers = [
    'Asset Code*', 'Serial Number', 'Asset Name', 'Type',
    'Brand', 'Model', 'Stock Status', 'Condition',
    'OS', 'RAM', 'Storage',
    'Purchase Date (mm/dd/yyyy)', 'Purchase Price',
    'Warranty Expiry Date (mm/dd/yyyy)',
    'Staff Name', 'Staff ID', 'Department',
  ];
  const example = [
    'IT-2024-001', '', '', '',
    '', '', 'Checked Out', '',
    '', '', '',
    '', '', '',
    'John Doe', 'EMP001', 'IT Department',
  ];
  const blob = new Blob(['﻿' + makeCSV(headers, example)], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'bulk_update_template.csv'; a.click();
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
  const [importResult,    setImportResult]    = useState(null);
  const [importingNew,    setImportingNew]    = useState(false);
  const [importingUpdate, setImportingUpdate] = useState(false);
  const importNewRef    = useRef();
  const importUpdateRef = useRef();

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

  // ── Shared CSV parse helper ────────────────────────────────────────────────
  function parseCSVFile(buffer) {
    // cellDates:false — keep date cells as numeric serials, never JS Date objects.
    // raw:true — keep numbers as numbers; we convert every cell to string ourselves.
    const wb   = XLSX.read(buffer, { type: 'array', cellDates: false });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    if (rows.length < 2) return null;
    const rawHeaders  = rows[0].map(h => String(h));
    const normHeaders = rawHeaders.map(h =>
      h.replace(/\s*\*.*$/, '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase()
    );
    const fieldKeys = normHeaders.map(h => CSV_HEADER_MAP[h] || null);
    return { rows, rawHeaders, fieldKeys };
  }

  function mapRow(rows, rawHeaders, fieldKeys, i) {
    // raw: original cell value as string (untrimmed) — preserved for error log download
    const raw = {};
    rawHeaders.forEach((h, idx) => {
      const cell = rows[i][idx];
      raw[h] = (cell === null || cell === undefined) ? '' : String(cell);
    });

    // mapped: every cell trimmed + converted to string (empty after trim → treated as not provided)
    const mapped = {};
    fieldKeys.forEach((key, idx) => {
      if (!key) return;
      const cell = rows[i][idx];
      mapped[key] = (cell === null || cell === undefined) ? '' : String(cell).trim();
    });
    return { raw, mapped };
  }

  function applyStorageAndRAM(mapped) {
    if (mapped.storage?.trim()) {
      const p = parseStorageCSV(mapped.storage);
      if (p) mapped.storage = p;
    }
    if (mapped.memory?.trim()) {
      const p = parseRAMCSV(mapped.memory);
      if (p) mapped.memory = p;
    }
  }

  // ── Import New Assets ──────────────────────────────────────────────────────
  const handleImportNew = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setImportingNew(true);
    setImportResult(null);

    try {
      const parsed = parseCSVFile(await file.arrayBuffer());
      if (!parsed) {
        setImportResult({ mode: 'new', total: 0, imported: 0, errorRows: [], originalHeaders: [], message: 'File is empty or has no data rows.' });
        setImportingNew(false);
        return;
      }
      const { rows, rawHeaders, fieldKeys } = parsed;

      const existingCodes   = new Set(assets.map(a => a.asset_code?.trim().toLowerCase()).filter(Boolean));
      const existingSerials = new Set(assets.map(a => a.serial_number?.trim().toLowerCase()).filter(Boolean));
      const batchCodes   = new Set();
      const batchSerials = new Set();
      let imported = 0;
      const errorRows = [];

      const VALID_STOCKS      = ['Available', 'Checked Out'];
      const VALID_CONDITIONS  = ['Ready', 'Broken', 'Under Repair', 'Retired'];

      for (let i = 1; i < rows.length; i++) {
        const { raw, mapped } = mapRow(rows, rawHeaders, fieldKeys, i);
        if (Object.values(raw).every(v => !v)) continue;

        const rowErrors = [];

        // Auto stock_status from staff
        const hasStaff = mapped.assigned_user_name?.trim() || mapped.assigned_employee_id?.trim();
        if (hasStaff && !mapped.stock_status) mapped.stock_status = 'Checked Out';
        if (!mapped.stock_status) mapped.stock_status = 'Available';

        // 1. Mandatory fields — one error message per missing field
        MANDATORY_NEW_FIELDS.forEach(f => {
          if (!mapped[f] && mapped[f] !== 0)
            rowErrors.push(`Required field "${MANDATORY_CSV_LABELS[f]}" is missing`);
        });

        // 2. Stock Status enum
        if (mapped.stock_status && !VALID_STOCKS.includes(mapped.stock_status))
          rowErrors.push(`Stock Status must be 'Available' or 'Checked Out' (got: '${mapped.stock_status}')`);

        // 3. Condition enum
        if (mapped.status && !VALID_CONDITIONS.includes(mapped.status))
          rowErrors.push(`Condition must be one of: ${VALID_CONDITIONS.join(', ')} (got: '${mapped.status}')`);

        // 4. Purchase Date parse
        let pdParsed = null;
        if (mapped.purchase_date) {
          pdParsed = parseDateMMDDYYYY(mapped.purchase_date);
          if (pdParsed === null)
            rowErrors.push(`Invalid Date Format: '${mapped.purchase_date}' in Purchase Date (Expected mm/dd/yyyy)`);
        }

        // 5. Warranty Date parse
        let wdParsed = null;
        if (mapped.warranty_expiry_date) {
          wdParsed = parseDateMMDDYYYY(mapped.warranty_expiry_date);
          if (wdParsed === null)
            rowErrors.push(`Invalid Date Format: '${mapped.warranty_expiry_date}' in Warranty Expiry Date (Expected mm/dd/yyyy)`);
        }

        // 6. Duplicate Asset Code
        const codeKey = mapped.asset_code?.toLowerCase() || '';
        if (codeKey && (existingCodes.has(codeKey) || batchCodes.has(codeKey)))
          rowErrors.push(`Duplicate Asset Code: ${mapped.asset_code}`);

        // 7. Duplicate Serial Number
        const snKey = mapped.serial_number?.toLowerCase() || '';
        if (snKey && (existingSerials.has(snKey) || batchSerials.has(snKey)))
          rowErrors.push(`Duplicate Serial Number: ${mapped.serial_number}`);

        // 8. Checked Out without staff name
        if (mapped.stock_status === 'Checked Out' && !mapped.assigned_user_name?.trim())
          rowErrors.push('Staff Name is required when Stock Status is Checked Out');

        if (rowErrors.length > 0) {
          errorRows.push({ raw, reason: rowErrors.join('; ') });
          continue;
        }

        // Apply parsed dates and structured fields
        mapped.purchase_date = pdParsed;
        if (wdParsed) mapped.warranty_expiry_date = wdParsed;
        applyStorageAndRAM(mapped);

        try {
          const fd = new FormData();
          Object.entries(mapped).forEach(([k, v]) => { if (v !== undefined && v !== '') fd.append(k, v); });
          if (!mapped.status) fd.append('status', 'Ready');
          if (!mapped.os)     fd.append('os', 'N/A');
          await createEquipment(fd);
          batchCodes.add(codeKey);
          batchSerials.add(snKey);
          imported++;
        } catch (err) {
          const msg = err.response?.data?.errors?.join('; ') || err.response?.data?.error || 'Save failed';
          errorRows.push({ raw, reason: msg });
        }
      }

      setImportResult({ mode: 'new', total: rows.length - 1, imported, errorRows, originalHeaders: rawHeaders });
      if (imported > 0) { load(); onRefresh(); }
    } catch (err) {
      setImportResult({ mode: 'new', total: 0, imported: 0, errorRows: [], originalHeaders: [], message: `Failed to parse file: ${err.message}` });
    }
    setImportingNew(false);
  };

  // ── Bulk Update Assets ─────────────────────────────────────────────────────
  const handleImportUpdate = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setImportingUpdate(true);
    setImportResult(null);

    try {
      const parsed = parseCSVFile(await file.arrayBuffer());
      if (!parsed) {
        setImportResult({ mode: 'update', total: 0, imported: 0, errorRows: [], originalHeaders: [], message: 'File is empty or has no data rows.' });
        setImportingUpdate(false);
        return;
      }
      const { rows, rawHeaders, fieldKeys } = parsed;

      // Build lookup map: asset_code (lowercase) → asset object
      const assetByCode = {};
      assets.forEach(a => { if (a.asset_code) assetByCode[a.asset_code.trim().toLowerCase()] = a; });

      let imported = 0;
      const errorRows = [];

      const VALID_STOCKS_U     = ['Available', 'Checked Out'];
      const VALID_CONDITIONS_U = ['Ready', 'Broken', 'Under Repair', 'Retired'];

      for (let i = 1; i < rows.length; i++) {
        const { raw, mapped } = mapRow(rows, rawHeaders, fieldKeys, i);
        if (Object.values(raw).every(v => !v)) continue;

        // Asset Code is the lookup key — must exist before anything else
        if (!mapped.asset_code?.trim()) {
          errorRows.push({ raw, reason: 'Required field "Asset Code" is missing' });
          continue;
        }

        const existing = assetByCode[mapped.asset_code.toLowerCase()];
        if (!existing) {
          errorRows.push({ raw, reason: `Asset Code "${mapped.asset_code}" not found (Check for hidden spaces or wrong code)` });
          continue;
        }

        // Build payload: only non-empty trimmed fields (empty string = "not provided" = keep existing)
        const payload = {};
        Object.entries(mapped).forEach(([k, v]) => { if (v !== '') payload[k] = v; });

        const rowErrors = [];

        // Enum: Stock Status (if provided)
        if (payload.stock_status && !VALID_STOCKS_U.includes(payload.stock_status))
          rowErrors.push(`Stock Status must be 'Available' or 'Checked Out' (got: '${payload.stock_status}')`);

        // Enum: Condition (if provided)
        if (payload.status && !VALID_CONDITIONS_U.includes(payload.status))
          rowErrors.push(`Condition must be one of: ${VALID_CONDITIONS_U.join(', ')} (got: '${payload.status}')`);

        // Purchase Date parse
        let pdParsed = undefined;
        if (payload.purchase_date) {
          pdParsed = parseDateMMDDYYYY(payload.purchase_date);
          if (pdParsed === null)
            rowErrors.push(`Invalid Date Format: '${payload.purchase_date}' in Purchase Date (Expected mm/dd/yyyy)`);
        }

        // Warranty Date parse
        let wdParsed = undefined;
        if (payload.warranty_expiry_date) {
          wdParsed = parseDateMMDDYYYY(payload.warranty_expiry_date);
          if (wdParsed === null)
            rowErrors.push(`Invalid Date Format: '${payload.warranty_expiry_date}' in Warranty Expiry Date (Expected mm/dd/yyyy)`);
        }

        // Auto stock_status from staff
        const hasStaff = payload.assigned_user_name?.trim() || payload.assigned_employee_id?.trim();
        if (hasStaff && !payload.stock_status) payload.stock_status = 'Checked Out';

        // Checked Out requires a user name (either from CSV or already in system)
        const effectiveStock = payload.stock_status || existing.stock_status;
        if (effectiveStock === 'Checked Out') {
          const effectiveUser = payload.assigned_user_name?.trim() || existing.assigned_user_name?.trim();
          if (!effectiveUser) rowErrors.push('Staff Name is required when Stock Status is Checked Out');
        }

        if (rowErrors.length > 0) {
          errorRows.push({ raw, reason: rowErrors.join('; ') });
          continue;
        }

        // Apply parsed dates
        if (pdParsed !== undefined) { if (pdParsed) payload.purchase_date = pdParsed; else delete payload.purchase_date; }
        if (wdParsed !== undefined) { if (wdParsed) payload.warranty_expiry_date = wdParsed; else delete payload.warranty_expiry_date; }

        // Parse storage and RAM
        applyStorageAndRAM(payload);

        try {
          const fd = new FormData();
          Object.entries(payload).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
          await updateEquipmentPartial(existing.id, fd);
          imported++;
        } catch (err) {
          const msg = err.response?.data?.errors?.join('; ') || err.response?.data?.error || 'Update failed';
          errorRows.push({ raw, reason: msg });
        }
      }

      setImportResult({ mode: 'update', total: rows.length - 1, imported, errorRows, originalHeaders: rawHeaders });
      if (imported > 0) { load(); onRefresh(); }
    } catch (err) {
      setImportResult({ mode: 'update', total: 0, imported: 0, errorRows: [], originalHeaders: [], message: `Failed to parse file: ${err.message}` });
    }
    setImportingUpdate(false);
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
          <button className="btn-export template" onClick={downloadNewTemplate}>⬇ New Template</button>
          <button className="btn-export template" onClick={downloadUpdateTemplate}>⬇ Update Template</button>
          <button className="btn-export import"  onClick={() => importNewRef.current.click()}    disabled={importingNew || importingUpdate}>
            {importingNew ? 'Importing...' : '⬆ Import New'}
          </button>
          <button className="btn-export update"  onClick={() => importUpdateRef.current.click()} disabled={importingNew || importingUpdate}>
            {importingUpdate ? 'Updating...' : '⬆ Bulk Update'}
          </button>
          <input ref={importNewRef}    type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={handleImportNew} />
          <input ref={importUpdateRef} type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={handleImportUpdate} />
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
              <h3>{importResult.mode === 'update' ? 'Bulk Update Results' : 'Import Results'}</h3>
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
                      <span className="import-stat-label">{importResult.mode === 'update' ? 'Updated' : 'Imported'}</span>
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
                        {importResult.errorRows.slice(0, 10).map((r, i) => {
                          const id = r.raw['Asset Code*'] || r.raw['Asset Code'] || `Row ${i + 2}`;
                          return <li key={i}><strong>{id}:</strong> {r.reason}</li>;
                        })}
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
