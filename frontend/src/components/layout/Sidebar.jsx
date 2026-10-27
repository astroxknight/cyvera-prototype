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
import { useOpenAlertCount } from '../../hooks/useOpenAlertCount';
import './../../styles/components.css';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/logs', label: 'Log Analysis', icon: FileSearch },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/signatures', label: 'Signatures', icon: Shield },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const openAlerts = useOpenAlertCount();

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
          const badge = item.to === '/alerts' ? openAlerts : 0;
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
              {badge > 0 ? (
                <span className="nav-item-badge" title="Open alerts">
                  {badge > 99 ? '99+' : badge}
                </span>
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
