"""
Cyvera backend.

Every route here corresponds 1:1 to a function in the frontend's
src/services/api.js. Keep the JSON shapes the same and the React app
does not need any further changes beyond api.js itself.

Run with:
    uvicorn app.main:app --reload --port 8000

Interactive API docs (auto-generated) will be at:
    http://localhost:8000/docs
"""

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import database
from app.detection import SEVERITY_ORDER, classify_threat_severity, run_detection
from app.parsing import parse_log_content
from app.schemas import AlertStatusUpdate, SettingsPayload, SignaturePayload

logging.basicConfig(level=os.environ.get("CYVERA_LOG_LEVEL", "INFO").upper())
logger = logging.getLogger("cyvera")
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".log", ".txt", ".csv", ".json"}


@asynccontextmanager
async def lifespan(_: FastAPI):
    database.initialize_database()
    yield


app = FastAPI(title="Cyvera API", version="1.0.0", lifespan=lifespan)

cors_origins = os.environ.get("CYVERA_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins.split(",") if origin.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unexpected_error_handler(_, exc: Exception):
    logger.error("Unhandled API error", exc_info=(type(exc), exc, exc.__traceback__))
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


def _event_datetime(item: dict[str, Any]) -> datetime | None:
    try:
        value = datetime.fromisoformat(item["timestamp"].replace("Z", "+00:00"))
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    except (KeyError, TypeError, ValueError):
        return None


def _reference_time(*collections: list[dict[str, Any]]) -> datetime:
    """Newest event time across the stored data, so dashboard windows follow
    the uploaded logs rather than the wall clock (falls back to now if empty)."""
    times = [t for items in collections for item in items if (t := _event_datetime(item))]
    return max(times) if times else datetime.now(timezone.utc)


def _percent_change(current: int, previous: int) -> float:
    if previous == 0:
        return 0.0
    return round((current - previous) * 100 / previous, 1)


# ---------------- Dashboard ----------------

@app.get("/api/dashboard/summary")
def get_dashboard_summary():
    logs = database.list_logs()
    alerts = database.list_alerts()
    cutoff = _reference_time(logs, alerts) - timedelta(hours=24)
    previous_cutoff = cutoff - timedelta(hours=24)
    recent_logs = [log for log in logs if cutoff <= (_event_datetime(log) or datetime.min.replace(tzinfo=timezone.utc))]
    previous_logs = [log for log in logs if previous_cutoff <= (_event_datetime(log) or datetime.min.replace(tzinfo=timezone.utc)) < cutoff]
    recent_alerts = [alert for alert in alerts if cutoff <= (_event_datetime(alert) or datetime.min.replace(tzinfo=timezone.utc))]
    previous_alerts = [alert for alert in alerts if previous_cutoff <= (_event_datetime(alert) or datetime.min.replace(tzinfo=timezone.utc)) < cutoff]
    threats = sum(1 for alert in recent_alerts if alert["severity"] in ("critical", "high"))
    anomalies = sum(1 for alert in recent_alerts if alert["detectionMethod"] == "anomaly")
    previous_threats = sum(1 for alert in previous_alerts if alert["severity"] in ("critical", "high"))
    previous_anomalies = sum(1 for alert in previous_alerts if alert["detectionMethod"] == "anomaly")
    normal_logs = sum(1 for log in recent_logs if log["severity"] in ("info", "low"))
    previous_normal_logs = sum(1 for log in previous_logs if log["severity"] in ("info", "low"))
    return {
        "totalLogs": len(recent_logs),
        "threatsDetected": threats,
        "anomalies": anomalies,
        "normalLogs": normal_logs,
        "deltaTotal": _percent_change(len(recent_logs), len(previous_logs)),
        "deltaThreats": _percent_change(threats, previous_threats),
        "deltaAnomalies": _percent_change(anomalies, previous_anomalies),
        "deltaNormal": _percent_change(normal_logs, previous_normal_logs),
    }


@app.get("/api/dashboard/trend")
def get_trend():
    logs = database.list_logs()
    alerts = database.list_alerts()
    today = _reference_time(logs, alerts).date()
    dates = [today - timedelta(days=offset) for offset in range(6, -1, -1)]
    result = {
        day.isoformat(): {"date": day.isoformat(), "threats": 0, "anomalies": 0, "normal": 0}
        for day in dates
    }
    for log in logs:
        event_time = _event_datetime(log)
        bucket = result.get(event_time.date().isoformat()) if event_time else None
        if bucket and log["severity"] in ("info", "low"):
            bucket["normal"] += 1
    for alert in alerts:
        event_time = _event_datetime(alert)
        bucket = result.get(event_time.date().isoformat()) if event_time else None
        if bucket:
            if alert["detectionMethod"] == "anomaly":
                bucket["anomalies"] += 1
            elif alert["severity"] in ("critical", "high"):
                bucket["threats"] += 1
    return list(result.values())


@app.get("/api/dashboard/severity-distribution")
def get_severity_distribution():
    counts = {severity: 0 for severity in ("critical", "high", "medium", "low", "info")}
    for log in database.list_logs():
        if log["severity"] in counts:
            counts[log["severity"]] += 1
    labels = {
        "critical": ("Critical", "#ff3b5c"),
        "high": ("High", "#ff8c42"),
        "medium": ("Medium", "#ffc233"),
        "low": ("Low", "#4de5ff"),
        "info": ("Info", "#9b8cff"),
    }
    return [
        {"name": labels[severity][0], "value": count, "color": labels[severity][1]}
        for severity, count in counts.items()
    ]


@app.get("/api/dashboard/hourly-activity")
def get_hourly_activity():
    logs = database.list_logs()
    current_hour = _reference_time(logs).replace(minute=0, second=0, microsecond=0)
    buckets = {
        (current_hour - timedelta(hours=offset)).strftime("%Y-%m-%dT%H"): {
            "hour": (current_hour - timedelta(hours=offset)).strftime("%H:00"),
            "logs": 0,
            "threats": 0,
        }
        for offset in range(23, -1, -1)
    }
    for log in logs:
        event_time = _event_datetime(log)
        bucket = buckets.get(event_time.strftime("%Y-%m-%dT%H")) if event_time else None
        if bucket:
            bucket["logs"] += 1
            if log["severity"] in ("critical", "high"):
                bucket["threats"] += 1
    return list(buckets.values())


# ---------------- Logs ----------------

@app.get("/api/logs")
def get_logs(severity: str | None = None, type: str | None = None, search: str | None = None):
    result = database.list_logs(severity, type, search)
    return {"items": result, "total": len(result)}


@app.get("/api/logs/types")
def get_log_types():
    return sorted({log["type"] for log in database.list_logs()})


@app.post("/api/logs/upload")
async def upload_log_file(file: UploadFile = File(...)):
    filename = Path(file.filename or "").name
    if Path(filename).suffix.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported file type. Use .log, .txt, .csv, or .json")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Upload exceeds the 10 MB limit")
    try:
        logs = parse_log_content(content, filename)
        signatures = database.list_signatures(enabled=True)
        results = run_detection(logs, signatures)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        logger.exception("Detection pipeline is unavailable")
        raise HTTPException(status_code=503, detail=str(error)) from error

    detections = results["detections"]
    job_id = database.new_id("JOB")
    signatures_matched: set[str] = set()
    threats_found = 0
    for detection in detections:
        log = detection["log"]
        signature = detection["signature"]
        score = detection["anomalyScore"]
        if signature:
            signatures_matched.add(signature["id"])
            title = signature["name"]
            method = "signature"
            signature_id = signature["id"]
            description = f"Matched detection signature {signature['id']}: {signature['description']}"
            base_severity = signature["severity"]
        else:
            title = "Isolation Forest Anomaly Detected"
            method = "anomaly"
            signature_id = None
            description = f"Event anomaly score {score} exceeded the Isolation Forest boundary."
            base_severity = log["severity"]
        severity = classify_threat_severity(base_severity, score, log["bytes"])
        if severity in ("critical", "high"):
            threats_found += 1
        if severity in ("critical", "high", "medium") and SEVERITY_ORDER[severity] > SEVERITY_ORDER[log["severity"]]:
            log["severity"] = severity
        database.save_alert({
            "id": database.new_id("ALR"),
            "timestamp": log["timestamp"],
            "severity": severity,
            "title": title,
            "description": description,
            "sourceIp": log["sourceIp"],
            "destinationIp": log["destinationIp"],
            "detectionMethod": method,
            "signatureId": signature_id,
            "status": "open",
            "assignedTo": None,
            "relatedLogIds": [log["id"]],
        }, upload_id=job_id)

    database.insert_logs(logs, upload_id=job_id)
    for signature_id in signatures_matched:
        signature = database.get_signature(signature_id)
        if signature:
            signature["matches"] = signature.get("matches", 0) + sum(
                1 for detection in detections
                if detection["signature"] and detection["signature"]["id"] == signature_id
            )
            signature["updatedAt"] = database.now_iso()
            database.save_signature(signature)

    job = {
        "jobId": job_id,
        "filename": filename,
        "status": "completed",
        "stage": "done",
        "progress": 100,
        "linesProcessed": len(logs),
        "processed": len(logs),
        "threatsFound": threats_found,
        "threats": threats_found,
        "alertsCreated": len(detections),
        "acceptedAt": database.now_iso(),
    }
    database.save_job(job)
    logger.info("Analyzed %s events from %s; created %s detections", len(logs), filename, len(detections))
    return job


@app.get("/api/uploads")
def list_uploads():
    items = database.list_jobs()
    return {"items": items, "total": len(items)}


@app.delete("/api/uploads/{job_id}")
def delete_upload(job_id: str):
    result = database.delete_upload(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Upload not found")
    return {"deleted": job_id, **result}


@app.delete("/api/data")
def clear_data(confirm: bool = False):
    """Delete all uploaded logs, alerts and upload records (signatures/settings stay)."""
    if not confirm:
        raise HTTPException(status_code=400, detail="Pass confirm=true to delete all uploaded data")
    return database.clear_all_data()


@app.get("/api/logs/analysis/{job_id}")
def get_analysis_status(job_id: str):
    job = database.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ---------------- Alerts ----------------

@app.get("/api/alerts")
def get_alerts(severity: str | None = None, status: str | None = None, method: str | None = None, search: str | None = None):
    result = database.list_alerts(severity, status, method, search)
    return {"items": result, "total": len(result)}


@app.get("/api/alerts/{alert_id}")
def get_alert(alert_id: str):
    alert = database.get_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    signature = database.get_signature(alert["signatureId"]) if alert.get("signatureId") else None
    logs = database.logs_by_ids(alert.get("relatedLogIds", []))
    return {"alert": alert, "signature": signature, "logs": logs}


@app.patch("/api/alerts/{alert_id}/status")
def update_alert_status(alert_id: str, body: AlertStatusUpdate):
    alert = database.get_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert["status"] = body.status
    alert["updatedAt"] = database.now_iso()
    database.save_alert(alert)
    return alert


# ---------------- Signatures ----------------

@app.get("/api/signatures")
def get_signatures(category: str | None = None, enabled: bool | None = None, severity: str | None = None, search: str | None = None):
    result = database.list_signatures(category, enabled, severity, search)
    return {"items": result, "total": len(result)}


@app.get("/api/signatures/categories")
def get_signature_categories():
    return sorted({signature["category"] for signature in database.list_signatures()})


@app.post("/api/signatures")
def create_signature(payload: SignaturePayload):
    new_sig = payload.model_dump()
    new_sig.update({
        "id": database.new_id("SIG"),
        "createdAt": database.now_iso(),
        "updatedAt": database.now_iso(),
        "matches": 0,
    })
    database.save_signature(new_sig)
    return new_sig


@app.put("/api/signatures/{sig_id}")
def update_signature(sig_id: str, payload: SignaturePayload):
    sig = database.get_signature(sig_id)
    if not sig:
        raise HTTPException(status_code=404, detail="Signature not found")
    existing = sig.copy()
    sig.update(payload.model_dump())
    sig["matches"] = existing.get("matches", 0)
    sig["createdAt"] = existing.get("createdAt", database.now_iso())
    sig["updatedAt"] = database.now_iso()
    database.save_signature(sig)
    return sig


@app.delete("/api/signatures/{sig_id}")
def delete_signature(sig_id: str):
    if not database.delete_signature(sig_id):
        raise HTTPException(status_code=404, detail="Signature not found")
    return {"deleted": sig_id}


@app.post("/api/signatures/{sig_id}/toggle")
def toggle_signature(sig_id: str):
    sig = database.get_signature(sig_id)
    if not sig:
        raise HTTPException(status_code=404, detail="Signature not found")
    sig["enabled"] = not sig["enabled"]
    sig["updatedAt"] = database.now_iso()
    database.save_signature(sig)
    return sig


# ---------------- Settings ----------------

@app.get("/api/settings")
def get_settings():
    return database.get_settings()


@app.put("/api/settings")
def save_settings(payload: SettingsPayload):
    return database.update_settings(payload.model_dump(exclude_unset=True, exclude_none=True))

