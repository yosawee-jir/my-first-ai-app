const express = require('express');
const router  = express.Router();
const db      = require('../database');
const upload  = require('../middleware/upload');

const COLS = [
  'id','asset_code','name','model','serial_number','type','brand',
  'os','memory','storage','photo','stock_status','status',
  'purchase_date','purchase_price','warranty_expiry_date',
  'assigned_user_id','assigned_user_name','assigned_department','assigned_purpose',
  'created_at','updated_at',
].join(',');

const VALID_STOCK_STATUS = ['Available', 'Checked Out'];
const VALID_STATUS = ['Ready', 'Broken', 'Under Repair', 'Retired'];

const FIELD_MAX_LEN = {
  name:          200,
  asset_code:     50,
  model:         100,
  serial_number: 100,
  brand:         100,
  type:          100,
};

const MANDATORY_LABELS = {
  asset_code:    'Asset Code',
  serial_number: 'Serial Number',
  name:          'Asset Name',
  type:          'Type',
  stock_status:  'Stock Status',
  purchase_date: 'Purchase Date',
};

function trimFields(f) {
  const strings = ['name','asset_code','model','serial_number','type','brand','os','memory','storage',
                   'assigned_user_name','assigned_department','assigned_purpose','purchase_date','warranty_expiry_date'];
  const out = { ...f };
  for (const k of strings) {
    if (typeof out[k] === 'string') out[k] = out[k].trim();
  }
  return out;
}

function validateEquipmentFields(f, { requireAll = false } = {}) {
  const errors = [];

  if (requireAll) {
    for (const [field, label] of Object.entries(MANDATORY_LABELS)) {
      if (!f[field]?.trim?.()) errors.push(`${label} is required`);
    }
  } else {
    for (const [field, label] of Object.entries(MANDATORY_LABELS)) {
      if (f[field] !== undefined && !f[field]?.trim?.())
        errors.push(`${label} cannot be empty`);
    }
  }

  for (const [field, max] of Object.entries(FIELD_MAX_LEN)) {
    if (f[field] !== undefined && f[field].length > max)
      errors.push(`${field} must be ${max} characters or fewer`);
  }
  if (f.stock_status !== undefined && f.stock_status && !VALID_STOCK_STATUS.includes(f.stock_status))
    errors.push(`stock_status must be one of: ${VALID_STOCK_STATUS.join(', ')}`);
  if (f.status !== undefined && f.status && !VALID_STATUS.includes(f.status))
    errors.push(`status must be one of: ${VALID_STATUS.join(', ')}`);
  if (f.stock_status === 'Checked Out' && !f.assigned_user_name?.trim())
    errors.push('assigned_user_name is required when stock_status is Checked Out');
  return errors;
}

// Stats — must be before /:id
router.get('/stats', (_req, res) => {
  try {
    const g = sql => db.prepare(sql).get().n;
    const today = new Date().toISOString().split('T')[0];
    const soon  = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    res.json({
      total:          g('SELECT COUNT(*) n FROM equipment'),
      available:      g("SELECT COUNT(*) n FROM equipment WHERE stock_status='Available'"),
      checkedOut:     g("SELECT COUNT(*) n FROM equipment WHERE stock_status='Checked Out'"),
      ready:          g("SELECT COUNT(*) n FROM equipment WHERE status='Ready'"),
      broken:         g("SELECT COUNT(*) n FROM equipment WHERE status='Broken'"),
      warrantyExpired: g(`SELECT COUNT(*) n FROM equipment WHERE warranty_expiry_date IS NOT NULL AND warranty_expiry_date < '${today}'`),
      warrantyExpiringSoon: g(`SELECT COUNT(*) n FROM equipment WHERE warranty_expiry_date IS NOT NULL AND warranty_expiry_date BETWEEN '${today}' AND '${soon}'`),
      byType:  db.prepare("SELECT type, COUNT(*) n FROM equipment WHERE type!='' GROUP BY type ORDER BY n DESC").all(),
      byBrand: db.prepare("SELECT brand, COUNT(*) n FROM equipment WHERE brand!='' GROUP BY brand ORDER BY n DESC LIMIT 8").all(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List with search + filters
router.get('/', (req, res) => {
  try {
    const { search, brand, type, status, stock_status, warranty_status } = req.query;
    let sql = `SELECT ${COLS} FROM equipment WHERE 1=1`;
    const p = [];
    if (search) {
      sql += ` AND (name LIKE ? OR asset_code LIKE ? OR model LIKE ?
               OR serial_number LIKE ? OR brand LIKE ? OR os LIKE ?
               OR memory LIKE ? OR storage LIKE ? OR assigned_user_name LIKE ?)`;
      const s = `%${search}%`;
      p.push(s, s, s, s, s, s, s, s, s);
    }
    if (brand)        { sql += ' AND brand=?';        p.push(brand); }
    if (type)         { sql += ' AND type=?';          p.push(type); }
    if (status)       { sql += ' AND status=?';        p.push(status); }
    if (stock_status) { sql += ' AND stock_status=?';  p.push(stock_status); }
    if (warranty_status) {
      const today = new Date().toISOString().split('T')[0];
      const soon  = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      if (warranty_status === 'expired') {
        sql += ` AND warranty_expiry_date IS NOT NULL AND warranty_expiry_date < '${today}'`;
      } else if (warranty_status === 'expiring') {
        sql += ` AND warranty_expiry_date IS NOT NULL AND warranty_expiry_date BETWEEN '${today}' AND '${soon}'`;
      } else if (warranty_status === 'ok') {
        sql += ` AND warranty_expiry_date IS NOT NULL AND warranty_expiry_date > '${soon}'`;
      }
    }
    sql += ' ORDER BY created_at DESC';
    res.json(db.prepare(sql).all(...p));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single asset
router.get('/:id', (req, res) => {
  try {
    const item = db.prepare(`SELECT ${COLS} FROM equipment WHERE id=?`).get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create
router.post('/', upload.single('photo'), (req, res) => {
  try {
    const f = trimFields(req.body);
    const errors = validateEquipmentFields(f, { requireAll: true });
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const snExists = db.prepare('SELECT id FROM equipment WHERE serial_number=?').get(f.serial_number);
    if (snExists) return res.status(409).json({ error: 'Serial number already exists' });

    const insertStockStatus = f.stock_status || 'Available';
    const r = db.prepare(`
      INSERT INTO equipment
        (asset_code,name,model,serial_number,type,brand,os,memory,storage,photo,
         stock_status,status,purchase_date,purchase_price,warranty_expiry_date,
         assigned_user_id,assigned_user_name,assigned_department,assigned_purpose)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      f.asset_code,
      f.name, f.model||'', f.serial_number,
      f.type||'', f.brand||'',
      f.os||'N/A', f.memory||'N/A', f.storage||'N/A',
      req.file?.filename || null,
      insertStockStatus, f.status || 'Ready',
      f.purchase_date || null,
      f.purchase_price ? Number(f.purchase_price) : null,
      f.warranty_expiry_date || null,
      insertStockStatus === 'Checked Out' ? (f.assigned_user_id ? Number(f.assigned_user_id) : null) : null,
      insertStockStatus === 'Checked Out' ? (f.assigned_user_name || '') : '',
      insertStockStatus === 'Checked Out' ? (f.assigned_department || '') : '',
      insertStockStatus === 'Checked Out' ? (f.assigned_purpose || '') : ''
    );
    const item = db.prepare(`SELECT ${COLS} FROM equipment WHERE id=?`).get(r.lastInsertRowid);
    db.prepare('INSERT INTO history (equipment_id,action,details) VALUES (?,?,?)').run(
      item.id, 'Created', `"${item.name}" added to inventory`
    );
    if (insertStockStatus === 'Checked Out' && item.assigned_user_name) {
      db.prepare('INSERT INTO checkouts (equipment_id,user_id,employee_name,employee_id,department,purpose) VALUES (?,?,?,?,?,?)')
        .run(item.id, item.assigned_user_id || null, item.assigned_user_name, f.assigned_employee_id || '', item.assigned_department || '', item.assigned_purpose || '');
      db.prepare('INSERT INTO history (equipment_id,action,details) VALUES (?,?,?)').run(
        item.id, 'Checked Out', `Assigned to ${item.assigned_user_name} via asset creation`
      );
    }
    res.status(201).json(item);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Asset code already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Update
router.put('/:id', upload.single('photo'), (req, res) => {
  try {
    const f    = trimFields(req.body);
    const errors = validateEquipmentFields(f, { requireAll: true });
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const snExists = f.serial_number
      ? db.prepare('SELECT id FROM equipment WHERE serial_number=? AND id!=?').get(f.serial_number, req.params.id)
      : null;
    if (snExists) return res.status(409).json({ error: 'Serial number already exists' });

    const prev = db.prepare('SELECT * FROM equipment WHERE id=?').get(req.params.id);
    if (!prev) return res.status(404).json({ error: 'Not found' });

    const eqId          = Number(req.params.id);
    const newStockStatus = f.stock_status ?? prev.stock_status;
    const stockChanged   = f.stock_status !== undefined && f.stock_status !== prev.stock_status;

    const clearAssigned = newStockStatus !== 'Checked Out';

    db.transaction(() => {
      db.prepare(`
        UPDATE equipment SET
          asset_code=?,name=?,model=?,serial_number=?,type=?,brand=?,
          os=?,memory=?,storage=?,photo=?,stock_status=?,status=?,
          purchase_date=?,purchase_price=?,warranty_expiry_date=?,
          assigned_user_id=?,assigned_user_name=?,assigned_department=?,assigned_purpose=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(
        f.asset_code    ?? prev.asset_code,
        f.name          ?? prev.name,
        f.model         ?? prev.model,
        f.serial_number ?? prev.serial_number,
        f.type          ?? prev.type,
        f.brand         ?? prev.brand,
        f.os            ?? prev.os,
        f.memory        ?? prev.memory,
        f.storage       ?? prev.storage,
        req.file ? req.file.filename : prev.photo,
        newStockStatus,
        f.status        ?? prev.status,
        f.purchase_date !== undefined ? (f.purchase_date || null) : prev.purchase_date,
        f.purchase_price !== undefined ? (f.purchase_price ? Number(f.purchase_price) : null) : prev.purchase_price,
        f.warranty_expiry_date !== undefined ? (f.warranty_expiry_date || null) : prev.warranty_expiry_date,
        clearAssigned ? null : (f.assigned_user_id !== undefined ? (f.assigned_user_id ? Number(f.assigned_user_id) : null) : prev.assigned_user_id),
        clearAssigned ? '' : (f.assigned_user_name !== undefined ? (f.assigned_user_name || '') : prev.assigned_user_name),
        clearAssigned ? '' : (f.assigned_department !== undefined ? (f.assigned_department || '') : (prev.assigned_department || '')),
        clearAssigned ? '' : (f.assigned_purpose !== undefined ? (f.assigned_purpose || '') : (prev.assigned_purpose || '')),
        eqId
      );

      if (newStockStatus === 'Checked Out') {
        const uName    = (f.assigned_user_name   !== undefined ? f.assigned_user_name   : prev.assigned_user_name)   || '';
        const uId      = f.assigned_user_id      !== undefined ? (f.assigned_user_id   ? Number(f.assigned_user_id)  : null) : (prev.assigned_user_id || null);
        const uDept    = (f.assigned_department  !== undefined ? f.assigned_department  : (prev.assigned_department  || '')) || '';
        const uPurpose = (f.assigned_purpose     !== undefined ? f.assigned_purpose     : (prev.assigned_purpose     || '')) || '';
        const userChanged = f.assigned_user_name !== undefined && (f.assigned_user_name || '') !== (prev.assigned_user_name || '');

        const active = db.prepare('SELECT * FROM checkouts WHERE equipment_id=? AND return_date IS NULL ORDER BY id DESC LIMIT 1').get(eqId);

        if (!active) {
          // No active record — create one
          db.prepare('INSERT INTO checkouts (equipment_id,user_id,employee_name,department,purpose) VALUES (?,?,?,?,?)')
            .run(eqId, uId, uName || 'Unknown', uDept, uPurpose);
        } else if (stockChanged || userChanged) {
          // Newly checked out or re-assigned — close old, open new
          db.prepare('UPDATE checkouts SET return_date=CURRENT_TIMESTAMP WHERE id=?').run(active.id);
          db.prepare('INSERT INTO checkouts (equipment_id,user_id,employee_name,department,purpose) VALUES (?,?,?,?,?)')
            .run(eqId, uId, uName || 'Unknown', uDept, uPurpose);
        } else {
          // Same assignee — just sync dept / purpose in place
          db.prepare('UPDATE checkouts SET department=?, purpose=? WHERE id=?')
            .run(uDept, uPurpose, active.id);
        }

        const histAction = stockChanged ? 'Checked Out' : (userChanged ? 'Re-assigned' : 'Updated');
        const histDetail = newStockStatus === 'Checked Out'
          ? `Assigned to ${uName || 'Unknown'}${uDept ? ' (' + uDept + ')' : ''}${uPurpose ? ' — ' + uPurpose : ''}`
          : 'Asset details updated';
        db.prepare('INSERT INTO history (equipment_id,action,details) VALUES (?,?,?)').run(eqId, histAction, histDetail);
      } else {
        db.prepare('UPDATE checkouts SET return_date=CURRENT_TIMESTAMP WHERE equipment_id=? AND return_date IS NULL').run(eqId);
        if (stockChanged) {
          db.prepare('INSERT INTO history (equipment_id,action,details) VALUES (?,?,?)')
            .run(eqId, 'Returned', `Returned — previously assigned to ${prev.assigned_user_name || 'Unknown'}`);
        } else {
          db.prepare('INSERT INTO history (equipment_id,action,details) VALUES (?,?,?)').run(eqId, 'Updated', 'Asset details updated');
        }
      }
    })();

    res.json(db.prepare(`SELECT ${COLS} FROM equipment WHERE id=?`).get(eqId));
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Asset code already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Partial update — used by bulk CSV import. Empty fields keep existing values.
router.patch('/:id', upload.single('photo'), (req, res) => {
  try {
    const prev = db.prepare('SELECT * FROM equipment WHERE id=?').get(req.params.id);
    if (!prev) return res.status(404).json({ error: 'Not found' });

    const raw = trimFields(req.body);
    // pick: use non-empty CSV value, else fall back to existing column value
    const p = key => (raw[key] !== undefined && raw[key] !== '' && raw[key] !== null) ? raw[key] : prev[key];

    const newStockStatus = p('stock_status') || 'Available';
    const clearAssigned  = newStockStatus !== 'Checked Out';
    const stockChanged   = newStockStatus !== prev.stock_status;
    const newUserName    = clearAssigned ? '' : (p('assigned_user_name') || '');

    if (raw.stock_status && !VALID_STOCK_STATUS.includes(raw.stock_status))
      return res.status(400).json({ error: `stock_status must be one of: ${VALID_STOCK_STATUS.join(', ')}` });
    if (raw.status && !VALID_STATUS.includes(raw.status))
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUS.join(', ')}` });
    if (newStockStatus === 'Checked Out' && !newUserName.trim())
      return res.status(400).json({ error: 'assigned_user_name is required when stock_status is Checked Out' });

    const eqId = Number(req.params.id);

    db.transaction(() => {
      db.prepare(`
        UPDATE equipment SET
          asset_code=?,name=?,model=?,serial_number=?,type=?,brand=?,
          os=?,memory=?,storage=?,photo=?,stock_status=?,status=?,
          purchase_date=?,purchase_price=?,warranty_expiry_date=?,
          assigned_user_id=?,assigned_user_name=?,assigned_department=?,assigned_purpose=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(
        p('asset_code'), p('name'), p('model') || '', p('serial_number'),
        p('type') || '', p('brand') || '',
        p('os')      || 'N/A',
        p('memory')  || 'N/A',
        p('storage') || 'N/A',
        req.file ? req.file.filename : prev.photo,
        newStockStatus,
        p('status') || 'Ready',
        p('purchase_date')        || null,
        raw.purchase_price        ? Number(raw.purchase_price) : (prev.purchase_price || null),
        p('warranty_expiry_date') || null,
        clearAssigned ? null : (raw.assigned_user_id ? Number(raw.assigned_user_id) : (prev.assigned_user_id || null)),
        clearAssigned ? '' : newUserName,
        clearAssigned ? '' : (p('assigned_department') || ''),
        clearAssigned ? '' : (p('assigned_purpose')    || ''),
        eqId
      );

      if (newStockStatus === 'Checked Out') {
        const uName    = newUserName;
        const uEmpId   = raw.assigned_employee_id || '';
        const uId      = raw.assigned_user_id ? Number(raw.assigned_user_id) : (prev.assigned_user_id || null);
        const uDept    = p('assigned_department') || '';
        const uPurpose = p('assigned_purpose')    || '';
        const userChanged = raw.assigned_user_name !== undefined &&
                            (raw.assigned_user_name || '') !== (prev.assigned_user_name || '');

        const active = db.prepare(
          'SELECT * FROM checkouts WHERE equipment_id=? AND return_date IS NULL ORDER BY id DESC LIMIT 1'
        ).get(eqId);

        if (!active) {
          db.prepare('INSERT INTO checkouts (equipment_id,user_id,employee_name,employee_id,department,purpose) VALUES (?,?,?,?,?,?)')
            .run(eqId, uId, uName || 'Unknown', uEmpId, uDept, uPurpose);
          db.prepare('INSERT INTO history (equipment_id,action,details) VALUES (?,?,?)').run(
            eqId, 'Checked Out', `Assigned to ${uName || 'Unknown'}${uDept ? ' (' + uDept + ')' : ''} via CSV import`
          );
        } else if (stockChanged || userChanged) {
          db.prepare('UPDATE checkouts SET return_date=CURRENT_TIMESTAMP WHERE id=?').run(active.id);
          db.prepare('INSERT INTO checkouts (equipment_id,user_id,employee_name,employee_id,department,purpose) VALUES (?,?,?,?,?,?)')
            .run(eqId, uId, uName || 'Unknown', uEmpId, uDept, uPurpose);
          db.prepare('INSERT INTO history (equipment_id,action,details) VALUES (?,?,?)').run(
            eqId, stockChanged ? 'Checked Out' : 'Re-assigned',
            `Assigned to ${uName || 'Unknown'}${uDept ? ' (' + uDept + ')' : ''} via CSV import`
          );
        } else {
          db.prepare('UPDATE checkouts SET department=?, purpose=? WHERE id=?').run(uDept, uPurpose, active.id);
          db.prepare('INSERT INTO history (equipment_id,action,details) VALUES (?,?,?)').run(
            eqId, 'Updated', 'Asset details updated via CSV import'
          );
        }
      } else {
        db.prepare('UPDATE checkouts SET return_date=CURRENT_TIMESTAMP WHERE equipment_id=? AND return_date IS NULL').run(eqId);
        if (stockChanged) {
          db.prepare('INSERT INTO history (equipment_id,action,details) VALUES (?,?,?)').run(
            eqId, 'Returned', `Returned via CSV import — previously ${prev.assigned_user_name || 'Unknown'}`
          );
        } else {
          db.prepare('INSERT INTO history (equipment_id,action,details) VALUES (?,?,?)').run(
            eqId, 'Updated', 'Asset details updated via CSV import'
          );
        }
      }
    })();

    res.json(db.prepare(`SELECT ${COLS} FROM equipment WHERE id=?`).get(eqId));
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Asset code already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM history   WHERE equipment_id=?').run(req.params.id);
    db.prepare('DELETE FROM checkouts WHERE equipment_id=?').run(req.params.id);
    const r = db.prepare('DELETE FROM equipment WHERE id=?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
