import { useState } from 'react';
import { addEquipment } from '../services/api.js';

const STATUSES = ['พร้อมใช้', 'เสีย', 'กำลังถูกยืม'];

function AddEquipmentForm({ onSuccess }) {
  const [form, setForm]       = useState({ name: '', asset_number: '', status: 'พร้อมใช้' });
  const [error, setError]     = useState('');
  const [submitting, setSub]  = useState(false);

  const onChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.asset_number.trim()) {
      return setError('กรุณากรอกข้อมูลให้ครบถ้วน');
    }
    setSub(true);
    try {
      await addEquipment(form);
      onSuccess();
    } catch (err) {
      setError(
        err.response?.data?.error === 'Asset number already exists'
          ? 'เลขครุภัณฑ์นี้มีอยู่ในระบบแล้ว'
          : 'เกิดข้อผิดพลาด กรุณาลองใหม่'
      );
    } finally {
      setSub(false);
    }
  };

  return (
    <div className="add-form-container">
      <h2>เพิ่มอุปกรณ์ใหม่</h2>
      <form className="add-form" onSubmit={onSubmit}>
        <div className="form-group">
          <label>ชื่ออุปกรณ์ *</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={onChange}
            placeholder="เช่น คอมพิวเตอร์ Dell Inspiron 15"
          />
        </div>
        <div className="form-group">
          <label>เลขครุภัณฑ์ *</label>
          <input
            type="text"
            name="asset_number"
            value={form.asset_number}
            onChange={onChange}
            placeholder="เช่น IT-2024-001"
          />
        </div>
        <div className="form-group">
          <label>สถานะการใช้งาน</label>
          <select name="status" value={form.status} onChange={onChange}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="btn-submit" disabled={submitting}>
          {submitting ? 'กำลังบันทึก...' : 'เพิ่มอุปกรณ์'}
        </button>
      </form>
    </div>
  );
}

export default AddEquipmentForm;
