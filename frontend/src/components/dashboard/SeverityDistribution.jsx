import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function SeverityDistribution({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
      <div style={{ flex: 1, height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              stroke="#0a0e1a"
              strokeWidth={2}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#141b2e',
                border: '1px solid #2a3654',
                borderRadius: 6,
                fontSize: 12,
                color: '#e6edf7',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="legend" style={{ flex: 1 }}>
        {data.map((d) => (
          <div key={d.name} className="legend-item">
            <div className="legend-swatch" style={{ background: d.color }} />
            <span className="legend-label">{d.name}</span>
            <span className="legend-value">{d.value}</span>
          </div>
        ))}
        <div
          className="legend-item"
          style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, marginTop: 4 }}
        >
          <span className="legend-label" style={{ color: 'var(--text-tertiary)' }}>Total</span>
          <span className="legend-value">{total}</span>
        </div>
      </div>
    </div>
  );
}
