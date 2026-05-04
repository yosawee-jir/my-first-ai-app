// ─────────────────────────────────────────────────────────────────────────────
// Central IT Asset Manager config — IT admins edit this file to add/remove
// dropdown options across the entire application.
// ─────────────────────────────────────────────────────────────────────────────

export const OS_OPTIONS = [
  'N/A',
  'Windows 10',
  'Windows 11',
  'Windows Server 2019',
  'Windows Server 2022',
  'macOS',
  'Linux (Ubuntu)',
  'Linux (CentOS)',
  'Linux (Debian)',
  'Other',
];

export const RAM_SLOT_COUNTS = [0, 1, 2, 3, 4]; // 0 = N/A

export const RAM_SIZE_OPTIONS = ['N/A', '4GB', '8GB', '16GB', '32GB', '64GB'];

export const DISK_TYPE_OPTIONS = ['SSD', 'HDD', 'NVMe', 'M.2'];

export const DISK_SIZE_OPTIONS = [
  'N/A', '128GB', '256GB', '512GB', '1TB', '2TB', '4TB', '8TB',
];

export const ASSET_TYPES = [
  '', 'Laptop', 'Desktop', 'Monitor', 'Printer',
  'Server', 'Network Device', 'Phone', 'Tablet', 'Scanner', 'Other',
];

export const ASSET_STATUSES = ['Ready', 'Broken', 'Under Repair'];

export const STOCK_STATUSES = ['Available', 'Checked Out'];
