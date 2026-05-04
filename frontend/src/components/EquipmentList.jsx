import { useState } from 'react';
import StatusBadge from './StatusBadge.jsx';
import { updateStatus, deleteEquipment } from '../services/api.js';

const STATUSES = ['พร้อมใช้', 'เสีย', 'กำลังถูกยืม'];

function EquipmentList({ equipment, onUpdate }) {
  const [editingId, setEditingId] = useState(null);
  const [newStatus, setNewStatus]  = useState('');

  const startEdit = (item) => {
    setEditingId(item.id);
    setNewStatus(item.status);
  };

  const saveEdit = async (id) => {
    await updateStatus(id, newStatus);
    setEditingId(null);
    onUpdate();
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`ลบอุปกรณ์ "${name}" ออกจากระบบ?`)) return;
    await deleteEquipment(id);
    onUpdate();
  };

  return (
    <div className="equipment-list">
      <h2>รายการอุปกรณ์ทั้งหมด ({equipment.length} รายการ)</h2>

      {equipment.length === 0 ? (
        <p className="empty-state">ยังไม่มีอุปกรณ์ในระบบ</p>
      ) : (
        <table className="equipment-table">
          <thead>
            <tr>
              <th>ชื่ออุปกรณ์</th>
              <th>เลขครุภัณฑ์</th>
              <th>สถานะ</th>
              <th>อัปเดตล่าสุด</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map(item => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td><code>{item.asset_number}</code></td>
                <td>
                  {editingId === item.id ? (
                    <select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <StatusBadge status={item.status} />
                  )}
                </td>
                <td>{new Date(item.updated_at).toLocaleDateString('th-TH')}</td>
                <td className="actions">
                  {editingId === item.id ? (
                    <>
                      <button className="btn-save"   onClick={() => saveEdit(item.id)}>บันทึก</button>
                      <button className="btn-cancel" onClick={() => setEditingId(null)}>ยกเลิก</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-edit"   onClick={() => startEdit(item)}>แก้ไขสถานะ</button>
                      <button className="btn-delete" onClick={() => handleDelete(item.id, item.name)}>ลบ</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default EquipmentList;
