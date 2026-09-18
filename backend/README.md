# Cyvera Backend (FastAPI)

A minimal Python backend that mirrors every function in the frontend's
`src/services/api.js`, so the React app can talk to a real server instead
of its in-memory sample data.

## Setup

```bash
cd cyvera-backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Visit http://localhost:8000/docs for interactive, auto-generated API docs
where you can try every endpoint in a browser.

## What's real vs. fake here

- All data still lives in `app/data.py` as Python lists (same role as
  `sampleData.js`). Replace those with real database queries (e.g. via
  SQLAlchemy + SQLite/Postgres) when you're ready.
- File upload / log analysis (`/api/logs/upload`) currently fakes an
  instantly-completed job. This is where you'd plug in real log parsing
  or an ML detection model.
- Signature CRUD and alert status updates persist in memory only — they
  reset every time you restart the server.

## Next steps as you grow this

1. Add a real database (SQLite is the easiest first step) instead of the
   Python lists in `data.py`.
2. Add real log parsing in the upload endpoint.
3. Add authentication if this ever needs to be more than a demo.
