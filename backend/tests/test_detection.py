from app import data
from app.detection import classify_threat_severity, find_anomalies, signature_matches


def _event(index, byte_count):
    return {
        "id": f"LOG-{index}",
        "timestamp": "2026-10-25T10:00:00+00:00",
        "sourceIp": "10.0.0.5",
        "destinationIp": "10.0.0.8",
        "method": "GET",
        "endpoint": "/health",
        "statusCode": 200,
        "severity": "info",
        "type": "application",
        "message": "health check",
        "userAgent": "test",
        "bytes": byte_count,
    }


def test_isolation_forest_flags_extreme_transfer_size():
    events = [_event(index, 100 + index * 5) for index in range(20)]
    outlier = _event(99, 1_000_000_000)
    events.append(outlier)

    anomalies = find_anomalies(events)

    assert outlier["id"] in anomalies
    assert 0.5 <= anomalies[outlier["id"]] <= 0.99


def test_seeded_sensitive_file_signature_matches_and_severity_escalates():
    signature = next(item for item in data.signatures if item["id"] == "SIG-003")
    event = _event(1, 32)
    event.update({"method": "GET", "endpoint": "/.env", "message": "Sensitive file probe"})

    assert signature_matches(signature, event)
    assert classify_threat_severity("info", anomaly_score=0.75) == "high"
    assert classify_threat_severity("low", anomaly_score=0.8, byte_count=1_000_000_000) == "critical"
