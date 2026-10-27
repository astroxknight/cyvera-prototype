import { useEffect, useState, useCallback } from 'react';
import { Search, Filter, RefreshCw, Download, FileText } from 'lucide-react';
import {
  fetchLogs,
  fetchLogTypes,
} from '../services/api';
import {
  SeverityBadge,
  MethodPill,
  StatusCode,
  EmptyState,
  ErrorState,
  LoadingRows,
} from '../components/common/UI';
import FileUpload from '../components/logs/FileUpload';
import UploadHistory from '../components/logs/UploadHistory';
import { formatBytes, formatRelativeTime, formatDateTime } from '../utils/format';

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'info', label: 'Info' },
];

export default function LogAnalysisPage() {
  const [logs, setLogs] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    severity: 'all',
    type: 'all',
  });
  const [activeJob, setActiveJob] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsRes, typesRes] = await Promise.all([
        fetchLogs(filters),
        fetchLogTypes(),
      ]);
      setLogs(logsRes.items);
      setTypes(typesRes);
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
          <div className="page-title">Log Analysis</div>
          <div className="page-subtitle">
            Upload log files and inspect parsed events
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={load}>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button className="btn btn-secondary">
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      <FileUpload
        onComplete={(j) => {
          setActiveJob(j);
          load();
        }}
      />

      <UploadHistory
        onChanged={() => {
          setActiveJob(null);
          load();
        }}
      />

      {activeJob && (
        <div
          style={{
            marginTop: 16,
            padding: '10px 14px',
            background: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--success)',
            fontSize: 12.5,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          Analysis of {activeJob.filename} complete. {logs.length} matching events shown below.
        </div>
      )}

      <div className="table-wrap" style={{ marginTop: 20 }}>
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search by ID, IP, message, endpoint…"
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
              value={filters.type}
              onChange={(e) =>
                setFilters((f) => ({ ...f, type: e.target.value }))
              }
            >
              <option value="all">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <div className="toolbar-spacer" />

          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
            {loading ? 'Loading…' : `${logs.length} events`}
          </span>
        </div>

        <div className="table-scroll">
          {error ? (
            <ErrorState message={error} onRetry={load} />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Timestamp</th>
                  <th>Source</th>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Message</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <LoadingRows columns={10} rows={8} />
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <EmptyState
                        icon={<FileText size={22} />}
                        title="No logs match your filters"
                        message="Try adjusting the search query or clearing the severity / type filters."
                      />
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <span className="mono-id">{l.id}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>{formatRelativeTime(l.timestamp)}</div>
                        <div className="cell-secondary">{formatDateTime(l.timestamp)}</div>
                      </td>
                      <td>
                        <div className="mono">{l.sourceIp}</div>
                        <div className="cell-secondary">→ {l.destinationIp}</div>
                      </td>
                      <td>
                        <MethodPill method={l.method} />
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: 12 }}>{l.endpoint}</span>
                      </td>
                      <td>
                        <StatusCode code={l.statusCode} />
                      </td>
                      <td>
                        <SeverityBadge severity={l.severity} />
                      </td>
                      <td>
                        <span className="cell-secondary" style={{ textTransform: 'capitalize' }}>
                          {l.type}
                        </span>
                      </td>
                      <td style={{ maxWidth: 280 }}>
                        <div
                          style={{
                            fontSize: 12.5,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={l.message}
                        >
                          {l.message}
                        </div>
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: 11.5 }}>
                          {formatBytes(l.bytes)}
                        </span>
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
