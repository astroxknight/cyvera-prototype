import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  Activity,
  User,
  Clock,
  CheckCircle2,
  PlayCircle,
  RotateCcw,
} from 'lucide-react';
import { fetchAlertById, updateAlertStatus } from '../services/api';
import {
  SeverityBadge,
  StatusBadge,
  MethodPill,
  StatusCode,
  Card,
  ErrorState,
  LoadingRows,
} from '../components/common/UI';
import { formatDateTime, formatRelativeTime } from '../utils/format';

const STATUS_ACTIONS = {
  open: { label: 'Mark as Investigating', next: 'investigating', icon: PlayCircle },
  investigating: { label: 'Mark as Resolved', next: 'resolved', icon: CheckCircle2 },
  resolved: { label: 'Reopen', next: 'open', icon: RotateCcw },
};

export default function AlertDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAlertById(id);
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatus = async () => {
    if (!data) return;
    const action = STATUS_ACTIONS[data.alert.status];
    if (!action) return;
    setUpdating(true);
    try {
      const updated = await updateAlertStatus(data.alert.id, action.next);
      setData({ ...data, alert: updated });
    } finally {
      setUpdating(false);
    }
  };

  if (error) {
    return (
      <>
        <button className="btn btn-ghost" onClick={() => navigate('/alerts')}>
          <ArrowLeft size={14} /> Back to alerts
        </button>
        <ErrorState message={error} onRetry={load} />
      </>
    );
  }

  if (loading || !data) {
    return (
      <>
        <button className="btn btn-ghost" onClick={() => navigate('/alerts')}>
          <ArrowLeft size={14} /> Back to alerts
        </button>
        <Card>
          <table className="data-table">
            <tbody>
              <LoadingRows columns={2} rows={6} />
            </tbody>
          </table>
        </Card>
      </>
    );
  }

  const { alert, signature, logs } = data;
  const action = STATUS_ACTIONS[alert.status];
  const ActionIcon = action?.icon;

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/alerts')}>
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {alert.title}
              <SeverityBadge severity={alert.severity} />
              <StatusBadge status={alert.status} />
            </div>
            <div className="page-subtitle">
              {alert.id} · {formatDateTime(alert.timestamp)} · {formatRelativeTime(alert.timestamp)}
            </div>
          </div>
        </div>
        <div className="page-actions">
          {action && ActionIcon && (
            <button
              className="btn btn-primary"
              onClick={handleStatus}
              disabled={updating}
            >
              <ActionIcon size={14} />
              {action.label}
            </button>
          )}
        </div>
      </div>

      <Card title="Alert Summary">
        <div>
          <div className="detail-row">
            <div className="detail-label">Description</div>
            <div className="detail-value">{alert.description}</div>
          </div>
          <div className="detail-row">
            <div className="detail-label">Source IP</div>
            <div className="detail-value mono">{alert.sourceIp}</div>
          </div>
          <div className="detail-row">
            <div className="detail-label">Destination</div>
            <div className="detail-value mono">{alert.destinationIp}</div>
          </div>
          <div className="detail-row">
            <div className="detail-label">Detection Method</div>
            <div className="detail-value" style={{ textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 8 }}>
              {alert.detectionMethod === 'signature' ? (
                <Shield size={14} color="var(--brand-400)" />
              ) : (
                <Activity size={14} color="var(--medium)" />
              )}
              {alert.detectionMethod}
            </div>
          </div>
          <div className="detail-row">
            <div className="detail-label">Assigned To</div>
            <div className="detail-value">
              {alert.assignedTo ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <User size={14} color="var(--text-tertiary)" />
                  {alert.assignedTo}
                </span>
              ) : (
                <span style={{ color: 'var(--text-tertiary)' }}>Unassigned</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {signature && (
        <div className="detail-section">
          <Card
            title="Matched Signature"
            subtitle="The detection rule that triggered this alert"
            action={
              <Link to="/signatures" className="btn btn-ghost btn-sm">
                View library →
              </Link>
            }
          >
            <div className="detail-row">
              <div className="detail-label">Signature</div>
              <div className="detail-value">
                <span className="mono-id">{signature.id}</span> · {signature.name}
              </div>
            </div>
            <div className="detail-row">
              <div className="detail-label">Category</div>
              <div className="detail-value" style={{ textTransform: 'capitalize' }}>
                {signature.category}
              </div>
            </div>
            <div className="detail-row">
              <div className="detail-label">Severity</div>
              <div className="detail-value">
                <SeverityBadge severity={signature.severity} />
              </div>
            </div>
            <div className="detail-row">
              <div className="detail-label">Description</div>
              <div className="detail-value">{signature.description}</div>
            </div>
            <div className="detail-row">
              <div className="detail-label">Pattern</div>
              <div className="detail-value">
                <div className="code-block">{signature.pattern}</div>
              </div>
            </div>
            <div className="detail-row">
              <div className="detail-label">Author</div>
              <div className="detail-value mono">{signature.author}</div>
            </div>
          </Card>
        </div>
      )}

      {!signature && alert.detectionMethod === 'anomaly' && (
        <div className="detail-section">
          <Card title="Anomaly Context" subtitle="Information about the anomaly that triggered this alert">
            <div className="detail-row">
              <div className="detail-label">Model</div>
              <div className="detail-value">CYVERA Anomaly Detector v2.4.1</div>
            </div>
            <div className="detail-row">
              <div className="detail-label">Score</div>
              <div className="detail-value">
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--critical)',
                    fontWeight: 600,
                  }}
                >
                  0.94
                </span>{' '}
                <span style={{ color: 'var(--text-tertiary)' }}>(threshold 0.80)</span>
              </div>
            </div>
            <div className="detail-row">
              <div className="detail-label">Top Features</div>
              <div className="detail-value">
                <div className="code-block">
                  {`outbound_bytes_zscore    = +6.2
destination_geo_drift    = high
time_of_day_deviation    = +2.1h
session_duration_p99     = exceeded`}
                </div>
              </div>
            </div>
            <div className="detail-row">
              <div className="detail-label">Explanation</div>
              <div className="detail-value">
                This host transferred significantly more data than its 7-day
                baseline, to a destination it has rarely contacted, during
                off-hours. Combined feature scores exceed the anomaly threshold.
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="detail-section">
        <Card
          title="Related Log Events"
          subtitle={`${logs.length} event${logs.length === 1 ? '' : 's'} linked to this alert`}
        >
          {logs.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
              No related log events available.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td><span className="mono-id">{l.id}</span></td>
                    <td>
                      <div style={{ fontSize: 12 }}>{formatRelativeTime(l.timestamp)}</div>
                      <div className="cell-secondary">{formatDateTime(l.timestamp)}</div>
                    </td>
                    <td>
                      <div className="mono">{l.sourceIp}</div>
                      <div className="cell-secondary">→ {l.destinationIp}</div>
                    </td>
                    <td><MethodPill method={l.method} /></td>
                    <td><span className="mono" style={{ fontSize: 12 }}>{l.endpoint}</span></td>
                    <td><StatusCode code={l.statusCode} /></td>
                    <td><SeverityBadge severity={l.severity} /></td>
                    <td style={{ maxWidth: 260, fontSize: 12.5 }}>{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="detail-section">
        <Card title="Response Timeline">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { time: alert.timestamp, label: 'Alert raised', icon: Shield, color: 'var(--critical)' },
              ...(alert.assignedTo
                ? [{ time: alert.timestamp, label: `Assigned to ${alert.assignedTo}`, icon: User, color: 'var(--info)' }]
                : []),
              ...(alert.status === 'investigating' || alert.status === 'resolved'
                ? [{ time: alert.timestamp, label: 'Investigation started', icon: Clock, color: 'var(--medium)' }]
                : []),
              ...(alert.status === 'resolved'
                ? [{ time: alert.timestamp, label: 'Alert resolved', icon: CheckCircle2, color: 'var(--success)' }]
                : []),
            ].map((step, i, arr) => {
              const Icon = step.icon;
              return (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: step.color,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={14} />
                  </div>
                  <div style={{ flex: 1, paddingBottom: i < arr.length - 1 ? 10 : 0, borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {step.label}
                    </div>
                    <div className="cell-secondary">{formatDateTime(step.time)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
