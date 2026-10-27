import { useCallback, useEffect, useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import {
  fetchUploads,
  deleteUpload,
  clearAllData,
  DATA_CHANGED_EVENT,
} from '../../services/api';
import { Card, Modal, Toast, useToast } from '../common/UI';
import { formatRelativeTime } from '../../utils/format';

// Lists every uploaded file and lets the analyst remove one upload (its logs
// and alerts) or wipe all uploaded data. Signatures and settings are kept.
export default function UploadHistory({ onChanged }) {
  const [uploads, setUploads] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(null); // { type: 'one', upload } | { type: 'all' }
  const [busy, setBusy] = useState(false);
  const { toast, show, done } = useToast();

  const load = useCallback(() => {
    fetchUploads()
      .then((result) => setUploads(result.items))
      .catch(() => setUploads([]))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(DATA_CHANGED_EVENT, load);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, load);
  }, [load]);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const result =
        pending.type === 'all'
          ? await clearAllData()
          : await deleteUpload(pending.upload.jobId);
      show(`Removed ${result.logsDeleted} logs and ${result.alertsDeleted} alerts`, 'success');
      onChanged?.();
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  if (loaded && uploads.length === 0) return null;

  return (
    <>
      <Card
        className="upload-history"
        title="Uploaded files"
        subtitle="Remove an upload to delete its logs and alerts"
        action={
          <button
            className="btn btn-danger btn-sm"
            disabled={!uploads.length}
            onClick={() => setPending({ type: 'all' })}
          >
            <Trash2 size={13} />
            Clear all data
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {uploads.map((upload) => (
            <div
              key={upload.jobId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 0',
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: 12.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <FileText size={14} color="var(--text-tertiary)" />
                <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {upload.filename}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 11.5 }}>
                  {upload.linesProcessed} events · {upload.alertsCreated} alerts ·{' '}
                  {formatRelativeTime(upload.acceptedAt)}
                </span>
                <button
                  className="icon-btn"
                  title={`Remove ${upload.filename}`}
                  aria-label={`Remove ${upload.filename}`}
                  onClick={() => setPending({ type: 'one', upload })}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={Boolean(pending)}
        onClose={() => !busy && setPending(null)}
        title={pending?.type === 'all' ? 'Delete all uploaded data?' : 'Remove this upload?'}
        width={440}
        footer={
          <>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" disabled={busy} onClick={confirm}>
              {busy ? 'Deleting…' : pending?.type === 'all' ? 'Delete everything' : 'Remove upload'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {pending?.type === 'all'
            ? 'This permanently deletes every uploaded log, every alert and all upload records, and resets signature match counts. Signatures and settings are kept.'
            : `This permanently deletes the logs and alerts created from ${pending?.upload?.filename}. Other uploads are not affected.`}
        </p>
      </Modal>
      <Toast {...toast} onDone={done} />
    </>
  );
}
