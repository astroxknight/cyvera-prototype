"""
In-memory sample data for the Cyvera backend.

This plays the same role as src/data/sampleData.js on the frontend: it's
fake data shaped like what a real log/alert pipeline would produce. Swap
these lists for real database queries later — the route handlers in
main.py don't need to change if you keep the same shapes.
"""

from datetime import datetime, timedelta, timezone


def _minutes_ago(m: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=m)).isoformat()


def _hours_ago(h: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=h)).isoformat()


def _days_ago(d: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=d)).isoformat()


# -------- Logs --------

logs = [
    {
        "id": "LOG-78421", "timestamp": _minutes_ago(2), "sourceIp": "192.168.1.45",
        "destinationIp": "10.0.0.12", "method": "POST", "endpoint": "/api/v1/auth/login",
        "statusCode": 200, "severity": "info", "type": "authentication",
        "message": "Successful login for user admin",
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "bytes": 432,
    },
    {
        "id": "LOG-78422", "timestamp": _minutes_ago(3), "sourceIp": "203.0.113.42",
        "destinationIp": "10.0.0.15", "method": "POST", "endpoint": "/api/v1/auth/login",
        "statusCode": 401, "severity": "medium", "type": "authentication",
        "message": "Failed login attempt - invalid credentials",
        "userAgent": "curl/7.68.0", "bytes": 218,
    },
    {
        "id": "LOG-78424", "timestamp": _minutes_ago(5), "sourceIp": "203.0.113.42",
        "destinationIp": "10.0.0.15", "method": "POST", "endpoint": "/api/v1/auth/login",
        "statusCode": 401, "severity": "high", "type": "brute-force",
        "message": "Repeated failed login attempts detected (12 in 60s)",
        "userAgent": "curl/7.68.0", "bytes": 218,
    },
    {
        "id": "LOG-78425", "timestamp": _minutes_ago(7), "sourceIp": "198.51.100.7",
        "destinationIp": "10.0.0.20", "method": "GET", "endpoint": "/admin/config.php",
        "statusCode": 404, "severity": "high", "type": "reconnaissance",
        "message": "Directory traversal probe detected",
        "userAgent": "sqlmap/1.5.2", "bytes": 512,
    },
    {
        "id": "LOG-78427", "timestamp": _minutes_ago(11), "sourceIp": "45.142.122.18",
        "destinationIp": "10.0.0.30", "method": "POST", "endpoint": "/api/v1/upload",
        "statusCode": 200, "severity": "critical", "type": "malware",
        "message": "Webshell upload signature matched",
        "userAgent": "python-requests/2.31.0", "bytes": 28431,
    },
    {
        "id": "LOG-78429", "timestamp": _minutes_ago(18), "sourceIp": "185.220.101.32",
        "destinationIp": "10.0.0.15", "method": "POST", "endpoint": "/api/v1/auth/login",
        "statusCode": 200, "severity": "critical", "type": "authentication",
        "message": "Login from known Tor exit node",
        "userAgent": "Mozilla/5.0", "bytes": 301,
    },
    {
        "id": "LOG-78432", "timestamp": _minutes_ago(28), "sourceIp": "10.0.0.99",
        "destinationIp": "203.0.113.50", "method": "POST", "endpoint": "/upload/backup",
        "statusCode": 200, "severity": "critical", "type": "exfiltration",
        "message": "Anomalous outbound transfer: 1.2GB in 90s",
        "userAgent": "python-requests/2.31.0", "bytes": 1288490188,
    },
]

# -------- Alerts --------

alerts = [
    {
        "id": "ALR-2901", "timestamp": _minutes_ago(11), "severity": "critical",
        "title": "Webshell Upload Detected",
        "description": "Outbound HTTP POST to /api/v1/upload contained a base64-encoded PHP payload consistent with a webshell.",
        "sourceIp": "45.142.122.18", "destinationIp": "10.0.0.30",
        "detectionMethod": "signature", "signatureId": "SIG-001",
        "status": "open", "assignedTo": None, "relatedLogIds": ["LOG-78427"],
    },
    {
        "id": "ALR-2902", "timestamp": _minutes_ago(18), "severity": "critical",
        "title": "Login Attempt from Tor Exit Node",
        "description": "Authentication attempt from a known Tor exit node flagged by threat intelligence feed.",
        "sourceIp": "185.220.101.32", "destinationIp": "10.0.0.15",
        "detectionMethod": "signature", "signatureId": "SIG-004",
        "status": "investigating", "assignedTo": "soc.analyst", "relatedLogIds": ["LOG-78429"],
    },
    {
        "id": "ALR-2903", "timestamp": _minutes_ago(28), "severity": "critical",
        "title": "Anomalous Outbound Data Transfer",
        "description": "Host 10.0.0.99 transferred 1.2 GB to external endpoint in 90 seconds - 240x baseline.",
        "sourceIp": "10.0.0.99", "destinationIp": "203.0.113.50",
        "detectionMethod": "anomaly", "signatureId": None,
        "status": "open", "assignedTo": None, "relatedLogIds": ["LOG-78432"],
    },
    {
        "id": "ALR-2904", "timestamp": _minutes_ago(5), "severity": "high",
        "title": "Brute-Force Login Pattern",
        "description": "12 failed authentication attempts from same source in 60 seconds.",
        "sourceIp": "203.0.113.42", "destinationIp": "10.0.0.15",
        "detectionMethod": "signature", "signatureId": "SIG-002",
        "status": "investigating", "assignedTo": "soc.analyst", "relatedLogIds": ["LOG-78424"],
    },
    {
        "id": "ALR-2905", "timestamp": _minutes_ago(45), "severity": "medium",
        "title": "Sensitive File Probe",
        "description": "Scan detected for /admin/config.php and similar sensitive paths.",
        "sourceIp": "198.51.100.7", "destinationIp": "10.0.0.20",
        "detectionMethod": "signature", "signatureId": "SIG-003",
        "status": "resolved", "assignedTo": "soc.analyst", "relatedLogIds": ["LOG-78425"],
    },
]

# -------- Signatures --------

signatures = [
    {
        "id": "SIG-001", "name": "Webshell Upload Pattern",
        "description": "Detects base64-encoded PHP payloads in multipart file uploads consistent with a webshell.",
        "pattern": r"POST /api/v1/upload .* eval\(|base64_decode\(|system\(",
        "severity": "critical", "category": "malware", "enabled": True,
        "author": "soc.team", "createdAt": _days_ago(45), "updatedAt": _days_ago(7), "matches": 3,
    },
    {
        "id": "SIG-002", "name": "Brute-Force / Credential Stuffing",
        "description": "Triggers when 10+ failed authentication attempts originate from a single source within 60 seconds.",
        "pattern": "auth.login.failure_count{ip} >= 10 within 60s",
        "severity": "high", "category": "authentication", "enabled": True,
        "author": "soc.team", "createdAt": _days_ago(60), "updatedAt": _days_ago(3), "matches": 17,
    },
    {
        "id": "SIG-003", "name": "Sensitive File Probe",
        "description": "Detects scanning for sensitive files such as .env, wp-config.php, .git/config.",
        "pattern": r"GET /(?:\.env|wp-config\.php|\.git/config|config\.php)",
        "severity": "high", "category": "reconnaissance", "enabled": True,
        "author": "soc.team", "createdAt": _days_ago(38), "updatedAt": _days_ago(12), "matches": 8,
    },
    {
        "id": "SIG-004", "name": "Tor Exit Node Authentication",
        "description": "Flags authentication attempts originating from known Tor exit node IP ranges.",
        "pattern": "ip.src in threat_feed.tor_exit_nodes AND event == auth.attempt",
        "severity": "critical", "category": "threat-intel", "enabled": True,
        "author": "soc.team", "createdAt": _days_ago(20), "updatedAt": _days_ago(1), "matches": 5,
    },
]

# -------- Dashboard chart data --------

trend = [
    {"time": _hours_ago(h), "threats": max(0, 40 - h * 2), "normal": 300 + h * 5}
    for h in range(23, -1, -1)
]

severity_distribution = [
    {"severity": "critical", "count": 12},
    {"severity": "high", "count": 34},
    {"severity": "medium", "count": 58},
    {"severity": "low", "count": 91},
    {"severity": "info", "count": 214},
]

hourly_activity = [
    {"hour": f"{h:02d}:00", "requests": 800 + (h * 37) % 400}
    for h in range(24)
]

settings = {
    "orgName": "Cyvera Demo Org",
    "alertRetentionDays": 90,
    "emailNotifications": True,
    "severityThreshold": "medium",
}
