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
                payload TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_logs_time ON logs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_logs_severity ON logs(severity);
            CREATE TABLE IF NOT EXISTS alerts (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                severity TEXT NOT NULL,
                status TEXT NOT NULL,
                payload TEXT NOT NULL
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
        if conn.execute("SELECT COUNT(*) FROM logs").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO logs (id, timestamp, severity, type, source_ip, payload) VALUES (?, ?, ?, ?, ?, ?)",
                [
                    (item["id"], item["timestamp"], item["severity"], item["type"], item["sourceIp"], json.dumps(item))
                    for item in data.logs
                ],
            )
        if conn.execute("SELECT COUNT(*) FROM alerts").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO alerts (id, timestamp, severity, status, payload) VALUES (?, ?, ?, ?, ?)",
                [
                    (item["id"], item["timestamp"], item["severity"], item["status"], json.dumps(item))
                    for item in data.alerts
                ],
            )
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


def insert_logs(logs: list[dict[str, Any]]) -> int:
    with connection() as conn:
        cursor = conn.executemany(
            "INSERT OR IGNORE INTO logs (id, timestamp, severity, type, source_ip, payload) VALUES (?, ?, ?, ?, ?, ?)",
            [
                (item["id"], item["timestamp"], item["severity"], item["type"], item["sourceIp"], json.dumps(item))
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


def save_alert(alert: dict[str, Any]) -> None:
    with connection() as conn:
        conn.execute(
            "INSERT INTO alerts (id, timestamp, severity, status, payload) VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET severity=excluded.severity, status=excluded.status, payload=excluded.payload",
            (alert["id"], alert["timestamp"], alert["severity"], alert["status"], json.dumps(alert)),
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


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10].upper()}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
