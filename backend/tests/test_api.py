import io

import pytest
from fastapi.testclient import TestClient

from app import database
from app.main import app


@pytest.fixture

def client(tmp_path, monkeypatch):
    monkeypatch.setenv("CYVERA_DB_PATH", str(tmp_path / "cyvera-test.db"))
    with TestClient(app) as test_client:
        yield test_client


def test_existing_log_alert_and_dashboard_contracts_are_served(client):
    logs = client.get("/api/logs")
    alerts = client.get("/api/alerts")
    summary = client.get("/api/dashboard/summary")
    trend = client.get("/api/dashboard/trend").json()
    severity = client.get("/api/dashboard/severity-distribution").json()
    activity = client.get("/api/dashboard/hourly-activity").json()

    assert logs.status_code == 200
    assert {"id", "timestamp", "sourceIp", "destinationIp", "severity", "type"} <= logs.json()["items"][0].keys()
    assert alerts.json()["items"]
    assert {"totalLogs", "threatsDetected", "anomalies", "normalLogs"} <= summary.json().keys()
    assert len(trend) == 7 and {"date", "threats", "anomalies", "normal"} <= trend[0].keys()
    assert {"name", "value", "color"} <= severity[0].keys()
    assert {"hour", "logs", "threats"} <= activity[0].keys()


def test_alert_detail_returns_related_records_and_status_is_validated(client):
    detail = client.get("/api/alerts/ALR-2901")

    assert detail.status_code == 200
    assert detail.json()["alert"]["id"] == "ALR-2901"
    assert detail.json()["signature"]["id"] == "SIG-001"
    assert detail.json()["logs"][0]["id"] == "LOG-78427"
    assert client.patch("/api/alerts/ALR-2901/status", json={"status": "resolved"}).json()["status"] == "resolved"
    assert client.patch("/api/alerts/ALR-2901/status", json={"status": "bad-state"}).status_code == 422


def test_csv_upload_persists_events_and_signature_alerts(client):
    content = (
        "timestamp,sourceIp,destinationIp,method,endpoint,statusCode,bytes,message\n"
        "2026-10-25T10:00:00Z,203.0.113.250,10.0.0.20,GET,/.env,404,32,Sensitive file probe\n"
        "2026-10-25T10:00:01Z,10.0.0.1,10.0.0.2,GET,/health,200,50,Health check\n"
        "2026-10-25T10:00:02Z,10.0.0.1,10.0.0.2,GET,/health,200,51,Health check\n"
        "2026-10-25T10:00:03Z,10.0.0.1,10.0.0.2,GET,/health,200,52,Health check\n"
        "2026-10-25T10:00:04Z,10.0.0.1,10.0.0.2,GET,/health,200,53,Health check\n"
    )
    upload = client.post(
        "/api/logs/upload",
        files={"file": ("events.csv", io.BytesIO(content.encode()), "text/csv")},
    )

    assert upload.status_code == 200
    job = upload.json()
    assert job["status"] == "completed"
    assert job["linesProcessed"] == 5
    assert client.get(f"/api/logs/analysis/{job['jobId']}").json() == job

    logs = client.get("/api/logs", params={"search": "203.0.113.250"}).json()["items"]
    assert len(logs) == 1
    assert logs[0]["severity"] == "high"
    alerts = client.get("/api/alerts", params={"search": "203.0.113.250"}).json()["items"]
    assert any(alert["detectionMethod"] == "signature" and alert["signatureId"] == "SIG-003" for alert in alerts)
    assert database.logs_by_ids([logs[0]["id"]])


def test_upload_rejects_bad_file_type_and_invalid_json(client):
    bad_type = client.post("/api/logs/upload", files={"file": ("events.exe", b"data")})
    bad_json = client.post("/api/logs/upload", files={"file": ("events.json", b"{invalid")})

    assert bad_type.status_code == 415
    assert bad_json.status_code == 422


def test_signature_crud_and_settings_are_persistent(client):
    payload = {
        "name": "Test detection",
        "description": "Detect a test event",
        "pattern": "test-event-marker",
        "severity": "medium",
        "category": "testing",
        "author": "test.analyst",
        "enabled": False,
    }
    created = client.post("/api/signatures", json=payload)

    assert created.status_code == 200
    signature = created.json()
    assert signature["id"].startswith("SIG-")
    assert client.get("/api/signatures", params={"enabled": "false"}).json()["items"][0]["id"] == signature["id"]
    assert client.get("/api/signatures", params={"enabled": "sometimes"}).status_code == 422
    updated = client.put(
        f"/api/signatures/{signature['id']}",
        json={**payload, "name": "Updated detection"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated detection"
    assert client.get("/api/signatures", params={"category": "testing"}).json()["total"] == 1
    assert client.post(f"/api/signatures/{signature['id']}/toggle").json()["enabled"] is True
    assert client.delete(f"/api/signatures/{signature['id']}").json() == {"deleted": signature["id"]}

    settings = client.put("/api/settings", json={"orgName": "Test SOC"})
    assert settings.json()["orgName"] == "Test SOC"
    assert client.get("/api/settings").json()["orgName"] == "Test SOC"
    assert client.put("/api/settings", json={"retentionDays": 1}).status_code == 422


def test_unknown_resources_return_404(client):
    assert client.get("/api/alerts/missing").status_code == 404
    assert client.put("/api/signatures/missing", json={
        "name": "Missing signature",
        "description": "A valid payload for a missing signature",
        "pattern": "anything",
        "severity": "low",
        "category": "test",
    }).status_code == 404
