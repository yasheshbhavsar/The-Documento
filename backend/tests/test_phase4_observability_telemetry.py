"""Phase 4 Comprehensive Production Observability & Telemetry Test Suite

Validates:
1. /metrics Prometheus endpoint returns 200 OK with compliant text/plain exposition format
2. HTTP request metrics and latency histogram buckets increment on incoming traffic
3. Gauges (active DB connections, OCR queue depth, active cases by stage) update correctly
4. SOP statutory evaluation metric counters track verdicts
5. Grafana dashboard definitions exist, are valid JSON, and map to exported metrics
"""
import json
from pathlib import Path
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.observability import metrics_collector


def test_metrics_endpoint_exposition_format():
    """GET /metrics must return standard Prometheus text format 0.0.4."""
    client = TestClient(app)
    response = client.get("/metrics")

    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    assert "version=0.0.4" in response.headers["content-type"]

    body = response.text
    assert "# HELP http_requests_total" in body
    assert "# TYPE http_requests_total counter" in body
    assert "# HELP http_request_duration_seconds" in body
    assert "# TYPE http_request_duration_seconds histogram" in body
    assert "documento_active_db_connections" in body
    assert "documento_ocr_queue_depth" in body
    assert "documento_active_cases" in body
    assert "documento_sop_audits_total" in body


def test_metrics_middleware_tracks_http_traffic():
    """Middleware measures latency and increments request counter on API calls."""
    client = TestClient(app)

    # Issue requests to a registered health endpoint
    resp1 = client.get("/api/v1/health")
    assert resp1.status_code == 200

    resp_metrics = client.get("/metrics")
    assert resp_metrics.status_code == 200
    body = resp_metrics.text

    # Verify counter and histogram buckets were recorded
    assert 'http_requests_total{method="GET",endpoint="/api/v1/health",status="200"}' in body
    assert 'http_request_duration_seconds_count{method="GET",endpoint="/api/v1/health"}' in body
    assert 'http_request_duration_seconds_bucket{method="GET",endpoint="/api/v1/health",le="+Inf"}' in body


def test_metrics_gauges_and_sop_counters():
    """Gauges and business metrics update dynamically."""
    metrics_collector.set_ocr_queue_depth(7)
    metrics_collector.set_active_db_connections(4)
    metrics_collector.set_active_cases("REVIEW", 18)
    metrics_collector.record_sop_audit("HIGH_APPROVAL_POTENTIAL")

    client = TestClient(app)
    resp = client.get("/metrics")
    assert resp.status_code == 200
    body = resp.text

    assert "documento_ocr_queue_depth 7" in body
    assert "documento_active_db_connections 4" in body
    assert 'documento_active_cases{status="REVIEW"} 18' in body
    assert 'documento_sop_audits_total{verdict="HIGH_APPROVAL_POTENTIAL"} 1' in body


def test_grafana_dashboard_json_validity():
    """Production Grafana dashboard is valid JSON and contains required SLI panels."""
    repo_root = Path(__file__).resolve().parent.parent.parent
    dashboard_path = repo_root / "deploy" / "grafana" / "dashboards" / "documento_ops.json"
    if not dashboard_path.exists():
        dashboard_path = repo_root / "infra" / "monitoring" / "grafana" / "dashboards" / "documento_ops.json"

    assert dashboard_path.exists(), f"Dashboard not found at {dashboard_path}"

    with open(dashboard_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "title" in data
    assert "panels" in data
    assert len(data["panels"]) >= 5

    titles = [p.get("title") for p in data["panels"] if "title" in p]
    assert any("Latency" in t for t in titles)
    assert any("Throughput" in t or "RPS" in t for t in titles)
    assert any("OCR" in t or "Queue" in t for t in titles)
