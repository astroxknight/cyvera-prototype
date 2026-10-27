import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  ShieldAlert,
  Zap,
  CheckCircle,
  Download,
  RefreshCw,
  Upload,
} from 'lucide-react';
import {
  fetchDashboardSummary,
  fetchTrend,
  fetchSeverityDistribution,
  fetchHourlyActivity,
  fetchAlerts,
  fetchSignatures,
} from '../services/api';
import StatCard from '../components/dashboard/StatCard';
import ThreatTrendChart from '../components/dashboard/ThreatTrendChart';
import SeverityDistribution from '../components/dashboard/SeverityDistribution';
import HourlyActivityChart from '../components/dashboard/HourlyActivityChart';
import RecentAlertsList from '../components/dashboard/RecentAlertsList';
import { Card, EmptyState, ErrorState } from '../components/common/UI';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [severity, setSeverity] = useState([]);
  const [activity, setActivity] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [activeSignatures, setActiveSignatures] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, t, sev, act, alerts, sigs] = await Promise.all([
        fetchDashboardSummary(),
        fetchTrend(),
        fetchSeverityDistribution(),
        fetchHourlyActivity(),
        fetchAlerts({}),
        fetchSignatures({ enabled: true }),
      ]);
      setSummary(s);
      setTrend(t);
      setSeverity(sev);
      setActivity(act);
      setRecentAlerts(alerts.items);
      setActiveSignatures(sigs.total);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Nothing is pre-loaded: every number below comes from uploaded log files.
  const hasData = (summary?.totalLogs ?? 0) > 0;

  if (error && !summary) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Security Operations Center</div>
          <div className="page-subtitle">
            Live view of detection, response and threat activity
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={load}>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button className="btn btn-primary">
            <Download size={14} />
            Export report
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          label="Total Logs (24h)"
          value={summary?.totalLogs ?? '—'}
          delta={summary?.deltaTotal ?? 0}
          icon={FileText}
          accent="#4de5ff"
          accentBg="rgba(77,229,255,0.12)"
        />
        <StatCard
          label="Threats Detected"
          value={summary?.threatsDetected ?? '—'}
          delta={summary?.deltaThreats ?? 0}
          icon={ShieldAlert}
          accent="#ff3b5c"
          accentBg="rgba(255,59,92,0.12)"
        />
        <StatCard
          label="Anomalies"
          value={summary?.anomalies ?? '—'}
          delta={summary?.deltaAnomalies ?? 0}
          icon={Zap}
          accent="#ffc233"
          accentBg="rgba(255,194,51,0.12)"
        />
        <StatCard
          label="Normal Logs"
          value={summary?.normalLogs ?? '—'}
          delta={summary?.deltaNormal ?? 0}
          icon={CheckCircle}
          accent="#3ddc97"
          accentBg="rgba(61,220,151,0.12)"
        />
      </div>

      {!loading && !hasData ? (
        <Card>
          <EmptyState
            icon={<Upload size={22} />}
            title="No data yet"
            message="Upload a log file in Log Analysis. The dashboard will only show what comes from the logs you upload."
          />
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 20 }}>
            <Link to="/logs" className="btn btn-primary">
              <Upload size={14} />
              Upload logs
            </Link>
          </div>
        </Card>
      ) : (
        <>
      <Card
        title="Threat & Anomaly Trends"
        subtitle="Detected threats vs. anomalies over the last 7 days"
      >
        <div className="chart-container">
          {loading || !trend.length ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', fontSize: 12 }}>
              Loading chart…
            </div>
          ) : (
            <ThreatTrendChart data={trend} />
          )}
        </div>
      </Card>

      <div className="chart-grid-equal" style={{ marginTop: 16 }}>
        <Card
          title="Hourly Activity"
          subtitle="Log volume vs. threat volume by hour (last 24h)"
        >
          <div className="chart-container">
            {loading || !activity.length ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', fontSize: 12 }}>
                Loading…
              </div>
            ) : (
              <HourlyActivityChart data={activity} />
            )}
          </div>
        </Card>

        <Card
          title="Severity Distribution"
          subtitle="All events grouped by severity"
        >
          <div className="chart-container">
            {loading || !severity.length ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', fontSize: 12 }}>
                Loading…
              </div>
            ) : (
              <SeverityDistribution data={severity} />
            )}
          </div>
        </Card>
      </div>

      <div className="chart-grid" style={{ marginTop: 16 }}>
        <Card
          title="Recent Alerts"
          subtitle="Latest 6 alerts across all sources"
        >
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
              Loading…
            </div>
          ) : (
            <RecentAlertsList alerts={recentAlerts} />
          )}
        </Card>
        <Card title="System Health" subtitle="Detector and ingestion status">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
            {[
              { label: 'Log Ingestion', status: 'Operational', value: `${summary?.totalLogs ?? 0} events (24h)` },
              { label: 'Signature Engine', status: 'Operational', value: `${activeSignatures} active` },
              { label: 'Anomaly Model', status: 'Operational', value: 'Isolation Forest' },
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: 12.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    className="status-dot"
                    style={{
                      background:
                        row.status === 'Operational' ? 'var(--success)' : 'var(--medium)',
                    }}
                  />
                  <span style={{ color: 'var(--text-primary)' }}>{row.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {row.value}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color:
                        row.status === 'Operational' ? 'var(--success)' : 'var(--medium)',
                    }}
                  >
                    {row.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
        </>
      )}
    </>
  );
}
