const express = require('express');
const router  = express.Router();
const db      = require('../database');

router.get('/', (req, res) => {
  const { equipment_id } = req.query;
  let sql = `
    SELECT h.*, e.name asset_name, e.asset_code
    FROM history h
    LEFT JOIN equipment e ON h.equipment_id = e.id
  `;
  const p = [];
  if (equipment_id) { sql += ' WHERE h.equipment_id=?'; p.push(equipment_id); }
  sql += ' ORDER BY h.created_at DESC LIMIT 300';
  res.json(db.prepare(sql).all(...p));
});

module.exports = router;
