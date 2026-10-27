"""
Seed data for the Cyvera backend.

Only detection signatures and default settings are seeded. There are no
pre-loaded logs or alerts: the dashboard stays empty until a log file is
uploaded, and everything it shows is derived from uploaded logs.
"""

from datetime import datetime, timedelta, timezone


def _days_ago(d: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=d)).isoformat()


# -------- Signatures --------

signatures = [
    {
        "id": "SIG-001", "name": "Webshell Upload Pattern",
        "description": "Detects base64-encoded PHP payloads in multipart file uploads consistent with a webshell.",
        "pattern": r"POST /api/v1/upload .* eval\(|base64_decode\(|system\(",
        "severity": "critical", "category": "malware", "enabled": True,
        "author": "soc.team", "createdAt": _days_ago(45), "updatedAt": _days_ago(7), "matches": 0,
    },
    {
        "id": "SIG-002", "name": "Brute-Force / Credential Stuffing",
        "description": "Triggers when 10+ failed authentication attempts originate from a single source within 60 seconds.",
        "pattern": "auth.login.failure_count{ip} >= 10 within 60s",
        "severity": "high", "category": "authentication", "enabled": True,
        "author": "soc.team", "createdAt": _days_ago(60), "updatedAt": _days_ago(3), "matches": 0,
    },
    {
        "id": "SIG-003", "name": "Sensitive File Probe",
        "description": "Detects scanning for sensitive files such as .env, wp-config.php, .git/config.",
        "pattern": r"GET /(?:\.env|wp-config\.php|\.git/config|config\.php)",
        "severity": "high", "category": "reconnaissance", "enabled": True,
        "author": "soc.team", "createdAt": _days_ago(38), "updatedAt": _days_ago(12), "matches": 0,
    },
    {
        "id": "SIG-004", "name": "Tor Exit Node Authentication",
        "description": "Flags authentication attempts originating from known Tor exit node IP ranges.",
        "pattern": "ip.src in threat_feed.tor_exit_nodes AND event == auth.attempt",
        "severity": "critical", "category": "threat-intel", "enabled": True,
        "author": "soc.team", "createdAt": _days_ago(20), "updatedAt": _days_ago(1), "matches": 0,
    },
]

settings = {
    "orgName": "Cyvera Demo Org",
    "alertRetentionDays": 90,
    "emailNotifications": True,
    "severityThreshold": "medium",
}
