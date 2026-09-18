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

import uuid
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import data

app = FastAPI(title="Cyvera API")

# Allows the Vite dev server (localhost:5173) to call this API directly.
# If you use the vite proxy setup instead, this becomes unnecessary but
# it's harmless to leave in.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory "database". Replace with real DB calls (SQLite/Postgres/etc)
# when you're ready - every function below is the only place that would
# need to change.
_signatures = [dict(s) for s in data.signatures]
_alerts = [dict(a) for a in data.alerts]
_analysis_jobs: dict[str, dict] = {}


# ---------------- Dashboard ----------------

@app.get("/api/dashboard/summary")
def get_dashboard_summary():
    total = 214789
    threats = len([a for a in _alerts if a["severity"] in ("critical", "high")])
    anomalies = len([a for a in _alerts if a["detectionMethod"] == "anomaly"])
    threats_scaled = threats * 137 + 2841
    anomalies_scaled = anomalies * 89 + 612
    return {
        "totalLogs": total,
        "threatsDetected": threats_scaled,
        "anomalies": anomalies_scaled,
        "normalLogs": total - threats_scaled - anomalies_scaled,
        "deltaTotal": 4.2,
        "deltaThreats": 12.7,
        "deltaAnomalies": -3.4,
        "deltaNormal": 4.9,
    }


@app.get("/api/dashboard/trend")
def get_trend():
    return data.trend


@app.get("/api/dashboard/severity-distribution")
def get_severity_distribution():
    return data.severity_distribution


@app.get("/api/dashboard/hourly-activity")
def get_hourly_activity():
    return data.hourly_activity


# ---------------- Logs ----------------

@app.get("/api/logs")
def get_logs(severity: Optional[str] = None, type: Optional[str] = None, search: Optional[str] = None):
    result = list(data.logs)
    if severity and severity != "all":
        result = [l for l in result if l["severity"] == severity]
    if type and type != "all":
        result = [l for l in result if l["type"] == type]
    if search:
        q = search.lower()
        result = [
            l for l in result
            if q in l["id"].lower() or q in l["message"].lower()
            or q in l["sourceIp"].lower() or q in l["destinationIp"].lower()
            or q in l["endpoint"].lower()
        ]
    return {"items": result, "total": len(result)}


@app.get("/api/logs/types")
def get_log_types():
    return sorted({l["type"] for l in data.logs})


@app.post("/api/logs/upload")
async def upload_log_file(file: UploadFile = File(...)):
    # Real version: save the file, hand it to your log-parsing/ML pipeline,
    # and track progress by job id. This stub just fakes a completed job.
    job_id = str(uuid.uuid4())
    _analysis_jobs[job_id] = {
        "jobId": job_id,
        "filename": file.filename,
        "status": "completed",
        "progress": 100,
        "linesProcessed": 1000,
        "threatsFound": 3,
    }
    return _analysis_jobs[job_id]


@app.get("/api/logs/analysis/{job_id}")
def get_analysis_status(job_id: str):
    job = _analysis_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ---------------- Alerts ----------------

@app.get("/api/alerts")
def get_alerts(severity: Optional[str] = None, status: Optional[str] = None, method: Optional[str] = None):
    result = list(_alerts)
    if severity and severity != "all":
        result = [a for a in result if a["severity"] == severity]
    if status and status != "all":
        result = [a for a in result if a["status"] == status]
    if method and method != "all":
        result = [a for a in result if a["detectionMethod"] == method]
    return {"items": result, "total": len(result)}


@app.get("/api/alerts/{alert_id}")
def get_alert(alert_id: str):
    alert = next((a for a in _alerts if a["id"] == alert_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


class AlertStatusUpdate(BaseModel):
    status: str


@app.patch("/api/alerts/{alert_id}/status")
def update_alert_status(alert_id: str, body: AlertStatusUpdate):
    alert = next((a for a in _alerts if a["id"] == alert_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert["status"] = body.status
    return alert


# ---------------- Signatures ----------------

@app.get("/api/signatures")
def get_signatures(category: Optional[str] = None, enabled: Optional[bool] = None):
    result = list(_signatures)
    if category and category != "all":
        result = [s for s in result if s["category"] == category]
    if enabled is not None:
        result = [s for s in result if s["enabled"] == enabled]
    return {"items": result, "total": len(result)}


@app.get("/api/signatures/categories")
def get_signature_categories():
    return sorted({s["category"] for s in _signatures})


class SignaturePayload(BaseModel):
    name: str
    description: str
    pattern: str
    severity: str
    category: str
    author: str = "you"


@app.post("/api/signatures")
def create_signature(payload: SignaturePayload):
    from datetime import datetime, timezone
    new_sig = payload.model_dump()
    new_sig.update({
        "id": f"SIG-{len(_signatures) + 1:03d}",
        "enabled": True,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "matches": 0,
    })
    _signatures.append(new_sig)
    return new_sig


@app.put("/api/signatures/{sig_id}")
def update_signature(sig_id: str, payload: SignaturePayload):
    from datetime import datetime, timezone
    sig = next((s for s in _signatures if s["id"] == sig_id), None)
    if not sig:
        raise HTTPException(status_code=404, detail="Signature not found")
    sig.update(payload.model_dump())
    sig["updatedAt"] = datetime.now(timezone.utc).isoformat()
    return sig


@app.delete("/api/signatures/{sig_id}")
def delete_signature(sig_id: str):
    global _signatures
    before = len(_signatures)
    _signatures = [s for s in _signatures if s["id"] != sig_id]
    if len(_signatures) == before:
        raise HTTPException(status_code=404, detail="Signature not found")
    return {"deleted": sig_id}


@app.post("/api/signatures/{sig_id}/toggle")
def toggle_signature(sig_id: str):
    sig = next((s for s in _signatures if s["id"] == sig_id), None)
    if not sig:
        raise HTTPException(status_code=404, detail="Signature not found")
    sig["enabled"] = not sig["enabled"]
    return sig


# ---------------- Settings ----------------

_settings = dict(data.settings)


@app.get("/api/settings")
def get_settings():
    return _settings


@app.put("/api/settings")
def save_settings(payload: dict):
    _settings.update(payload)
    return _settings
