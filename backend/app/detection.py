"""Signature and Isolation Forest detection for normalized events."""

import ipaddress
import math
import re
from datetime import datetime
from typing import Any

# Isolation Forest on a tiny batch flags far too many events, so cap the share
# of a batch that can be reported as anomalous (the highest-scoring events win).
MAX_ANOMALY_FRACTION = 0.2
BRUTE_FORCE_THRESHOLD = 10

SEVERITY_ORDER = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}


def _event_text(log: dict[str, Any]) -> str:
    return " ".join(
        str(log.get(key, ""))
        for key in ("method", "endpoint", "message", "userAgent", "type", "sourceIp", "destinationIp")
    )


def signature_matches(signature: dict[str, Any], log: dict[str, Any]) -> bool:
    if not signature.get("enabled", True):
        return False
    pattern = str(signature.get("pattern", "")).strip()
    if not pattern:
        return False
    text = _event_text(log)
    try:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    except re.error:
        pass

    rule = " ".join((signature.get("name", ""), signature.get("description", ""), pattern)).lower()
    event = text.lower()
    if "brute" in rule or "failure_count" in rule or "credential stuffing" in rule:
        # A single failed login is not brute force: only match when the event
        # reports an attempt count ("12 failed ..." or "(12 in 60s)") at/above the threshold.
        count = re.search(r"(\d+)\s+(?:failed|failure)|\((\d+)\s+in\s+\d+\s*s", event)
        attempts = int(next(group for group in count.groups() if group)) if count else 0
        return "login" in event and ("failed" in event or "failure" in event) and attempts >= BRUTE_FORCE_THRESHOLD
    if "webshell" in rule or "malware" in rule:
        return any(term in event for term in ("webshell", "base64_decode", "eval(", "system("))
    if "sensitive file" in rule:
        return bool(re.search(r"(?:/\.env|wp-config\.php|/\.git/config|config\.php)", event))
    if "tor" in rule or "threat_feed" in rule:
        return bool(re.search(r"\btor\b|known malicious", event))
    return False


def _features(log: dict[str, Any]) -> list[float]:
    try:
        hour = datetime.fromisoformat(log["timestamp"].replace("Z", "+00:00")).hour
    except (KeyError, TypeError, ValueError):
        hour = 12
    try:
        source_is_private = float(ipaddress.ip_address(log.get("sourceIp", "")).is_private)
    except ValueError:
        source_is_private = 0.0
    try:
        destination_is_private = float(ipaddress.ip_address(log.get("destinationIp", "")).is_private)
    except ValueError:
        destination_is_private = 0.0
    methods = {"GET": 0, "POST": 1, "PUT": 2, "PATCH": 3, "DELETE": 4, "OTHER": 5}
    method = methods.get(str(log.get("method", "OTHER")).upper(), 5)
    return [
        float(log.get("bytes", 0)),
        float(log.get("statusCode", 0)),
        float(hour),
        float(method),
        source_is_private,
        destination_is_private,
        float(len(str(log.get("endpoint", "")))),
    ]


def find_anomalies(logs: list[dict[str, Any]]) -> dict[str, float]:
    """Return anomalous event IDs mapped to bounded anomaly scores."""
    if len(logs) < 5 or len({_features(log)[0] for log in logs}) < 2:
        return {}
    try:
        from sklearn.ensemble import IsolationForest
    except ImportError as error:
        raise RuntimeError("scikit-learn is required for anomaly detection; install backend requirements") from error

    model = IsolationForest(n_estimators=100, contamination="auto", random_state=42)
    features = [_features(log) for log in logs]
    predictions = model.fit_predict(features)
    decision_scores = model.decision_function(features)
    scored: list[tuple[str, float]] = []
    for log, prediction, decision_score in zip(logs, predictions, decision_scores):
        if prediction == -1:
            score = max(0.5, min(0.99, 0.5 - float(decision_score)))
            scored.append((log["id"], round(score, 3)))
    limit = max(1, math.ceil(len(logs) * MAX_ANOMALY_FRACTION))
    scored.sort(key=lambda item: item[1], reverse=True)
    return dict(scored[:limit])


def classify_threat_severity(base: str, anomaly_score: float | None = None, byte_count: int = 0) -> str:
    severity = base if base in SEVERITY_ORDER else "info"
    if anomaly_score is not None:
        anomaly_severity = "critical" if byte_count >= 100_000_000 else "high" if anomaly_score >= 0.7 else "medium"
        if SEVERITY_ORDER[anomaly_severity] > SEVERITY_ORDER[severity]:
            severity = anomaly_severity
    return severity


def run_detection(logs: list[dict[str, Any]], signatures: list[dict[str, Any]]) -> dict[str, Any]:
    anomaly_scores = find_anomalies(logs)
    detections: list[dict[str, Any]] = []
    for log in logs:
        matched = [signature for signature in signatures if signature_matches(signature, log)]
        anomaly_score = anomaly_scores.get(log["id"])
        for signature in matched:
            detections.append({"log": log, "signature": signature, "anomalyScore": None})
        if anomaly_score is not None:
            detections.append({"log": log, "signature": None, "anomalyScore": anomaly_score})
    return {"detections": detections, "anomalyScores": anomaly_scores}
