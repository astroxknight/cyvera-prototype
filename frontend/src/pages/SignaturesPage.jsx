import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Shield,
  Power,
} from 'lucide-react';
import {
  fetchSignatures,
  fetchSignatureCategories,
  createSignature,
  updateSignature,
  deleteSignature,
  toggleSignature,
} from '../services/api';
import {
  SeverityBadge,
  EmptyState,
  ErrorState,
  LoadingRows,
  Modal,
  useToast,
  Toast,
} from '../components/common/UI';
import { formatRelativeTime, formatDate } from '../utils/format';

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const ENABLED_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Enabled' },
  { value: 'false', label: 'Disabled' },
];

const FORM_SEVERITY = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const emptyForm = {
  name: '',
  description: '',
  pattern: '',
  severity: 'medium',
  category: '',
  enabled: true,
  author: 'soc.team',
};

export default function SignaturesPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    severity: 'all',
    category: 'all',
    enabled: 'all',
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { toast, show, done } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, cats] = await Promise.all([
        fetchSignatures(filters),
        fetchSignatureCategories(),
      ]);
      setItems(res.items);
      setCategories(cats);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (sig) => {
    setEditingId(sig.id);
    setForm({
      name: sig.name,
      description: sig.description,
      pattern: sig.pattern,
      severity: sig.severity,
      category: sig.category,
      enabled: sig.enabled,
      author: sig.author,
    });
    setFormError('');
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.pattern.trim() || !form.category.trim()) {
      setFormError('Name, pattern and category are required.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateSignature(editingId, form);
        show('Signature updated', 'success');
      } else {
        await createSignature(form);
        show('Signature created', 'success');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteSignature(confirmDelete.id);
      show('Signature deleted', 'success');
      setConfirmDelete(null);
      load();
    } catch (e) {
      show(e.message, 'error');
    }
  };

  const onToggle = async (sig) => {
    try {
      await toggleSignature(sig.id);
      load();
    } catch (e) {
      show(e.message, 'error');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Detection Signatures</div>
          <div className="page-subtitle">
            Manage signature-based detection rules
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={load}>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={14} />
            New signature
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search signatures…"
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
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="filter-pill">
            <Filter size={12} />
            <select
              value={filters.category}
              onChange={(e) =>
                setFilters((f) => ({ ...f, category: e.target.value }))
              }
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="filter-pill">
            <Filter size={12} />
            <select
              value={filters.enabled}
              onChange={(e) =>
                setFilters((f) => ({ ...f, enabled: e.target.value }))
              }
            >
              {ENABLED_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <div className="toolbar-spacer" />

          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
            {loading ? 'Loading…' : `${items.length} signatures`}
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
                  <th>Name</th>
                  <th>Severity</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Matches</th>
                  <th>Author</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <LoadingRows columns={9} rows={6} />
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        icon={<Shield size={22} />}
                        title="No signatures found"
                        message="Adjust your filters or create a new detection rule."
                      />
                    </td>
                  </tr>
                ) : (
                  items.map((s) => (
                    <tr key={s.id}>
                      <td><span className="mono-id">{s.id}</span></td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{s.name}</div>
                        <div
                          className="cell-secondary"
                          style={{
                            maxWidth: 280,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={s.description}
                        >
                          {s.description}
                        </div>
                      </td>
                      <td><SeverityBadge severity={s.severity} /></td>
                      <td>
                        <span className="cell-secondary" style={{ textTransform: 'capitalize' }}>
                          {s.category}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggle(s);
                          }}
                          title={s.enabled ? 'Disable' : 'Enable'}
                          style={{
                            color: s.enabled ? 'var(--success)' : 'var(--text-tertiary)',
                            padding: '4px 8px',
                          }}
                        >
                          <Power size={12} />
                          {s.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                      <td>
                        <span className="mono">{s.matches}</span>
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: 11.5 }}>{s.author}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>{formatRelativeTime(s.updatedAt)}</div>
                        <div className="cell-secondary">{formatDate(s.updatedAt)}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(s);
                            }}
                            title="Edit"
                            style={{ width: 28, height: 28 }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete(s);
                            }}
                            title="Delete"
                            style={{ width: 28, height: 28, color: 'var(--critical)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit signature' : 'New signature'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create signature'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Name</label>
          <input
            className="form-input"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Webshell Upload Pattern"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="form-textarea"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What does this signature detect?"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Pattern</label>
          <textarea
            className="form-textarea"
            rows={3}
            value={form.pattern}
            onChange={(e) => setForm({ ...form, pattern: e.target.value })}
            placeholder='e.g. method="POST" AND path ~ "/api/upload" AND body ~ "eval\\("'
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Severity</label>
            <select
              className="form-select"
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
            >
              {FORM_SEVERITY.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <input
              className="form-input"
              type="text"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. authentication"
              list="cat-suggestions"
            />
            <datalist id="cat-suggestions">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="toggle-row">
          <div className="toggle-row-text">
            <strong>Enabled</strong>
            <span>Disable to keep the rule in the library without matching traffic.</span>
          </div>
          <div
            className={'toggle-switch' + (form.enabled ? ' on' : '')}
            onClick={() => setForm({ ...form, enabled: !form.enabled })}
          />
        </div>
        {formError && <div className="form-error">{formError}</div>}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete signature?"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={onDelete}>
              Delete
            </button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Are you sure you want to delete{' '}
          <strong style={{ color: 'var(--text-primary)' }}>
            {confirmDelete?.name}
          </strong>
          ? This action cannot be undone.
        </p>
      </Modal>

      <Toast {...toast} onDone={done} />
    </>
  );
}
