import { useLocation } from 'react-router-dom';
import { Search, Bell, RefreshCw, Download } from 'lucide-react';
import { useState } from 'react';

const pageInfo = {
  '/': { title: 'Dashboard', subtitle: 'Real-time security posture overview' },
  '/logs': { title: 'Log Analysis', subtitle: 'Ingest, parse, and inspect log records' },
  '/alerts': { title: 'Alerts', subtitle: 'Active and historical security alerts' },
  '/signatures': { title: 'Signatures', subtitle: 'Detection rules and pattern library' },
  '/reports': { title: 'Reports', subtitle: 'SOC activity and incident reporting' },
  '/settings': { title: 'Settings', subtitle: 'Platform configuration' },
};

export default function Topbar({ onSearch }) {
  const location = useLocation();
  const info = pageInfo[location.pathname] || { title: 'CYVERA', subtitle: '' };
  const [query, setQuery] = useState('');

  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>{info.title}</h1>
        <p>{info.subtitle}</p>
      </div>

      <div className="topbar-actions">
        <div className="search-box">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search logs, alerts, IPs…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onSearch && onSearch(e.target.value);
            }}
          />
        </div>
        <button className="icon-btn" title="Refresh">
          <RefreshCw size={16} />
        </button>
        <button className="icon-btn" title="Export">
          <Download size={16} />
        </button>
        <button className="icon-btn" title="Notifications">
          <Bell size={16} />
          <span className="dot" />
        </button>
        <div className="avatar" title="SOC Analyst">SA</div>
      </div>
    </header>
  );
}
