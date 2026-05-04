const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'equipment.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS equipment (
    id                   INTEGER  PRIMARY KEY AUTOINCREMENT,
    asset_code           TEXT     UNIQUE,
    name                 TEXT     NOT NULL,
    model                TEXT     DEFAULT '',
    serial_number        TEXT     DEFAULT '',
    type                 TEXT     DEFAULT '',
    brand                TEXT     DEFAULT '',
    os                   TEXT     DEFAULT 'N/A',
    memory               TEXT     DEFAULT 'N/A',
    storage              TEXT     DEFAULT 'N/A',
    photo                TEXT,
    stock_status         TEXT     NOT NULL DEFAULT 'Available',
    status               TEXT     NOT NULL DEFAULT 'Ready',
    purchase_date        TEXT     DEFAULT NULL,
    purchase_price       REAL     DEFAULT NULL,
    warranty_expiry_date TEXT     DEFAULT NULL,
    assigned_user_id     INTEGER  DEFAULT NULL,
    assigned_user_name   TEXT     DEFAULT '',
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    name        TEXT     NOT NULL,
    email       TEXT     DEFAULT '',
    employee_id TEXT     DEFAULT '',
    department  TEXT     DEFAULT '',
    position    TEXT     DEFAULT '',
    is_active   INTEGER  DEFAULT 1,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS master_data (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    category   TEXT     NOT NULL,
    value      TEXT     NOT NULL,
    sort_order INTEGER  DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (category, value)
  );

  CREATE TABLE IF NOT EXISTS checkouts (
    id            INTEGER  PRIMARY KEY AUTOINCREMENT,
    equipment_id  INTEGER  NOT NULL,
    user_id       INTEGER  DEFAULT NULL,
    employee_name TEXT     NOT NULL,
    employee_id   TEXT     DEFAULT '',
    department    TEXT     DEFAULT '',
    purpose       TEXT     DEFAULT '',
    notes         TEXT     DEFAULT '',
    checkout_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    return_date   DATETIME,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS history (
    id            INTEGER  PRIMARY KEY AUTOINCREMENT,
    equipment_id  INTEGER  NOT NULL,
    action        TEXT     NOT NULL,
    details       TEXT     DEFAULT '',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id)
  );
`);

// ── Migration: rename asset_number → asset_code (old schema) ─────────────────
const cols = db.pragma('table_info(equipment)').map(c => c.name);
if (cols.includes('asset_number') && !cols.includes('asset_code')) {
  db.exec('ALTER TABLE equipment RENAME COLUMN asset_number TO asset_code');
}

// ── Migration: add any missing columns to equipment ───────────────────────────
const current = db.pragma('table_info(equipment)').map(c => c.name);
const equipCols = [
  ['model',                "TEXT DEFAULT ''"],
  ['serial_number',        "TEXT DEFAULT ''"],
  ['type',                 "TEXT DEFAULT ''"],
  ['brand',                "TEXT DEFAULT ''"],
  ['os',                   "TEXT DEFAULT 'N/A'"],
  ['memory',               "TEXT DEFAULT 'N/A'"],
  ['storage',              "TEXT DEFAULT 'N/A'"],
  ['photo',                'TEXT'],
  ['stock_status',         "TEXT NOT NULL DEFAULT 'Available'"],
  ['purchase_date',        'TEXT DEFAULT NULL'],
  ['purchase_price',       'REAL DEFAULT NULL'],
  ['warranty_expiry_date', 'TEXT DEFAULT NULL'],
  ['assigned_user_id',     'INTEGER DEFAULT NULL'],
  ['assigned_user_name',   "TEXT DEFAULT ''"],
  ['assigned_department',  "TEXT DEFAULT ''"],
  ['assigned_purpose',     "TEXT DEFAULT ''"],
];
for (const [col, def] of equipCols) {
  if (!current.includes(col)) {
    try { db.exec(`ALTER TABLE equipment ADD COLUMN ${col} ${def}`); } catch {}
  }
}

// ── Migration: add user_id to checkouts if missing ────────────────────────────
const coCols = db.pragma('table_info(checkouts)').map(c => c.name);
if (!coCols.includes('user_id')) {
  try { db.exec('ALTER TABLE checkouts ADD COLUMN user_id INTEGER DEFAULT NULL'); } catch {}
}

// ── Seed master_data defaults (only if empty) ─────────────────────────────────
const seedData = {
  brand: [
    'Dell', 'HP', 'Lenovo', 'Apple', 'Asus', 'Acer', 'Toshiba',
    'Samsung', 'LG', 'Cisco', 'Epson', 'Canon', 'Brother', 'Other',
  ],
  asset_type: [
    'Laptop', 'Desktop', 'Monitor', 'Printer', 'Server',
    'Network Device', 'Phone', 'Tablet', 'Scanner', 'UPS', 'Other',
  ],
  condition: ['Ready', 'Broken', 'Under Repair', 'Retired'],
  os: [
    'N/A', 'Windows 10', 'Windows 11',
    'Windows Server 2019', 'Windows Server 2022',
    'macOS', 'Linux (Ubuntu)', 'Linux (CentOS)', 'Linux (Debian)', 'Other',
  ],
  ram_size: ['N/A', '2GB', '4GB', '8GB', '16GB', '32GB', '64GB', '128GB'],
  disk_type: ['SSD', 'HDD', 'NVMe', 'M.2', 'eMMC'],
  disk_size: ['N/A', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB', '4TB', '8TB'],
  purpose: [
    'New Staff Onboarding', 'Replacement/Upgrade', 'Temporary Loan',
    'Off-site Working', 'Repair Backup',
  ],
};

const insertMD = db.prepare(
  'INSERT OR IGNORE INTO master_data (category, value, sort_order) VALUES (?, ?, ?)'
);
const seedTx = db.transaction(() => {
  for (const [category, values] of Object.entries(seedData)) {
    const existing = db.prepare('SELECT COUNT(*) n FROM master_data WHERE category=?').get(category).n;
    if (existing === 0) {
      values.forEach((v, i) => insertMD.run(category, v, i));
    }
  }
});
seedTx();

module.exports = db;
