import { Link } from 'react-router-dom';
import { AlertCircle, Shield, Activity, Globe } from 'lucide-react';
import { SeverityBadge } from '../common/UI';
import { formatRelativeTime } from '../../utils/format';

const methodIcon = (m) => {
  if (m === 'signature') return <Shield size={14} />;
  if (m === 'anomaly') return <Activity size={14} />;
  return <Globe size={14} />;
};

export default function RecentAlertsList({ alerts = [] }) {
  if (!alerts.length) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
        No recent alerts.
      </div>
    );
  }
  return (
    <div className="activity-list">
      {alerts.slice(0, 6).map((a) => (
        <Link key={a.id} to={`/alerts/${a.id}`} className="activity-item" style={{ textDecoration: 'none' }}>
          <div
            className="activity-icon"
            style={{
              background:
                a.severity === 'critical'
                  ? 'var(--critical-bg)'
                  : a.severity === 'high'
                  ? 'var(--high-bg)'
                  : a.severity === 'medium'
                  ? 'var(--medium-bg)'
                  : 'var(--low-bg)',
              color:
                a.severity === 'critical'
                  ? 'var(--critical)'
                  : a.severity === 'high'
                  ? 'var(--high)'
                  : a.severity === 'medium'
                  ? 'var(--medium)'
                  : 'var(--low)',
            }}
          >
            {methodIcon(a.detectionMethod)}
          </div>
          <div className="activity-content">
            <div className="activity-title">{a.title}</div>
            <div className="activity-meta">
              <span style={{ fontFamily: 'var(--font-mono)' }}>{a.sourceIp}</span>
              <span>·</span>
              <SeverityBadge severity={a.severity} />
              <span>·</span>
              <span>{formatRelativeTime(a.timestamp)}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
