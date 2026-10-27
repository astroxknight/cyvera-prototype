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


PROBE_CSV = (
    "timestamp,sourceIp,destinationIp,method,endpoint,statusCode,bytes,message\n"
    "2026-10-25T10:00:00Z,203.0.113.250,10.0.0.20,GET,/.env,404,32,Sensitive file probe\n"
    "2026-10-25T10:00:01Z,10.0.0.1,10.0.0.2,GET,/health,200,50,Health check\n"
)


def _upload(client, content=PROBE_CSV, name="events.csv"):
    return client.post("/api/logs/upload", files={"file": (name, io.BytesIO(content.encode()), "text/csv")})


def test_fresh_database_has_no_logs_alerts_or_dashboard_data(client):
    assert client.get("/api/logs").json() == {"items": [], "total": 0}
    assert client.get("/api/alerts").json() == {"items": [], "total": 0}
    summary = client.get("/api/dashboard/summary").json()
    assert (summary["totalLogs"], summary["threatsDetected"], summary["anomalies"], summary["normalLogs"]) == (0, 0, 0, 0)
    trend = client.get("/api/dashboard/trend").json()
    assert len(trend) == 7 and all(day["threats"] == day["anomalies"] == day["normal"] == 0 for day in trend)
    assert all(slice_["value"] == 0 for slice_ in client.get("/api/dashboard/severity-distribution").json())
    assert all(hour["logs"] == hour["threats"] == 0 for hour in client.get("/api/dashboard/hourly-activity").json())
    assert all(sig["matches"] == 0 for sig in client.get("/api/signatures").json()["items"])


def test_dashboard_reflects_only_uploaded_logs_even_when_old(client):
    assert _upload(client).status_code == 200  # events are from 2026-10-25, not "now"

    summary = client.get("/api/dashboard/summary").json()
    trend = client.get("/api/dashboard/trend").json()
    severity = {item["name"]: item["value"] for item in client.get("/api/dashboard/severity-distribution").json()}
    activity = client.get("/api/dashboard/hourly-activity").json()

    assert summary["totalLogs"] == 2 and summary["threatsDetected"] >= 1
    assert trend[-1]["date"] == "2026-10-25" and trend[-1]["normal"] >= 1
    assert severity["High"] >= 1 and sum(severity.values()) == 2
    assert sum(hour["logs"] for hour in activity) == 2


def test_alert_detail_returns_related_records_and_status_is_validated(client):
    _upload(client)
    alert = next(
        item for item in client.get("/api/alerts").json()["items"] if item["signatureId"] == "SIG-003"
    )

    detail = client.get(f"/api/alerts/{alert['id']}")

    assert detail.status_code == 200
    assert detail.json()["alert"]["id"] == alert["id"]
    assert detail.json()["signature"]["id"] == "SIG-003"
    assert detail.json()["logs"][0]["id"] == alert["relatedLogIds"][0]
    assert client.patch(f"/api/alerts/{alert['id']}/status", json={"status": "resolved"}).json()["status"] == "resolved"
    assert client.patch(f"/api/alerts/{alert['id']}/status", json={"status": "bad-state"}).status_code == 422


def test_legacy_seeded_logs_and_alerts_are_removed_on_startup(tmp_path, monkeypatch):
    monkeypatch.setenv("CYVERA_DB_PATH", str(tmp_path / "legacy.db"))
    database.initialize_database()
    row = ("2026-10-25T10:00:00+00:00", "info", "application", "10.0.0.1", "{}")
    with database.connection() as conn:
        conn.execute("INSERT INTO logs VALUES ('LOG-78421', ?, ?, ?, ?, ?)", row)
        conn.execute("INSERT INTO logs VALUES ('LOG-REAL0001', ?, ?, ?, ?, ?)", row)
        conn.execute("INSERT INTO alerts VALUES ('ALR-2901', ?, 'high', 'open', '{}')", (row[0],))

    database.initialize_database()

    with database.connection() as conn:
        assert [r["id"] for r in conn.execute("SELECT id FROM logs")] == ["LOG-REAL0001"]
        assert conn.execute("SELECT COUNT(*) FROM alerts").fetchone()[0] == 0


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


def test_open_alert_count_follows_uploads_and_status_changes(client):
    assert client.get("/api/alerts", params={"status": "open"}).json()["total"] == 0

    _upload(client)
    open_alerts = client.get("/api/alerts", params={"status": "open"}).json()
    assert open_alerts["total"] == len(client.get("/api/alerts").json()["items"]) >= 1

    first = open_alerts["items"][0]["id"]
    client.patch(f"/api/alerts/{first}/status", json={"status": "resolved"})
    assert client.get("/api/alerts", params={"status": "open"}).json()["total"] == open_alerts["total"] - 1
