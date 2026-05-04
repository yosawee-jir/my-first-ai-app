import { useState, useEffect, useCallback } from 'react';
import {
  getMasterData, createMasterData, updateMasterData, deleteMasterData,
  getUsers, createUser, updateUser, deleteUser,
} from '../services/api.js';

const CATEGORIES = [
  { key: 'brand',      label: 'Brands'       },
  { key: 'asset_type', label: 'Asset Types'  },
  { key: 'condition',  label: 'Conditions'   },
  { key: 'os',         label: 'Operating Systems' },
  { key: 'ram_size',   label: 'RAM Sizes'    },
  { key: 'disk_type',  label: 'Disk Types'   },
  { key: 'disk_size',  label: 'Disk Sizes'   },
];

// ── Master Data Section ───────────────────────────────────────────────────────
function MasterDataSection() {
  const [activeCategory, setActiveCategory] = useState('brand');
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [newValue, setNewValue] = useState('');
  const [editId,   setEditId]   = useState(null);
  const [editVal,  setEditVal]  = useState('');
  const [error,    setError]    = useState('');
  const [saving,   setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await getMasterData(activeCategory));
    } catch {
      setError('Failed to load items.');
    }
    setLoading(false);
  }, [activeCategory]);

  useEffect(() => { load(); setNewValue(''); setEditId(null); }, [load]);

  const handleAdd = async e => {
    e.preventDefault();
    if (!newValue.trim()) return;
    setSaving(true);
    try {
      await createMasterData({ category: activeCategory, value: newValue.trim(), sort_order: items.length });
      setNewValue('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add item.');
    }
    setSaving(false);
  };

  const handleSaveEdit = async id => {
    if (!editVal.trim()) return;
    setSaving(true);
    try {
      await updateMasterData(id, { value: editVal.trim() });
      setEditId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update item.');
    }
    setSaving(false);
  };

  const handleDelete = async id => {
    if (!confirm('Delete this item? Assets using this value will keep their current data.')) return;
    try {
      await deleteMasterData(id);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete item.');
    }
  };

  return (
    <div className="admin-section">
      <h3 className="admin-section-title">Dropdown Options</h3>
      <p className="admin-section-desc">
        Manage dropdown values used in Asset forms. Changes take effect immediately.
      </p>

      <div className="admin-layout">
        {/* Category sidebar */}
        <div className="admin-sidebar">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              className={`admin-cat-btn ${activeCategory === c.key ? 'active' : ''}`}
              onClick={() => setActiveCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Items list */}
        <div className="admin-content">
          <h4 className="admin-content-title">
            {CATEGORIES.find(c => c.key === activeCategory)?.label}
          </h4>

          {error && <div className="form-error" style={{ marginBottom: '.75rem' }}>{error}</div>}

          {loading ? (
            <div className="loading-row">Loading...</div>
          ) : (
            <div className="md-list">
              {items.length === 0 && (
                <div className="md-empty">No items yet. Add one below.</div>
              )}
              {items.map(item => (
                <div key={item.id} className="md-item">
                  {editId === item.id ? (
                    <div className="md-edit-row">
                      <input
                        className="form-input md-edit-input"
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(item.id); if (e.key === 'Escape') setEditId(null); }}
                        autoFocus
                      />
                      <button className="btn-primary btn-sm" onClick={() => handleSaveEdit(item.id)} disabled={saving}>Save</button>
                      <button className="btn-secondary btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <span className="md-value">{item.value}</span>
                      <div className="md-actions">
                        <button className="btn-action" title="Edit" onClick={() => { setEditId(item.id); setEditVal(item.value); }}>✏️</button>
                        <button className="btn-action" title="Delete" onClick={() => handleDelete(item.id)}>🗑️</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add new */}
          <form className="md-add-form" onSubmit={handleAdd}>
            <input
              className="form-input"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              placeholder={`Add new ${CATEGORIES.find(c => c.key === activeCategory)?.label.slice(0,-1).toLowerCase()}...`}
            />
            <button className="btn-primary btn-sm" type="submit" disabled={saving || !newValue.trim()}>
              + Add
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Users Section ─────────────────────────────────────────────────────────────
const EMPTY_USER = { name: '', email: '', employee_id: '', department: '', position: '' };

function UsersSection() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [form,    setForm]    = useState(EMPTY_USER);
  const [editId,  setEditId]  = useState(null);
  const [error,   setError]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers(await getUsers(true)); } catch { setError('Failed to load users.'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const openAdd = () => { setForm(EMPTY_USER); setEditId(null); setError(''); setShowForm(true); };
  const openEdit = u => {
    setForm({ name: u.name, email: u.email, employee_id: u.employee_id, department: u.department, position: u.position });
    setEditId(u.id);
    setError('');
    setShowForm(true);
  };
  const cancelForm = () => { setShowForm(false); setEditId(null); setForm(EMPTY_USER); };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');
    setSaving(true);
    try {
      editId ? await updateUser(editId, form) : await createUser(form);
      cancelForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.');
    }
    setSaving(false);
  };

  const handleToggleActive = async (u) => {
    try {
      await updateUser(u.id, { is_active: u.is_active ? 0 : 1 });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status.');
    }
  };

  const handleDelete = async id => {
    if (!confirm('Delete this user permanently?')) return;
    try {
      await deleteUser(id);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user.');
    }
  };

  return (
    <div className="admin-section">
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <h3 className="admin-section-title" style={{ marginBottom: 0 }}>User Directory</h3>
        <button className="btn-primary" onClick={openAdd}>+ Add User</button>
      </div>
      <p className="admin-section-desc">
        Manage employees who can be assigned assets. These users appear in the Checkout form.
      </p>

      {error && <div className="form-error" style={{ marginBottom: '.75rem' }}>{error}</div>}

      {/* Inline form */}
      {showForm && (
        <div className="user-form-card">
          <h4 style={{ marginBottom: '.85rem', color: '#1a237e' }}>{editId ? 'Edit User' : 'Add New User'}</h4>
          <form onSubmit={handleSubmit} className="user-form-grid">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" name="name" value={form.name} onChange={onChange} placeholder="e.g. John Smith" />
            </div>
            <div className="form-group">
              <label className="form-label">Employee ID</label>
              <input className="form-input" name="employee_id" value={form.employee_id} onChange={onChange} placeholder="e.g. EMP001" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" name="email" value={form.email} onChange={onChange} placeholder="e.g. john@company.com" type="email" />
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input className="form-input" name="department" value={form.department} onChange={onChange} placeholder="e.g. Engineering" />
            </div>
            <div className="form-group">
              <label className="form-label">Position</label>
              <input className="form-input" name="position" value={form.position} onChange={onChange} placeholder="e.g. Software Engineer" />
            </div>
          </form>
          {error && <div className="form-error" style={{ marginTop: '.5rem' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '.85rem', justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={cancelForm}>Cancel</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : editId ? 'Save Changes' : 'Add User'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-row">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="empty-state">No users yet. Click "+ Add User" to get started.</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Employee ID</th>
                <th>Department</th>
                <th>Position</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.5 }}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.employee_id || '—'}</td>
                  <td>{u.department  || '—'}</td>
                  <td>{u.position    || '—'}</td>
                  <td>{u.email       || '—'}</td>
                  <td>
                    <span className={`status-badge ${u.is_active ? 'badge-available' : 'badge-broken'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button className="btn-action" title="Edit"   onClick={() => openEdit(u)}>✏️</button>
                    <button className="btn-action" title={u.is_active ? 'Deactivate' : 'Activate'}
                      onClick={() => handleToggleActive(u)}>
                      {u.is_active ? '🔴' : '🟢'}
                    </button>
                    <button className="btn-action" title="Delete" onClick={() => handleDelete(u.id)}>🗑️</button>
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

// ── Main Page ─────────────────────────────────────────────────────────────────
const SECTIONS = [
  { key: 'master-data', label: 'Dropdown Options' },
  { key: 'users',       label: 'User Directory'   },
];

export default function MasterDataAdmin() {
  const [section, setSection] = useState('master-data');

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2 className="section-title">Admin Settings</h2>
      </div>

      <div className="admin-tabs">
        {SECTIONS.map(s => (
          <button
            key={s.key}
            className={`admin-tab-btn ${section === s.key ? 'active' : ''}`}
            onClick={() => setSection(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'master-data' && <MasterDataSection />}
      {section === 'users'       && <UsersSection />}
    </div>
  );
}
