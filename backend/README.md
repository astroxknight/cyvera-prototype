# Cyvera Backend (FastAPI)

FastAPI service for the Cyvera log analyzer. It parses and normalizes uploaded
logs, applies enabled signatures and an Isolation Forest, classifies alert
severity, and stores logs, alerts, signatures, settings, and analysis jobs in
SQLite. The frontend can use this service without changing its page-level data
contracts.

## Setup

Windows PowerShell:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

macOS/Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for interactive API documentation. In another
terminal, run the frontend from `frontend` with `npm install` and `npm run dev`.
The default API URL is `http://localhost:8000`; set
`VITE_API_BASE_URL=http://localhost:8000` in the frontend environment to
override it. The API accepts requests from the Vite origins by default; set
`CYVERA_CORS_ORIGINS` to a comma-separated allowlist to change them.

## Ingestion and Detection

- Upload accepts UTF-8 `.log`, `.txt`, `.csv`, and `.json` files up to 10 MB
  and 20,000 events. JSON objects/arrays, JSONL, CSV headers, Apache access
  lines, and plain text are supported. CSV/JSON field aliases are normalized
  to the event shape consumed by the frontend.
- Enabled signatures run against each normalized event. Regex signatures work
  directly; the seeded natural-language rules for brute force, webshells,
  sensitive-file probes, and Tor indicators have built-in matching behavior.
- Isolation Forest runs on batches of at least five events with feature
  variation. Smaller or uniform batches skip ML scoring rather than producing
  unreliable results. The model is fit per upload batch and is not a trained
  production baseline.
- SQLite is created at `backend/cyvera.db` on first startup and seeded once
  from `app/data.py`. Set `CYVERA_DB_PATH` to select another database path.
- Upload analysis currently runs synchronously and returns a completed job;
  job results are persisted for the status endpoint.

## Tests

```powershell
cd backend
python -m pytest
```

## Security Notes

This prototype has no authentication, authorization, tenant isolation, or
background job queue. Run it only on a trusted development machine; do not
expose it to an untrusted network or use it to make automated blocking
decisions. Add identity, rate limits, storage retention, and signature review
before deployment.
