"""Small SQLite persistence layer for Cyvera logs, alerts, signatures, and jobs."""

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from app import data

LEGACY_SEED_LOG_IDS = (
    "LOG-78421", "LOG-78422", "LOG-78424", "LOG-78425", "LOG-78427", "LOG-78429", "LOG-78432",
)
LEGACY_SEED_ALERT_IDS = ("ALR-2901", "ALR-2902", "ALR-2903", "ALR-2904", "ALR-2905")

DEFAULT_DATABASE_PATH = Path(__file__).resolve().parent.parent / "cyvera.db"


def database_path() -> Path:
    return Path(os.environ.get("CYVERA_DB_PATH", str(DEFAULT_DATABASE_PATH))).expanduser()


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _decode(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return json.loads(row["payload"]) if row else None


def initialize_database() -> None:
    with connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS logs (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                severity TEXT NOT NULL,
                type TEXT NOT NULL,
                source_ip TEXT NOT NULL,
                payload TEXT NOT NULL,
                upload_id TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_logs_time ON logs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_logs_severity ON logs(severity);
            CREATE TABLE IF NOT EXISTS alerts (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                severity TEXT NOT NULL,
                status TEXT NOT NULL,
                payload TEXT NOT NULL,
                upload_id TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_alerts_time ON alerts(timestamp);
            CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
            CREATE TABLE IF NOT EXISTS signatures (
                id TEXT PRIMARY KEY,
                enabled INTEGER NOT NULL,
                payload TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS analysis_jobs (
                id TEXT PRIMARY KEY,
                payload TEXT NOT NULL
            );
            """
        )
        for table in ("logs", "alerts"):
            columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
            if "upload_id" not in columns:  # databases created before per-upload tracking
                conn.execute(f"ALTER TABLE {table} ADD COLUMN upload_id TEXT")
            conn.execute(f"CREATE INDEX IF NOT EXISTS idx_{table}_upload ON {table}(upload_id)")
        # Older databases were seeded with demo logs/alerts; remove exactly those rows.
        conn.executemany("DELETE FROM logs WHERE id = ?", [(i,) for i in LEGACY_SEED_LOG_IDS])
        conn.executemany("DELETE FROM alerts WHERE id = ?", [(i,) for i in LEGACY_SEED_ALERT_IDS])
        if conn.execute("SELECT COUNT(*) FROM signatures").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO signatures (id, enabled, payload) VALUES (?, ?, ?)",
                [(item["id"], int(item["enabled"]), json.dumps(item)) for item in data.signatures],
            )
        if conn.execute("SELECT COUNT(*) FROM settings").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO settings (key, value) VALUES (?, ?)",
                [(key, json.dumps(value)) for key, value in data.settings.items()],
            )


def list_logs(severity: str | None = None, event_type: str | None = None, search: str | None = None) -> list[dict[str, Any]]:
    clauses: list[str] = []
    values: list[Any] = []
    if severity and severity != "all":
        clauses.append("severity = ?")
        values.append(severity)
    if event_type and event_type != "all":
        clauses.append("type = ?")
        values.append(event_type)
    if search:
        clauses.append("LOWER(payload) LIKE ?")
        values.append(f"%{search.lower()}%")
    query = "SELECT payload FROM logs"
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY timestamp DESC"
    with connection() as conn:
        return [json.loads(row["payload"]) for row in conn.execute(query, values)]


def logs_by_ids(log_ids: list[str]) -> list[dict[str, Any]]:
    if not log_ids:
        return []
    placeholders = ",".join("?" for _ in log_ids)
    with connection() as conn:
        rows = conn.execute(f"SELECT payload FROM logs WHERE id IN ({placeholders})", log_ids)
        return [json.loads(row["payload"]) for row in rows]


def insert_logs(logs: list[dict[str, Any]], upload_id: str | None = None) -> int:
    with connection() as conn:
        cursor = conn.executemany(
            "INSERT OR IGNORE INTO logs (id, timestamp, severity, type, source_ip, payload, upload_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                (item["id"], item["timestamp"], item["severity"], item["type"], item["sourceIp"], json.dumps(item), upload_id)
                for item in logs
            ],
        )
        return cursor.rowcount


def list_alerts(severity: str | None = None, status: str | None = None, method: str | None = None, search: str | None = None) -> list[dict[str, Any]]:
    clauses: list[str] = []
    values: list[Any] = []
    if severity and severity != "all":
        clauses.append("severity = ?")
        values.append(severity)
    if status and status != "all":
        clauses.append("status = ?")
        values.append(status)
    if search:
        clauses.append("LOWER(payload) LIKE ?")
        values.append(f"%{search.lower()}%")
    query = "SELECT payload FROM alerts"
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY timestamp DESC"
    with connection() as conn:
        alerts = [json.loads(row["payload"]) for row in conn.execute(query, values)]
    if method and method != "all":
        alerts = [alert for alert in alerts if alert["detectionMethod"] == method]
    return alerts


def get_alert(alert_id: str) -> dict[str, Any] | None:
    with connection() as conn:
        return _decode(conn.execute("SELECT payload FROM alerts WHERE id = ?", (alert_id,)).fetchone())


def save_alert(alert: dict[str, Any], upload_id: str | None = None) -> None:
    with connection() as conn:
        conn.execute(
            "INSERT INTO alerts (id, timestamp, severity, status, payload, upload_id) VALUES (?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET severity=excluded.severity, status=excluded.status, payload=excluded.payload",
            (alert["id"], alert["timestamp"], alert["severity"], alert["status"], json.dumps(alert), upload_id),
        )


def list_signatures(category: str | None = None, enabled: bool | None = None, severity: str | None = None, search: str | None = None) -> list[dict[str, Any]]:
    clauses: list[str] = []
    values: list[Any] = []
    if category and category != "all":
        clauses.append("json_extract(payload, '$.category') = ?")
        values.append(category)
    if enabled is not None:
        clauses.append("enabled = ?")
        values.append(int(enabled))
    if severity and severity != "all":
        clauses.append("json_extract(payload, '$.severity') = ?")
        values.append(severity)
    if search:
        clauses.append("LOWER(payload) LIKE ?")
        values.append(f"%{search.lower()}%")
    query = "SELECT payload FROM signatures"
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY id"
    with connection() as conn:
        return [json.loads(row["payload"]) for row in conn.execute(query, values)]


def get_signature(signature_id: str) -> dict[str, Any] | None:
    with connection() as conn:
        return _decode(conn.execute("SELECT payload FROM signatures WHERE id = ?", (signature_id,)).fetchone())


def save_signature(signature: dict[str, Any]) -> None:
    with connection() as conn:
        conn.execute(
            "INSERT INTO signatures (id, enabled, payload) VALUES (?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled, payload=excluded.payload",
            (signature["id"], int(signature["enabled"]), json.dumps(signature)),
        )


def delete_signature(signature_id: str) -> bool:
    with connection() as conn:
        cursor = conn.execute("DELETE FROM signatures WHERE id = ?", (signature_id,))
        return cursor.rowcount > 0


def get_settings() -> dict[str, Any]:
    with connection() as conn:
        rows = conn.execute("SELECT key, value FROM settings")
        return {row["key"]: json.loads(row["value"]) for row in rows}


def update_settings(values: dict[str, Any]) -> dict[str, Any]:
    with connection() as conn:
        conn.executemany(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            [(key, json.dumps(value)) for key, value in values.items()],
        )
        rows = conn.execute("SELECT key, value FROM settings")
        return {row["key"]: json.loads(row["value"]) for row in rows}


def save_job(job: dict[str, Any]) -> None:
    with connection() as conn:
        conn.execute("INSERT OR REPLACE INTO analysis_jobs (id, payload) VALUES (?, ?)", (job["jobId"], json.dumps(job)))


def get_job(job_id: str) -> dict[str, Any] | None:
    with connection() as conn:
        return _decode(conn.execute("SELECT payload FROM analysis_jobs WHERE id = ?", (job_id,)).fetchone())


def list_jobs() -> list[dict[str, Any]]:
    """Completed uploads, newest first."""
    with connection() as conn:
        jobs = [json.loads(row["payload"]) for row in conn.execute("SELECT payload FROM analysis_jobs")]
    return sorted(jobs, key=lambda job: job.get("acceptedAt", ""), reverse=True)


def _subtract_signature_matches(conn: sqlite3.Connection, counts: dict[str, int]) -> None:
    for signature_id, amount in counts.items():
        row = conn.execute("SELECT payload FROM signatures WHERE id = ?", (signature_id,)).fetchone()
        if row:
            signature = json.loads(row["payload"])
            signature["matches"] = max(0, signature.get("matches", 0) - amount)
            conn.execute("UPDATE signatures SET payload = ? WHERE id = ?", (json.dumps(signature), signature_id))


def delete_upload(job_id: str) -> dict[str, int] | None:
    """Remove one upload with its logs and alerts. None if the upload is unknown."""
    with connection() as conn:
        if not conn.execute("SELECT 1 FROM analysis_jobs WHERE id = ?", (job_id,)).fetchone():
            return None
        matches: dict[str, int] = {}
        for row in conn.execute("SELECT payload FROM alerts WHERE upload_id = ?", (job_id,)):
            signature_id = json.loads(row["payload"]).get("signatureId")
            if signature_id:
                matches[signature_id] = matches.get(signature_id, 0) + 1
        alerts_deleted = conn.execute("DELETE FROM alerts WHERE upload_id = ?", (job_id,)).rowcount
        logs_deleted = conn.execute("DELETE FROM logs WHERE upload_id = ?", (job_id,)).rowcount
        conn.execute("DELETE FROM analysis_jobs WHERE id = ?", (job_id,))
        _subtract_signature_matches(conn, matches)
    return {"logsDeleted": logs_deleted, "alertsDeleted": alerts_deleted}


def clear_all_data() -> dict[str, int]:
    """Remove every log, alert and upload record; signatures and settings are kept."""
    with connection() as conn:
        alerts_deleted = conn.execute("DELETE FROM alerts").rowcount
        logs_deleted = conn.execute("DELETE FROM logs").rowcount
        uploads_deleted = conn.execute("DELETE FROM analysis_jobs").rowcount
        for row in conn.execute("SELECT id, payload FROM signatures").fetchall():
            signature = json.loads(row["payload"])
            signature["matches"] = 0
            conn.execute("UPDATE signatures SET payload = ? WHERE id = ?", (json.dumps(signature), row["id"]))
    return {"logsDeleted": logs_deleted, "alertsDeleted": alerts_deleted, "uploadsDeleted": uploads_deleted}


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10].upper()}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
