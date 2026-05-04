const express = require('express');
const router  = express.Router();
const db      = require('../database');

// Active checkouts — driven by equipment.stock_status so Assets page and
// Checkouts page always agree, even when stock_status was set manually via edit.
router.get('/', (_req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        COALESCE(c.id, 0)                                      AS id,
        e.id                                                   AS equipment_id,
        COALESCE(c.user_id,       e.assigned_user_id)               AS user_id,
        COALESCE(c.employee_name, e.assigned_user_name, '')       AS employee_name,
        COALESCE(c.employee_id,   u.employee_id, '')              AS employee_id,
        COALESCE(c.department,    e.assigned_department, '')      AS department,
        COALESCE(c.purpose,       e.assigned_purpose, '')         AS purpose,
        COALESCE(c.notes,         '')                          AS notes,
        COALESCE(c.checkout_date, e.updated_at, e.created_at)  AS checkout_date,
        e.name          AS asset_name,
        e.asset_code    AS asset_code,
        e.model         AS model,
        e.brand         AS brand,
        e.type          AS type,
        e.serial_number AS serial_number,
        u.name          AS user_name,
        u.email         AS user_email,
        u.position      AS user_position
      FROM equipment e
      LEFT JOIN checkouts c
        ON c.id = (
          SELECT id FROM checkouts
          WHERE equipment_id = e.id AND return_date IS NULL
          ORDER BY id DESC LIMIT 1
        )
      LEFT JOIN users u ON COALESCE(c.user_id, e.assigned_user_id) = u.id
      WHERE e.stock_status = 'Checked Out'
      ORDER BY COALESCE(c.checkout_date, e.updated_at) DESC
    `).all();
    res.json(rows);
  } catch (err) {
    console.error('[GET /checkouts]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ownership history for a specific asset (includes returned).
// If the asset is currently Checked Out but has no active checkout record
// (orphan — assigned via edit form before sync logic existed), a synthetic
// row is prepended so the Ownership tab is never empty for a checked-out asset.
router.get('/asset/:equipmentId', (req, res) => {
  try {
    const eqId = req.params.equipmentId;
    const rows = db.prepare(`
      SELECT c.*, u.name AS user_name, u.email AS user_email
      FROM checkouts c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.equipment_id=?
      ORDER BY c.checkout_date DESC
    `).all(eqId);

    const asset = db.prepare('SELECT * FROM equipment WHERE id=?').get(eqId);
    if (asset && asset.stock_status === 'Checked Out') {
      const hasActive = rows.some(r => !r.return_date);
      if (!hasActive && (asset.assigned_user_name || asset.assigned_user_id)) {
        const u = asset.assigned_user_id
          ? db.prepare('SELECT * FROM users WHERE id=?').get(asset.assigned_user_id)
          : null;
        rows.unshift({
          id:           0,
          equipment_id: Number(eqId),
          user_id:      asset.assigned_user_id  || null,
          employee_name:asset.assigned_user_name || '',
          employee_id:  u?.employee_id           || '',
          department:   asset.assigned_department|| '',
          purpose:      asset.assigned_purpose   || '',
          notes:        '',
          checkout_date:asset.updated_at || asset.created_at,
          return_date:  null,
          user_name:    u?.name  || null,
          user_email:   u?.email || null,
        });
      }
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ownership history for a user
router.get('/user/:userId', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT c.*, e.name AS asset_name, e.asset_code, e.brand, e.model, e.type
      FROM checkouts c
      INNER JOIN equipment e ON c.equipment_id = e.id
      WHERE c.user_id=?
      ORDER BY c.checkout_date DESC
    `).all(req.params.userId);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check out an asset
router.post('/', (req, res) => {
  try {
    const { equipment_id, user_id, employee_name, employee_id, department, purpose, notes } = req.body;
    if (!equipment_id) return res.status(400).json({ error: 'equipment_id is required' });

    // Resolve employee_name: prefer provided, else look up from users table
    let resolvedName = employee_name?.trim() || '';
    let resolvedUserId = user_id ? Number(user_id) : null;

    if (resolvedUserId && !resolvedName) {
      const u = db.prepare('SELECT * FROM users WHERE id=?').get(resolvedUserId);
      if (u) resolvedName = u.name;
    }
    if (!resolvedName) {
      return res.status(400).json({ error: 'employee_name or user_id (with name) is required' });
    }

    const asset = db.prepare('SELECT * FROM equipment WHERE id=?').get(equipment_id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    if (asset.stock_status !== 'Available') {
      return res.status(409).json({ error: 'Asset is not available for checkout' });
    }

    const resolvedDept = department || (resolvedUserId
      ? (db.prepare('SELECT department FROM users WHERE id=?').get(resolvedUserId)?.department || '')
      : '');

    const checkout = db.transaction(() => {
      const r = db.prepare(`
        INSERT INTO checkouts (equipment_id,user_id,employee_name,employee_id,department,purpose,notes)
        VALUES (?,?,?,?,?,?,?)
      `).run(
        Number(equipment_id),
        resolvedUserId,
        resolvedName,
        employee_id   || '',
        resolvedDept,
        purpose       || '',
        notes         || ''
      );
      db.prepare(`
        UPDATE equipment SET
          stock_status='Checked Out',
          assigned_user_id=?,
          assigned_user_name=?,
          assigned_department=?,
          assigned_purpose=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(resolvedUserId, resolvedName, resolvedDept, purpose || '', Number(equipment_id));
      db.prepare('INSERT INTO history (equipment_id,action,details) VALUES (?,?,?)').run(
        Number(equipment_id),
        'Checked Out',
        `Checked out to ${resolvedName} (${resolvedDept || 'N/A'}) — ${purpose || 'No purpose stated'}`
      );
      return db.prepare('SELECT * FROM checkouts WHERE id=?').get(r.lastInsertRowid);
    })();

    res.status(201).json({
      ...checkout,
      asset_name: asset.name,
      asset_code: asset.asset_code,
    });
  } catch (err) {
    console.error('[POST /checkouts]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Return an asset.
// id=0 means the asset was set to Checked Out via the edit form with no
// checkout record — equipment_id must be provided in the request body.
router.patch('/:id/return', (req, res) => {
  try {
    const coId = Number(req.params.id);

    if (coId === 0) {
      const eqId = Number(req.body.equipment_id);
      if (!eqId) return res.status(400).json({ error: 'equipment_id required' });
      const asset = db.prepare("SELECT * FROM equipment WHERE id=? AND stock_status='Checked Out'").get(eqId);
      if (!asset) return res.status(404).json({ error: 'Asset not found or not checked out' });

      db.transaction(() => {
        db.prepare(`
          UPDATE equipment SET
            stock_status='Available',
            assigned_user_id=NULL, assigned_user_name='',
            assigned_department='', assigned_purpose='',
            updated_at=CURRENT_TIMESTAMP
          WHERE id=?
        `).run(eqId);
        db.prepare('INSERT INTO history (equipment_id,action,details) VALUES (?,?,?)').run(
          eqId, 'Returned',
          `Returned by ${asset.assigned_user_name || 'Unknown'}`
        );
      })();
      return res.json({ success: true });
    }

    const co = db.prepare('SELECT * FROM checkouts WHERE id=?').get(coId);
    if (!co)            return res.status(404).json({ error: 'Checkout record not found' });
    if (co.return_date) return res.status(409).json({ error: 'Asset already returned' });

    db.transaction(() => {
      db.prepare('UPDATE checkouts SET return_date=CURRENT_TIMESTAMP WHERE id=?').run(coId);
      db.prepare(`
        UPDATE equipment SET
          stock_status='Available',
          assigned_user_id=NULL, assigned_user_name='',
          assigned_department='', assigned_purpose='',
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(co.equipment_id);
      db.prepare('INSERT INTO history (equipment_id,action,details) VALUES (?,?,?)').run(
        co.equipment_id,
        'Returned',
        `Returned by ${co.employee_name} (${co.department || 'N/A'})`
      );
    })();

    res.json({ success: true });
  } catch (err) {
    console.error('[PATCH /checkouts/:id/return]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
