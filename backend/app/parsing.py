"""Parse supported log formats into the stable Cyvera event shape."""

import csv
import io
import ipaddress
import json
import re
import uuid
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

MAX_LOG_RECORDS = 20_000

ALIASES = {
    "id": ("id", "eventid", "logid"),
    "timestamp": ("timestamp", "time", "date", "datetime", "@timestamp"),
    "sourceIp": ("sourceip", "source_ip", "srcip", "clientip", "remoteaddr"),
    "destinationIp": ("destinationip", "destination_ip", "dstip", "serverip", "hostip"),
    "method": ("method", "httpmethod", "verb"),
    "endpoint": ("endpoint", "path", "url", "request", "uri"),
    "statusCode": ("statuscode", "status_code", "status", "httpstatus"),
    "severity": ("severity", "level", "priority"),
    "type": ("type", "category", "eventtype", "event_type"),
    "message": ("message", "msg", "event", "description", "raw"),
    "userAgent": ("useragent", "user_agent", "agent"),
    "bytes": ("bytes", "size", "responsebytes", "response_bytes", "length"),
}

APACHE_PATTERN = re.compile(
    r'^(?P<ip>\S+)\s+\S+\s+\S+\s+\[(?P<time>[^]]+)\]\s+'
    r'"(?P<method>[A-Z]+)\s+(?P<path>\S+)(?:\s+HTTP/[^\"]+)?"\s+'
    r'(?P<status>\d{3})\s+(?P<bytes>\d+|-)'
)
REQUEST_PATTERN = re.compile(r'\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)')
IP_PATTERN = re.compile(r'(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])')


def _key(value: Any) -> str:
    return re.sub(r"[^a-z0-9@]", "", str(value).lower())


def _pick(row: dict[str, Any], field: str, default: Any = None) -> Any:
    aliases = {_key(alias) for alias in ALIASES[field]}
    return next((value for name, value in row.items() if _key(name) in aliases), default)


def _timestamp(value: Any) -> str:
    if isinstance(value, datetime):
        parsed = value
    elif value:
        text = str(value).strip()
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            try:
                parsed = datetime.strptime(text, "%d/%b/%Y:%H:%M:%S %z")
            except (TypeError, ValueError, OverflowError):
                try:
                    parsed = parsedate_to_datetime(text)
                except (TypeError, ValueError, OverflowError):
                    parsed = datetime.now(timezone.utc)
    else:
        parsed = datetime.now(timezone.utc)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat()


def classify_severity(message: str, endpoint: str, status_code: int, byte_count: int) -> str:
    text = f"{message} {endpoint}".lower()
    if any(term in text for term in ("webshell", "ransomware", "exfiltration", "data exfil", "malware")):
        return "critical"
    if any(term in text for term in ("brute force", "brute-force", "directory traversal", "sql injection", "known malicious", "/.env", "wp-config.php", ".git/config")):
        return "high"
    if status_code in (401, 403):
        return "medium"
    if byte_count >= 100_000_000:
        return "high"
    if status_code >= 500:
        return "medium"
    return "info"


def _normalize_ip(value: Any) -> str:
    if not value:
        return "unknown"
    text = str(value).strip()
    try:
        return str(ipaddress.ip_address(text))
    except ValueError:
        return text[:255] or "unknown"


def normalize_log(row: dict[str, Any], fallback_message: str = "") -> dict[str, Any]:
    message = str(_pick(row, "message", fallback_message) or fallback_message).strip()
    endpoint_value = _pick(row, "endpoint", "")
    endpoint = str(endpoint_value or "")[:2048]
    method = str(_pick(row, "method", "") or "").upper()[:16]
    status_value = _pick(row, "statusCode", 0)
    bytes_value = _pick(row, "bytes", 0)
    try:
        status_code = max(0, min(599, int(status_value or 0)))
    except (TypeError, ValueError):
        status_code = 0
    try:
        byte_count = max(0, int(bytes_value or 0))
    except (TypeError, ValueError):
        byte_count = 0

    raw_severity = str(_pick(row, "severity", "") or "").lower()
    severity = raw_severity if raw_severity in {"critical", "high", "medium", "low", "info"} else classify_severity(message, endpoint, status_code, byte_count)
    event_type = str(_pick(row, "type", "") or "").strip().lower()
    if not event_type:
        combined = f"{message} {endpoint}".lower()
        event_type = "authentication" if "auth" in combined or "login" in combined else "security-event" if severity in {"critical", "high"} else "application"

    source_ip = _pick(row, "sourceIp")
    destination_ip = _pick(row, "destinationIp")
    if not source_ip or not destination_ip:
        found_ips = IP_PATTERN.findall(f"{message} {endpoint}")
        if not source_ip and found_ips:
            source_ip = found_ips[0]
        if not destination_ip and len(found_ips) > 1:
            destination_ip = found_ips[1]

    return {
        "id": str(_pick(row, "id", "") or f"LOG-{uuid.uuid4().hex[:8].upper()}"),
        "timestamp": _timestamp(_pick(row, "timestamp")),
        "sourceIp": _normalize_ip(source_ip),
        "destinationIp": _normalize_ip(destination_ip),
        "method": method or "OTHER",
        "endpoint": endpoint or "-",
        "statusCode": status_code,
        "severity": severity,
        "type": event_type[:80],
        "message": message[:4000] or "Unparsed log event",
        "userAgent": str(_pick(row, "userAgent", "") or "unknown")[:1024],
        "bytes": byte_count,
    }


def _parse_text_line(line: str) -> dict[str, Any]:
    match = APACHE_PATTERN.match(line)
    if match:
        groups = match.groupdict()
        return {
            "sourceIp": groups["ip"],
            "timestamp": groups["time"],
            "method": groups["method"],
            "endpoint": groups["path"],
            "statusCode": groups["status"],
            "bytes": groups["bytes"].replace("-", "0"),
            "message": line,
        }
    request = REQUEST_PATTERN.search(line)
    status = re.search(r"\b([1-5]\d\d)\b", line)
    found_ips = IP_PATTERN.findall(line)
    return {
        "sourceIp": found_ips[0] if found_ips else "unknown",
        "destinationIp": found_ips[1] if len(found_ips) > 1 else "unknown",
        "method": request.group(1) if request else "OTHER",
        "endpoint": request.group(2) if request else "-",
        "statusCode": status.group(1) if status else 0,
        "message": line,
    }


def parse_log_content(content: bytes, filename: str) -> list[dict[str, Any]]:
    """Parse JSON, JSONL, CSV, Apache-style, or plain-text log content."""
    try:
        text = content.decode("utf-8-sig").strip()
    except UnicodeDecodeError as error:
        raise ValueError("Log file must be UTF-8 encoded") from error
    if not text:
        raise ValueError("Log file is empty")

    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    rows: list[dict[str, Any]]
    if suffix == "json":
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                parsed = parsed.get("logs", [parsed])
            if not isinstance(parsed, list) or any(not isinstance(item, dict) for item in parsed):
                raise ValueError("JSON log must be an object, an array of objects, or an object with a logs array")
            rows = parsed
        except json.JSONDecodeError:
            rows = []
            try:
                for line in text.splitlines():
                    parsed_line = json.loads(line)
                    if not isinstance(parsed_line, dict):
                        raise ValueError("Each JSONL line must be an object")
                    rows.append(parsed_line)
            except json.JSONDecodeError as error:
                raise ValueError(f"Invalid JSON log: {error.msg}") from error
    elif suffix == "csv":
        rows = list(csv.DictReader(io.StringIO(text)))
        if not rows:
            raise ValueError("CSV file must include a header and at least one event")
    else:
        rows = [_parse_text_line(line) for line in text.splitlines() if line.strip()]

    if not rows:
        raise ValueError("No log events were found")
    if len(rows) > MAX_LOG_RECORDS:
        raise ValueError(f"Log file exceeds the limit of {MAX_LOG_RECORDS} events")
    return [normalize_log(row) for row in rows]
