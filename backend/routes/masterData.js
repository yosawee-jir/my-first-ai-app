const express = require('express');
const router  = express.Router();
const db      = require('../database');

const VALID_CATEGORIES = ['brand', 'asset_type', 'condition', 'os', 'ram_size', 'disk_type', 'disk_size', 'purpose'];

// GET /api/master-data  → all items grouped by category
// GET /api/master-data?category=brand  → items for one category
router.get('/', (req, res) => {
  try {
    const { category } = req.query;
    if (category) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
      }
      return res.json(
        db.prepare('SELECT * FROM master_data WHERE category=? ORDER BY sort_order ASC, value ASC').all(category)
      );
    }
    const rows = db.prepare('SELECT * FROM master_data ORDER BY category ASC, sort_order ASC, value ASC').all();
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.category]) grouped[row.category] = [];
      grouped[row.category].push(row);
    }
    res.json(grouped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/master-data  → create item
router.post('/', (req, res) => {
  try {
    const { category, value, sort_order = 0 } = req.body;
    if (!category || !value?.trim()) {
      return res.status(400).json({ error: 'category and value are required' });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }
    const r = db.prepare(
      'INSERT INTO master_data (category, value, sort_order) VALUES (?, ?, ?)'
    ).run(category, value.trim(), Number(sort_order) || 0);
    res.status(201).json(db.prepare('SELECT * FROM master_data WHERE id=?').get(r.lastInsertRowid));
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Value already exists in this category' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/master-data/:id  → update item
router.put('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM master_data WHERE id=?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    const { value, sort_order } = req.body;
    if (value !== undefined && !value.trim()) return res.status(400).json({ error: 'value cannot be empty' });
    db.prepare('UPDATE master_data SET value=?, sort_order=? WHERE id=?').run(
      value?.trim() ?? item.value,
      sort_order !== undefined ? Number(sort_order) : item.sort_order,
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM master_data WHERE id=?').get(req.params.id));
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Value already exists in this category' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/master-data/:id  → delete item
router.delete('/:id', (req, res) => {
  try {
    const r = db.prepare('DELETE FROM master_data WHERE id=?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
