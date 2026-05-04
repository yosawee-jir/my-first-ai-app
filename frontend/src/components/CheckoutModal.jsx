import { useState, useEffect } from 'react';
import { createCheckout, getUsers } from '../services/api.js';

function buildReceiptHTML(asset, co, form) {
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
    <tr><td>Asset Code</td><td>${asset.asset_code||'—'}</td></tr>
    <tr><td>Asset Name</td><td>${asset.name}</td></tr>
    <tr><td>Brand / Model</td><td>${[asset.brand,asset.model].filter(Boolean).join(' / ')||'—'}</td></tr>
    <tr><td>Serial Number</td><td>${asset.serial_number||'—'}</td></tr>
    <tr><td>Type</td><td>${asset.type||'—'}</td></tr>
  </table></div>
  <div class="section"><h2>Borrower Information</h2><table>
    <tr><td>Staff Name</td><td>${form.employee_name||'—'}</td></tr>
    <tr><td>Staff ID</td><td>${form.employee_id||'—'}</td></tr>
    <tr><td>Department</td><td>${form.department||'—'}</td></tr>
    <tr><td>Purpose</td><td>${form.purpose||'—'}</td></tr>
    <tr><td>Check-Out Date</td><td>${now}</td></tr>
    <tr><td>Notes</td><td>${form.notes||'—'}</td></tr>
  </table></div>
  <div class="sig-row">
    <div class="sig-box"><div class="sig-line">Asset Manager Signature</div></div>
    <div class="sig-box"><div class="sig-line">Borrower Signature</div></div>
  </div>
  <div class="footer">Generated: ${now} — IT Asset Management System</div>
  </body></html>`;
}

export default function CheckoutModal({ asset, onSuccess, onClose }) {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [form, setForm] = useState({
    employee_name: '', employee_id: '', department: '', purpose: '', notes: '',
  });
  const [step,     setStep]     = useState('form');
  const [checkout, setCheckout] = useState(null);
  const [error,    setError]    = useState('');
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    getUsers().then(setUsers).catch(() => {});
  }, []);

  const onUserSelect = e => {
    const uid = e.target.value;
    setSelectedUserId(uid);
    if (uid) {
      const user = users.find(u => String(u.id) === uid);
      if (user) {
        setForm(f => ({
          ...f,
          employee_name: user.name,
          employee_id:   user.employee_id || f.employee_id,
          department:    user.department  || f.department,
        }));
      }
    }
    setError('');
  };

  const onChange = e => { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setError(''); };

  const onSubmit = async e => {
    e.preventDefault();
    if (!form.employee_name.trim() && !selectedUserId) {
      return setError('Employee name or user selection is required');
    }
    setSaving(true);
    try {
      const payload = {
        equipment_id:  asset.id,
        user_id:       selectedUserId || undefined,
        employee_name: form.employee_name.trim(),
        employee_id:   form.employee_id,
        department:    form.department,
        purpose:       form.purpose,
        notes:         form.notes,
      };
      const co = await createCheckout(payload);
      setCheckout(co);
      setStep('receipt');
    } catch (err) {
      setError(err.response?.data?.error || 'Checkout failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const printReceipt = () => {
    const win = window.open('', '_blank', 'width=720,height=620');
    win.document.write(buildReceiptHTML(asset, checkout, form));
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        {step === 'form' ? (
          <>
            <div className="modal-header">
              <h3>Check Out Asset</h3>
              <button className="modal-close" onClick={onClose}>✕</button>
            </div>
            <div className="asset-info-strip">
              <span className="info-label">Asset:</span>
              <strong>{asset.name}</strong>
              {asset.asset_code && <code>{asset.asset_code}</code>}
              {asset.model && <span style={{ color: '#888', fontSize: '.85rem' }}>{asset.model}</span>}
            </div>
            <form onSubmit={onSubmit} className="checkout-form">
              {/* User directory selector */}
              {users.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Select from User Directory</label>
                  <select className="form-input" value={selectedUserId} onChange={onUserSelect}>
                    <option value="">— Pick a user (auto-fills fields) —</option>
                    {users.map(u => (
                      <option key={u.id} value={String(u.id)}>
                        {u.name}{u.department ? ` · ${u.department}` : ''}{u.employee_id ? ` [${u.employee_id}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Staff Name <span style={{ color: '#c00' }}>*</span></label>
                <input className="form-input" name="employee_name" value={form.employee_name} onChange={onChange} placeholder="Full name" />
              </div>
              <div className="form-group">
                <label className="form-label">Staff ID</label>
                <input className="form-input" name="employee_id" value={form.employee_id} onChange={onChange} placeholder="Staff / student ID" />
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input className="form-input" name="department" value={form.department} onChange={onChange} placeholder="e.g. Engineering, Marketing" />
              </div>
              <div className="form-group">
                <label className="form-label">Purpose</label>
                <input className="form-input" name="purpose" value={form.purpose} onChange={onChange} placeholder="Reason for borrowing" />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" name="notes" value={form.notes} onChange={onChange} rows={2} placeholder="Additional notes..." />
              </div>
              {error && <div className="form-error">{error}</div>}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Processing...' : 'Confirm Check Out'}</button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="modal-header">
              <h3>✅ Check-Out Successful</h3>
              <button className="modal-close" onClick={onSuccess}>✕</button>
            </div>
            <div className="receipt-preview">
              <p><strong>Asset:</strong> {asset.name}{asset.asset_code && ` (${asset.asset_code})`}</p>
              <p><strong>Checked out to:</strong> {form.employee_name}</p>
              {form.department && <p><strong>Department:</strong> {form.department}</p>}
              <p><strong>Date / Time:</strong> {new Date().toLocaleString()}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={printReceipt}>🖨️ Print Receipt</button>
              <button className="btn-secondary" onClick={onSuccess}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
