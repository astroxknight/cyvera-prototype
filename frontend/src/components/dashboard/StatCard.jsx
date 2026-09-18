import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatNumber } from '../../utils/format';

export default function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  accent = 'var(--brand-500)',
  accentBg = 'rgba(0, 212, 255, 0.12)',
}) {
  const isUp = delta >= 0;
  return (
    <div
      className="stat-card"
      style={{ '--accent': accent, '--accent-bg': accentBg }}
    >
      <div className="stat-card-head">
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-icon">
          <Icon size={18} strokeWidth={2} />
        </div>
      </div>
      <div className="stat-card-value">{formatNumber(value)}</div>
      <div className="stat-card-foot">
        <span className={`delta ${isUp ? 'up' : 'down'}`}>
          {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {isUp ? '+' : ''}
          {delta}%
        </span>
        <span>vs last 24h</span>
      </div>
    </div>
  );
}
