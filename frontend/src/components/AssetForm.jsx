import { useState, useEffect, useRef } from 'react';
import { createEquipment, updateEquipment, getMasterData, getUsers } from '../services/api.js';
import { sortDropdownOptions } from '../utils/sortOptions.js';

// ── helpers ──────────────────────────────────────────────────────────────────
function parseRam(memory) {
  if (!memory || memory === 'N/A') return { slots: 0, values: Array(4).fill('N/A') };
  try {
    const arr = JSON.parse(memory);
    if (Array.isArray(arr)) {
      const values = [...arr];
      while (values.length < 4) values.push('N/A');
      return { slots: arr.length, values };
    }
  } catch {}
  return { slots: 0, values: Array(4).fill('N/A') };
}

function parseStorage(storage) {
  if (!storage || storage === 'N/A') return [];
  try {
    const arr = JSON.parse(storage);
    if (Array.isArray(arr)) return arr;
  } catch {}
  return [];
}

function warrantyStatus(dateStr) {
  if (!dateStr) return null;
  const today  = new Date(); today.setHours(0,0,0,0);
  const expiry = new Date(dateStr);
  const days   = Math.ceil((expiry - today) / 86400000);
  if (days < 0)  return { label: `Expired ${Math.abs(days)}d ago`, color: '#dc2626', bg: '#fef2f2' };
  if (days <= 30) return { label: `Expiring in ${days}d`,           color: '#d97706', bg: '#fffbeb' };
  return             { label: `Valid (${days}d left)`,              color: '#16a34a', bg: '#f0fdf4' };
}

// ── sub-components ────────────────────────────────────────────────────────────
function Field({ label, name, value, onChange, placeholder, type = 'text', required }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required && <span style={{ color: '#c00' }}> *</span>}</label>
      <input className="form-input" name={name} value={value} onChange={onChange}
        placeholder={placeholder || ''} type={type} />
    </div>
  );
}

function FieldSelect({ label, name, value, onChange, options, required }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required && <span style={{ color: '#c00' }}> *</span>}</label>
      <select className="form-input" name={name} value={value} onChange={onChange}>
        {options.map(o => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : (o || '— Select —');
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function AssetForm({ asset, onSuccess, onClose }) {
  const isEdit = !!asset;

  const [form, setForm] = useState({
    asset_code:            asset?.asset_code            || '',
    name:                  asset?.name                  || '',
    model:                 asset?.model                 || '',
    serial_number:         asset?.serial_number         || '',
    type:                  asset?.type                  || '',
    brand:                 asset?.brand                 || '',
    status:                asset?.status                || 'Ready',
    stock_status:          asset?.stock_status          || 'Available',
    os:                    asset?.os                    || 'N/A',
    purchase_date:         asset?.purchase_date         || '',
    purchase_price:        asset?.purchase_price != null ? String(asset.purchase_price) : '',
    warranty_expiry_date:  asset?.warranty_expiry_date  || '',
    assigned_user_id:      asset?.assigned_user_id      ? String(asset.assigned_user_id) : '',
    assigned_user_name:    asset?.assigned_user_name    || '',
    assigned_department:   asset?.assigned_department   || '',
    assigned_purpose:      asset?.assigned_purpose      || '',
  });

  // Master data options
  const [opts, setOpts] = useState({
    brand: [], asset_type: [], condition: [], os: [], ram_size: [], disk_type: [], disk_size: [], purpose: [],
  });
  const [users,    setUsers]    = useState([]);
  const [optsLoaded, setOptsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getMasterData(), getUsers()])
      .then(([md, us]) => {
        setOpts({
          brand:      (md.brand      || []).map(i => i.value),
          asset_type: (md.asset_type || []).map(i => i.value),
          condition:  (md.condition  || []).map(i => i.value),
          os:         (md.os         || []).map(i => i.value),
          ram_size:   (md.ram_size   || []).map(i => i.value),
          disk_type:  (md.disk_type  || []).map(i => i.value),
          disk_size:  (md.disk_size  || []).map(i => i.value),
          purpose:    (md.purpose    || []).map(i => i.value),
        });
        setUsers(us);
        setOptsLoaded(true);
      })
      .catch(() => setOptsLoaded(true));
  }, []);

  // Dynamic RAM
  const initRam = parseRam(asset?.memory);
  const [ramSlots,  setRamSlots]  = useState(initRam.slots);
  const [ramValues, setRamValues] = useState(initRam.values);

  // Dynamic Storage
  const [disks, setDisks] = useState(parseStorage(asset?.storage));

  // Photo
  const [photo,   setPhoto]   = useState(null);
  const [preview, setPreview] = useState(asset?.photo ? `/uploads/${asset.photo}` : null);

  const [error,  setError]  = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const onChange = e => { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setError(''); };

  const onUserSelect = e => {
    const uid = e.target.value;
    const user = users.find(u => String(u.id) === uid);
    setForm(f => ({
      ...f,
      assigned_user_id:    uid,
      assigned_user_name:  user ? user.name : f.assigned_user_name,
      assigned_department: user?.department || f.assigned_department,
    }));
    setError('');
  };

  const onFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
  };

  // RAM handlers
  const changeRamSlots = n => {
    setRamSlots(n);
    setRamValues(v => {
      const arr = [...v];
      while (arr.length < n) arr.push('N/A');
      return arr;
    });
  };
  const changeRamValue = (i, val) =>
    setRamValues(v => { const a = [...v]; a[i] = val; return a; });

  // Disk handlers
  const defaultDiskType = opts.disk_type[0] || 'SSD';
  const defaultDiskSize = opts.disk_size.find(s => s !== 'N/A') || '512GB';
  const addDisk    = ()         => setDisks(d => [...d, { type: defaultDiskType, size: defaultDiskSize }]);
  const removeDisk = i          => setDisks(d => d.filter((_, idx) => idx !== i));
  const changeDisk = (i, k, v) =>
    setDisks(d => { const a = [...d]; a[i] = { ...a[i], [k]: v }; return a; });

  const memoryVal  = ramSlots === 0 ? 'N/A' : JSON.stringify(ramValues.slice(0, ramSlots));
  const storageVal = disks.length  === 0 ? 'N/A' : JSON.stringify(disks);

  const warrantyInfo = warrantyStatus(form.warranty_expiry_date);
  const isCheckedOut = form.stock_status === 'Checked Out';

  const onSubmit = async e => {
    e.preventDefault();
    const trimmed = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
    );
    if (!trimmed.asset_code)    return setError('Asset Code is required');
    if (!trimmed.serial_number) return setError('Serial Number is required');
    if (!trimmed.name)          return setError('Asset Name is required');
    if (!trimmed.type)          return setError('Type is required');
    if (!trimmed.stock_status)  return setError('Stock Status is required');
    if (!trimmed.purchase_date) return setError('Purchase Date is required');
    if (isCheckedOut && !trimmed.assigned_user_name) return setError('Staff Name is required when Checked Out');
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(trimmed).forEach(([k, v]) => fd.append(k, v));
      fd.append('memory',  memoryVal);
      fd.append('storage', storageVal);
      if (photo) fd.append('photo', photo);
      isEdit ? await updateEquipment(asset.id, fd) : await createEquipment(fd);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Ensure current values appear in dropdowns even if not in master data
  const brandOpts   = sortDropdownOptions(['', ...new Set([...opts.brand,      form.brand].filter(Boolean))]);
  const typeOpts    = sortDropdownOptions(['', ...new Set([...opts.asset_type, form.type].filter(Boolean))]);
  const statusOpts  = [...new Set([...opts.condition,      form.status].filter(Boolean))];
  const osOpts      = [...new Set([...opts.os,             form.os].filter(Boolean))];
  const ramSizeOpts = [...new Set([...opts.ram_size])];
  const diskTypeOpts = [...new Set([...opts.disk_type])];
  const diskSizeOpts = [...new Set([...opts.disk_size])];

  const purposeOpts = sortDropdownOptions([...new Set([...opts.purpose, form.assigned_purpose].filter(Boolean))]);
  const RAM_SLOT_COUNTS = [0, 1, 2, 3, 4];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-wide">
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Asset' : 'Add New Asset'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {!optsLoaded && <div className="loading-row" style={{ padding: '1rem 1.5rem' }}>Loading options...</div>}

        <form onSubmit={onSubmit} className="asset-form">
          {/* ── Row 1: core fields ─────────────────────────────────────── */}
          <div className="form-grid">
            <div className="form-col">
              <Field label="Asset Code"   name="asset_code"    value={form.asset_code}    onChange={onChange} placeholder="e.g. IT-2024-001" required />
              <Field label="Asset Name"   name="name"          value={form.name}          onChange={onChange} placeholder="e.g. Dell Laptop Inspiron 15" required />
              <FieldSelect label="Brand"  name="brand"         value={form.brand}         onChange={onChange} options={brandOpts} />
              <Field label="Model"        name="model"         value={form.model}         onChange={onChange} placeholder="e.g. Inspiron 15 3000" />
              <FieldSelect label="Type"   name="type"          value={form.type}          onChange={onChange} options={typeOpts} required />
            </div>
            <div className="form-col">
              <Field label="Serial Number"   name="serial_number"  value={form.serial_number}  onChange={onChange} placeholder="e.g. SN1234567" required />
              <FieldSelect label="Operating System" name="os"      value={form.os}             onChange={onChange} options={osOpts} />
              <FieldSelect label="Condition"  name="status"        value={form.status}         onChange={onChange} options={statusOpts} />
              <FieldSelect label="Stock Status" name="stock_status" value={form.stock_status}  onChange={onChange}
                options={['Available', 'Checked Out']} required />
            </div>
          </div>

          {/* ── User Assignment (always visible; dept+purpose required when Checked Out) */}
          <div className="spec-section" style={isCheckedOut ? { borderColor: '#fde68a', background: '#fffbeb' } : {}}>
            <div className="spec-header">
              <span className="spec-title" style={isCheckedOut ? { color: '#92400e' } : {}}>
                User Assignment{isCheckedOut && <span style={{ color: '#c00' }}> *</span>}
              </span>
            </div>
            <div className="form-grid" style={{ gap: '.75rem' }}>
              <div className="form-group">
                <label className="form-label">Select from Directory</label>
                <select className="form-input" value={form.assigned_user_id} onChange={onUserSelect}>
                  <option value="">— Select user —</option>
                  {users.map(u => (
                    <option key={u.id} value={String(u.id)}>
                      {u.name}{u.department ? ` (${u.department})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Staff Name{isCheckedOut && <span style={{ color: '#c00' }}> *</span>}</label>
                <input
                  className="form-input"
                  name="assigned_user_name"
                  value={form.assigned_user_name}
                  onChange={onChange}
                  placeholder="Full name of assignee"
                />
              </div>
              {isCheckedOut && (
                <>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input
                      className="form-input"
                      name="assigned_department"
                      value={form.assigned_department}
                      onChange={onChange}
                      placeholder="e.g. IT, Marketing, Finance"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Purpose</label>
                    <select className="form-input" name="assigned_purpose" value={form.assigned_purpose} onChange={onChange}>
                      <option value="">— Select purpose —</option>
                      {purposeOpts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Lifecycle / Financial ──────────────────────────────────── */}
          <div className="spec-section">
            <div className="spec-header">
              <span className="spec-title">Lifecycle & Financials</span>
            </div>
            <div className="form-grid">
              <div className="form-col">
                <Field label="Purchase Date"  name="purchase_date"  value={form.purchase_date}  onChange={onChange} type="date" required />
                <Field label="Purchase Price (฿)" name="purchase_price" value={form.purchase_price} onChange={onChange} type="number" placeholder="0.00" />
              </div>
              <div className="form-col">
                <Field label="Warranty Expiry Date" name="warranty_expiry_date" value={form.warranty_expiry_date} onChange={onChange} type="date" />
                {warrantyInfo && (
                  <div className="warranty-badge" style={{ color: warrantyInfo.color, background: warrantyInfo.bg }}>
                    {form.warranty_expiry_date.startsWith('9') || parseInt(form.warranty_expiry_date) < 0 ? '' : ''}
                    Warranty: {warrantyInfo.label}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RAM ───────────────────────────────────────────────────── */}
          <div className="spec-section">
            <div className="spec-header">
              <span className="spec-title">RAM</span>
              <select
                className="slots-select"
                value={ramSlots}
                onChange={e => changeRamSlots(Number(e.target.value))}
              >
                {RAM_SLOT_COUNTS.map(n => (
                  <option key={n} value={n}>{n === 0 ? 'N/A' : `${n} Slot${n > 1 ? 's' : ''}`}</option>
                ))}
              </select>
            </div>
            {ramSlots > 0 && (
              <div className="slots-grid">
                {Array.from({ length: ramSlots }, (_, i) => (
                  <div key={i} className="slot-item">
                    <span className="slot-label">Slot {i + 1}</span>
                    <select
                      className="form-input"
                      value={ramValues[i] || 'N/A'}
                      onChange={e => changeRamValue(i, e.target.value)}
                    >
                      {ramSizeOpts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Storage ───────────────────────────────────────────────── */}
          <div className="spec-section">
            <div className="spec-header">
              <span className="spec-title">Storage</span>
              {disks.length < 4 && (
                <button type="button" className="btn-add-disk" onClick={addDisk}>+ Add Disk</button>
              )}
            </div>
            {disks.length === 0 && <span className="spec-empty">N/A</span>}
            {disks.map((disk, i) => (
              <div key={i} className="disk-row">
                <select
                  className="form-input"
                  value={disk.type}
                  onChange={e => changeDisk(i, 'type', e.target.value)}
                >
                  {diskTypeOpts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select
                  className="form-input"
                  value={disk.size}
                  onChange={e => changeDisk(i, 'size', e.target.value)}
                >
                  {diskSizeOpts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <button type="button" className="btn-remove-disk" onClick={() => removeDisk(i)} title="Remove">✕</button>
              </div>
            ))}
          </div>

          {/* ── Photo ─────────────────────────────────────────────────── */}
          <div className="photo-section">
            <label className="form-label">Photo</label>
            <div className="photo-upload-row">
              {preview && <img src={preview} alt="preview" className="photo-preview" />}
              <button type="button" className="btn-upload" onClick={() => fileRef.current.click()}>
                {preview ? '📷 Change Photo' : '📷 Upload Photo'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
              {preview && (
                <button type="button" className="btn-remove-photo"
                  onClick={() => { setPhoto(null); setPreview(null); }}>
                  Remove
                </button>
              )}
            </div>
          </div>

          {error && <div className="form-error" style={{ margin: '0 1.5rem .5rem' }}>{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
