import { useEffect, useState } from 'react';
import { FileBarChart, Download, Calendar, FileText, Mail } from 'lucide-react';
import { Card } from '../components/common/UI';
import { formatDate } from '../utils/format';

const SAMPLE_REPORTS = [
  {
    id: 'RPT-2024-001',
    title: 'Daily Security Summary — Sep 6, 2026',
    type: 'Daily Summary',
    generatedAt: '2026-09-06T23:55:00Z',
    period: 'Sep 6, 2026',
    pages: 12,
    author: 'CYVERA Auto-Report',
    highlights: [
      '214,789 total log events processed',
      '47 threats detected (12 critical)',
      '18 anomalies flagged by ML model',
      '8 signatures matched (3 critical)',
    ],
  },
  {
    id: 'RPT-2024-002',
    title: 'Weekly SOC Activity — Aug 31 – Sep 6, 2026',
    type: 'Weekly Activity',
    generatedAt: '2026-09-06T06:00:00Z',
    period: 'Aug 31 – Sep 6, 2026',
    pages: 28,
    author: 'CYVERA Auto-Report',
    highlights: [
      '1.42M log events ingested',
      '312 threats detected (avg 44.5/day)',
      '92 anomalies flagged',
      'MTTR reduced 12% week-over-week',
    ],
  },
  {
    id: 'RPT-2024-003',
    title: 'Monthly Threat Landscape — August 2026',
    type: 'Monthly Threat Landscape',
    generatedAt: '2026-09-01T03:00:00Z',
    period: 'August 2026',
    pages: 64,
    author: 'CYVERA Auto-Report',
    highlights: [
      '5.1M log events ingested',
      '1,247 threats detected',
      'Top category: authentication attacks (43%)',
      'New signatures deployed: 4',
    ],
  },
];

const QUICK_REPORTS = [
  { name: 'Daily Summary', desc: '24h overview of detections, MTTR and top alerts.' },
  { name: 'Weekly SOC Activity', desc: 'Detection volume, signature efficacy, MTTR trends.' },
  { name: 'Threat Landscape', desc: 'Categorized threat mix, top sources, geo distribution.' },
  { name: 'Compliance Posture', desc: 'Mapping of detections to common compliance frameworks.' },
];

export default function ReportsPage() {
  const [tab, setTab] = useState('recent');

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-subtitle">
            Generated SOC activity and threat landscape reports
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary">
            <Mail size={14} /> Email schedule
          </button>
          <button className="btn btn-primary">
            <FileBarChart size={14} /> Generate report
          </button>
        </div>
      </div>

      <div className="chart-grid-equal">
        <Card title="Quick Reports" subtitle="Generate on-demand">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {QUICK_REPORTS.map((r) => (
              <div
                key={r.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 4px',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {r.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{r.desc}</div>
                </div>
                <button className="btn btn-secondary btn-sm">
                  <Download size={12} /> Generate
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Scheduled Reports" subtitle="Configured delivery">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { name: 'Daily Summary', recipients: 'soc-team@cyvera.io', cadence: 'Daily @ 23:55' },
              { name: 'Weekly Activity', recipients: 'mgmt@cyvera.io', cadence: 'Mondays @ 06:00' },
              { name: 'Monthly Threat Landscape', recipients: 'mgmt@cyvera.io', cadence: '1st @ 03:00' },
            ].map((s) => (
              <div
                key={s.name}
                style={{
                  padding: '12px 4px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    <Calendar size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    {s.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                    {s.cadence} · {s.recipients}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--success)' }}>● Active</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="page-header" style={{ marginTop: 8, marginBottom: 12 }}>
        <div>
          <div className="page-title" style={{ fontSize: 16 }}>Recent Reports</div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="toolbar-spacer" />
          <button
            className={'filter-pill' + (tab === 'recent' ? ' active' : '')}
            onClick={() => setTab('recent')}
            style={tab === 'recent' ? { background: 'var(--bg-hover)', color: 'var(--text-primary)' } : undefined}
          >
            Recent
          </button>
          <button
            className={'filter-pill' + (tab === 'scheduled' ? ' active' : '')}
            onClick={() => setTab('scheduled')}
            style={tab === 'scheduled' ? { background: 'var(--bg-hover)', color: 'var(--text-primary)' } : undefined}
          >
            Scheduled
          </button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Report</th>
                <th>Type</th>
                <th>Period</th>
                <th>Pages</th>
                <th>Generated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_REPORTS.map((r) => (
                <tr key={r.id}>
                  <td><span className="mono-id">{r.id}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: 'var(--bg-tertiary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--brand-400)',
                        }}
                      >
                        <FileText size={14} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{r.title}</div>
                        <div className="cell-secondary">{r.author}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="cell-secondary">{r.type}</span></td>
                  <td><span className="cell-secondary">{r.period}</span></td>
                  <td><span className="mono">{r.pages}</span></td>
                  <td>
                    <div style={{ fontSize: 12 }}>{formatDate(r.generatedAt)}</div>
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm">
                      <Download size={12} /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
