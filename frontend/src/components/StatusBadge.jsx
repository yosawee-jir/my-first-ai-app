const CONFIG = {
  'Available':    { bg: '#e8f5e9', color: '#2e7d32' },
  'Checked Out':  { bg: '#fff3e0', color: '#e65100' },
  'Ready':        { bg: '#e3f2fd', color: '#1565c0' },
  'Broken':       { bg: '#ffebee', color: '#c62828' },
  'Under Repair': { bg: '#fce4ec', color: '#880e4f' },
  'Retired':      { bg: '#f5f5f5', color: '#757575' },
};

export default function StatusBadge({ status }) {
  const c = CONFIG[status] ?? { bg: '#f5f5f5', color: '#666' };
  return (
    <span style={{
      background: c.bg, color: c.color,
      padding: '3px 10px', borderRadius: 12,
      fontSize: '.76rem', fontWeight: 600,
      border: `1px solid ${c.color}25`,
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}
