import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSearch,
  Bell,
  Shield,
  FileBarChart,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import './../../styles/components.css';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/logs', label: 'Log Analysis', icon: FileSearch },
  { to: '/alerts', label: 'Alerts', icon: Bell, badge: 3 },
  { to: '/signatures', label: 'Signatures', icon: Shield },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <ShieldCheck size={18} strokeWidth={2.5} />
        </div>
        <div className="brand-text">
          <div className="brand-name">CYVERA</div>
          <div className="brand-tag">SOC Platform</div>
        </div>
      </div>

      <div className="sidebar-section">Operations</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                'nav-item' + (isActive ? ' active' : '')
              }
            >
              <span className="nav-item-icon">
                <Icon size={16} strokeWidth={2} />
              </span>
              <span>{item.label}</span>
              {item.badge ? (
                <span className="nav-item-badge">{item.badge}</span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="status-dot" />
        <div className="footer-text">
          <span className="label">System Online</span>
          <span className="meta">All collectors healthy</span>
        </div>
      </div>
    </aside>
  );
}
