import pytest

from app.parsing import parse_log_content


def test_parse_csv_normalizes_frontend_fields_and_severity():
    content = (
        b"timestamp,source_ip,destination_ip,method,path,status,bytes,message\n"
        b"2026-10-25T10:00:00Z,203.0.113.2,10.0.0.4,POST,/login,401,128,Failed login attempt"
    )

    [event] = parse_log_content(content, "events.csv")

    assert event["sourceIp"] == "203.0.113.2"
    assert event["destinationIp"] == "10.0.0.4"
    assert event["timestamp"] == "2026-10-25T10:00:00+00:00"
    assert event["severity"] == "medium"
    assert event["type"] == "authentication"


def test_parse_apache_access_line_and_classify_sensitive_probe():
    content = b'203.0.113.9 - - [25/Oct/2026:10:00:00 +0000] "GET /.env HTTP/1.1" 404 32'

    [event] = parse_log_content(content, "access.log")

    assert event["endpoint"] == "/.env"
    assert event["timestamp"] == "2026-10-25T10:00:00+00:00"
    assert event["severity"] == "high"


def test_parse_json_array_and_json_lines():
    array = parse_log_content(b'[{"message":"ordinary event","status":200}]', "events.json")
    lines = parse_log_content(b'{"message":"first"}\n{"message":"second"}', "events.json")

    assert len(array) == 1
    assert len(lines) == 2
    assert lines[0]["message"] == "first"


@pytest.mark.parametrize(
    ("content", "filename", "message"),
    [
        (b"", "empty.log", "empty"),
        (b"[]", "empty.json", "No log events"),
        (b"not-json", "broken.json", "Invalid JSON"),
        (b"x\n" * 20_001, "too-many.txt", "20000"),
    ],
    ids=("empty-file", "empty-json-array", "invalid-json", "event-limit"),
)
def test_rejects_invalid_or_oversized_event_sets(content, filename, message):
    with pytest.raises(ValueError, match=message):
        parse_log_content(content, filename)
