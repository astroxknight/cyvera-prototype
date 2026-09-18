import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, RefreshCw, Bell, ExternalLink } from 'lucide-react';
import { fetchAlerts } from '../services/api';
import {
  SeverityBadge,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingRows,
} from '../components/common/UI';
import { formatRelativeTime, formatDateTime } from '../utils/format';

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
];

const METHOD_OPTIONS = [
  { value: 'all', label: 'All methods' },
  { value: 'signature', label: 'Signature' },
  { value: 'anomaly', label: 'Anomaly' },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    severity: 'all',
    status: 'all',
    method: 'all',
  });
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAlerts(filters);
      setAlerts(res.items);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Alerts</div>
          <div className="page-subtitle">
            Detection events raised by signature matches and anomaly scoring
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={load}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search by title, IP, alert ID…"
              value={filters.search}
              onChange={(e) =>
                setFilters((f) => ({ ...f, search: e.target.value }))
              }
            />
          </div>

          <label className="filter-pill">
            <Filter size={12} />
            <select
              value={filters.severity}
              onChange={(e) =>
                setFilters((f) => ({ ...f, severity: e.target.value }))
              }
            >
              {SEVERITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-pill">
            <Filter size={12} />
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value }))
              }
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-pill">
            <Filter size={12} />
            <select
              value={filters.method}
              onChange={(e) =>
                setFilters((f) => ({ ...f, method: e.target.value }))
              }
            >
              {METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="toolbar-spacer" />

          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
            {loading ? 'Loading…' : `${alerts.length} alerts`}
          </span>
        </div>

        <div className="table-scroll">
          {error ? (
            <ErrorState message={error} onRetry={load} />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Alert ID</th>
                  <th>Severity</th>
                  <th>Title</th>
                  <th>Source IP</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <LoadingRows columns={8} rows={8} />
                ) : alerts.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        icon={<Bell size={22} />}
                        title="No alerts match your filters"
                        message="Adjust the severity, status or detection method filter to see more results."
                      />
                    </td>
                  </tr>
                ) : (
                  alerts.map((a) => (
                    <tr key={a.id} onClick={() => navigate(`/alerts/${a.id}`)}>
                      <td>
                        <span className="mono-id">{a.id}</span>
                      </td>
                      <td>
                        <SeverityBadge severity={a.severity} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{a.title}</div>
                        <div
                          className="cell-secondary"
                          style={{
                            maxWidth: 320,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={a.description}
                        >
                          {a.description}
                        </div>
                      </td>
                      <td>
                        <span className="mono">{a.sourceIp}</span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 11.5,
                            textTransform: 'capitalize',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {a.detectionMethod}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={a.status} />
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>{formatRelativeTime(a.timestamp)}</div>
                        <div className="cell-secondary">{formatDateTime(a.timestamp)}</div>
                      </td>
                      <td>
                        <ExternalLink size={14} color="var(--text-tertiary)" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
