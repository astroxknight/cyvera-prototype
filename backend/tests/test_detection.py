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


def test_single_failed_login_is_not_brute_force_but_a_burst_is():
    signature = next(item for item in data.signatures if item["id"] == "SIG-002")
    single = _event(1, 218)
    single.update({"method": "POST", "endpoint": "/login", "message": "Failed login attempt"})
    burst = _event(2, 218)
    burst.update({"method": "POST", "endpoint": "/login", "message": "Repeated failed login attempts detected (12 in 60s)"})

    assert not signature_matches(signature, single)
    assert signature_matches(signature, burst)


def test_tor_signature_matches_whole_word_only():
    signature = next(item for item in data.signatures if item["id"] == "SIG-004")
    benign = _event(1, 50)
    benign.update({"endpoint": "/api/v1/monitor", "message": "director viewed storage"})
    tor = _event(2, 50)
    tor.update({"message": "Login from known Tor exit node"})

    assert not signature_matches(signature, benign)
    assert signature_matches(signature, tor)


def test_anomalies_are_capped_to_top_fraction_of_batch():
    events = [_event(index, 100 + index * 40) for index in range(10)]
    events.append(_event(99, 1_000_000_000))

    anomalies = find_anomalies(events)

    assert "LOG-99" in anomalies
    assert len(anomalies) <= 3  # ceil(11 * 0.2)
