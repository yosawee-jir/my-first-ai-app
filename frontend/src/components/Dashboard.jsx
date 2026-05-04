function StatCard({ icon, value, label, color }) {
  return (
    <div className="stat-card" style={{ borderTopColor: color }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-number" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function Dashboard({ stats }) {
  return (
    <div className="dashboard">
      <h2 className="section-title">Overview</h2>

      <div className="stats-grid">
        <StatCard icon="📦" value={stats.total}      label="Total Assets"   color="#1a237e" />
        <StatCard icon="✅" value={stats.available}  label="Available"      color="#2e7d32" />
        <StatCard icon="📤" value={stats.checkedOut} label="Checked Out"    color="#e65100" />
        <StatCard icon="🔧" value={stats.ready}      label="Ready"          color="#1565c0" />
        <StatCard icon="🔴" value={stats.broken}     label="Broken"         color="#c62828" />
      </div>

      {stats.byType?.length > 0 && (
        <div className="chart-section">
          <h3>Assets by Type</h3>
          <div className="bar-chart">
            {stats.byType.map(t => (
              <div key={t.type} className="bar-row">
                <span className="bar-label">{t.type || 'Unknown'}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(t.n / stats.total) * 100}%` }} />
                </div>
                <span className="bar-value">{t.n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.byBrand?.length > 0 && (
        <div className="chart-section">
          <h3>Top Brands</h3>
          <div className="brand-tags">
            {stats.byBrand.map(b => (
              <span key={b.brand} className="brand-tag">
                {b.brand} <strong>{b.n}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {stats.total === 0 && (
        <div className="empty-state" style={{ marginTop: '2rem' }}>
          No assets yet. Go to the <strong>Assets</strong> tab to add your first asset.
        </div>
      )}
    </div>
  );
}
