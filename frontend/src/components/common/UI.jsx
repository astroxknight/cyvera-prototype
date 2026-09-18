import { useEffect, useState } from 'react';
import { AlertCircle, Inbox, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import './../../styles/components.css';

export function SeverityBadge({ severity }) {
  if (!severity) return null;
  const sev = severity.toLowerCase();
  return (
    <span className={`severity-badge severity-${sev}`}>
      <span className="dot" />
      {severity}
    </span>
  );
}

export function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={`status-badge status-${status}`}>
      <span className="dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {status}
    </span>
  );
}

export function MethodPill({ method }) {
  return <span className={`method-pill method-${method}`}>{method}</span>;
}

export function StatusCode({ code }) {
  if (!code) return <span className="status-code">—</span>;
  let cls = 'status-2xx';
  if (code >= 300 && code < 400) cls = 'status-3xx';
  else if (code >= 400 && code < 500) cls = 'status-4xx';
  else if (code >= 500) cls = 'status-5xx';
  return <span className={`status-code ${cls}`}>{code}</span>;
}

export function EmptyState({ title, message, icon }) {
  return (
    <div className="empty-state">
      <div className="icon">{icon || <Inbox size={22} />}</div>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state">
      <div className="icon">
        <AlertCircle size={24} />
      </div>
      <h3>Something went wrong</h3>
      <p>{message || 'Failed to load data. Please try again.'}</p>
      {onRetry ? (
        <button className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function LoadingRows({ columns, rows = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="skeleton-row">
          {Array.from({ length: columns }).map((__, j) => (
            <td key={j}>
              <div
                className="skeleton"
                style={{ width: j === 0 ? '40%' : '70%' }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {(title || action) && (
        <div className="card-header">
          <div>
            {title ? <div className="card-title">{title}</div> : null}
            {subtitle ? <div className="card-subtitle">{subtitle}</div> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Modal({ open, onClose, title, footer, children, width }) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={width ? { maxWidth: width } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Toast({ type = 'info', message, onDone }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => onDone && onDone(), 3000);
    return () => clearTimeout(t);
  }, [message, onDone]);

  if (!message) return null;
  const Icon = type === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`toast ${type}`}>
      <Icon size={16} />
      <span>{message}</span>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState({ type: 'info', message: '' });
  const show = (message, type = 'info') => setToast({ message, type });
  const done = () => setToast({ type: 'info', message: '' });
  return { toast, show, done };
}
