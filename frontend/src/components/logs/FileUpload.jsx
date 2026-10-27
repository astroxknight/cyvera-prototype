import { useRef, useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { uploadLogFile } from '../../services/api';
import { formatBytes } from '../../utils/format';

// Keep in sync with backend/app/main.py (ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES).
const ALLOWED_EXTENSIONS = ['.log', '.txt', '.csv', '.json'];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const STAGES = [
  { key: 'upload', label: 'Uploading' },
  { key: 'analyze', label: 'Parsing & detecting' },
  { key: 'done', label: 'Complete' },
];

function validate(file) {
  const name = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return `Unsupported file type. Use ${ALLOWED_EXTENSIONS.join(', ')}`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_UPLOAD_BYTES)}`;
  }
  if (file.size === 0) {
    return 'File is empty';
  }
  return null;
}

export default function FileUpload({ onComplete }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState(null); // null | 'upload' | 'analyze' | 'done'
  const [filename, setFilename] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const busy = stage === 'upload' || stage === 'analyze';

  const handleFile = async (file) => {
    if (!file || busy) return;
    setError(null);
    setResult(null);
    const problem = validate(file);
    if (problem) {
      setError(problem);
      return;
    }
    setFilename(file.name);
    setStage('upload');
    try {
      // The backend parses and analyzes inside the same request, so we flip to
      // the "analyze" stage right after the file has been handed over.
      const request = uploadLogFile(file);
      setStage('analyze');
      const job = await request;
      setStage('done');
      setResult(job);
      onComplete?.(job);
    } catch (e) {
      setStage(null);
      setError(e.message);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  const progress = stage === 'upload' ? 25 : stage === 'analyze' ? 65 : stage === 'done' ? 100 : 0;
  const stageIndex = STAGES.findIndex((item) => item.key === stage);

  return (
    <div>
      <div
        className={`upload-zone${dragging ? ' dragging' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !busy) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="icon">
          <Upload size={22} />
        </div>
        <h3>{busy ? `Analyzing ${filename}…` : 'Drop a log file here, or click to browse'}</h3>
        <p>Parsed events are checked against your signatures and the Isolation Forest model.</p>
        <div className="hint">
          Supported: {ALLOWED_EXTENSIONS.join(', ')} · up to {formatBytes(MAX_UPLOAD_BYTES)}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          style={{ display: 'none' }}
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            padding: '10px 14px',
            background: 'var(--critical-bg)',
            border: '1px solid var(--critical-border, var(--critical))',
            borderRadius: 'var(--radius-md)',
            color: 'var(--critical)',
            fontSize: 12.5,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {stage && (
        <div className="analysis-progress" style={{ marginTop: 16 }}>
          <div className="progress-header">
            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{filename}</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-stages">
            {STAGES.map((item, index) => (
              <div
                key={item.key}
                className={`progress-stage${index < stageIndex || stage === 'done' ? ' done' : index === stageIndex ? ' active' : ''}`}
              >
                <div className="stage-dot" />
                {item.label}
              </div>
            ))}
          </div>
          {result && (
            <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--text-secondary)' }}>
              {result.linesProcessed} events processed · {result.threatsFound} high/critical threats ·{' '}
              {result.alertsCreated} alerts created
            </div>
          )}
        </div>
      )}
    </div>
  );
}
