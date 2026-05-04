const express = require('express');
const router  = express.Router();
const db      = require('../database');

// GET /api/users  → list active users (or all with ?all=1)
router.get('/', (req, res) => {
  try {
    const all = req.query.all === '1';
    const rows = db.prepare(
      `SELECT * FROM users${all ? '' : ' WHERE is_active=1'} ORDER BY name ASC`
    ).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users
router.post('/', (req, res) => {
  try {
    const { name, email = '', employee_id = '', department = '', position = '' } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const r = db.prepare(
      'INSERT INTO users (name,email,employee_id,department,position) VALUES (?,?,?,?,?)'
    ).run(name.trim(), email.trim(), employee_id.trim(), department.trim(), position.trim());
    res.status(201).json(db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', (req, res) => {
  try {
    const prev = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
    if (!prev) return res.status(404).json({ error: 'Not found' });
    const { name, email, employee_id, department, position, is_active } = req.body;
    if (name !== undefined && !name.trim()) return res.status(400).json({ error: 'name cannot be empty' });
    db.prepare(`
      UPDATE users SET name=?,email=?,employee_id=?,department=?,position=?,is_active=? WHERE id=?
    `).run(
      name?.trim()        ?? prev.name,
      email?.trim()       ?? prev.email,
      employee_id?.trim() ?? prev.employee_id,
      department?.trim()  ?? prev.department,
      position?.trim()    ?? prev.position,
      is_active !== undefined ? Number(is_active) : prev.is_active,
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id  → hard delete (only if no active checkouts)
router.delete('/:id', (req, res) => {
  try {
    const active = db.prepare(
      'SELECT COUNT(*) n FROM checkouts WHERE user_id=? AND return_date IS NULL'
    ).get(req.params.id).n;
    if (active > 0) {
      return res.status(409).json({ error: 'User has active checkouts. Return assets first.' });
    }
    const r = db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
