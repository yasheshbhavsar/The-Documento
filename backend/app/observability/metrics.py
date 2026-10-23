"""Production Observability & Telemetry

Prometheus metrics collector, latency histogram tracker, and exposition formatter.
Adheres strictly to Prometheus text-based exposition format 0.0.4 with zero external dependencies.
"""
from __future__ import annotations

import time
import threading
from typing import Dict, List, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class MetricsCollector:
    """Thread-safe Prometheus metrics collector and text exposition serializer."""

    HISTOGRAM_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)

    def __init__(self):
        self._lock = threading.Lock()
        # (method, endpoint, status_code) -> count
        self._http_requests: Dict[Tuple[str, str, str], int] = {}
        # (method, endpoint) -> (sum_duration, count, {bucket: count})
        self._http_durations: Dict[Tuple[str, str], Dict] = {}
        # Gauges
        self._active_db_connections: int = 1
        self._ocr_queue_depth: int = 0
        self._active_cases_by_status: Dict[str, int] = {
            "INTAKE": 0,
            "GATHERING": 0,
            "ASSEMBLY": 0,
            "REVIEW": 0,
            "SUBMITTED": 0,
        }
        self._sop_audits_total: Dict[str, int] = {
            "HIGH_APPROVAL_POTENTIAL": 0,
            "NEEDS_REVISION": 0,
            "CRITICAL_STATUTORY_DEFICIENCY": 0,
        }

    def record_http_request(self, method: str, endpoint: str, status_code: int, duration_seconds: float) -> None:
        """Records an HTTP transaction with status code and latency."""
        norm_endpoint = self._normalize_endpoint(endpoint)
        status_str = str(status_code)
        method_str = method.upper()

        with self._lock:
            # Increment request counter
            key = (method_str, norm_endpoint, status_str)
            self._http_requests[key] = self._http_requests.get(key, 0) + 1

            # Update latency histogram
            dur_key = (method_str, norm_endpoint)
            if dur_key not in self._http_durations:
                self._http_durations[dur_key] = {
                    "sum": 0.0,
                    "count": 0,
                    "buckets": {b: 0 for b in self.HISTOGRAM_BUCKETS},
                }

            entry = self._http_durations[dur_key]
            entry["sum"] += duration_seconds
            entry["count"] += 1
            for b in self.HISTOGRAM_BUCKETS:
                if duration_seconds <= b:
                    entry["buckets"][b] += 1

    def set_ocr_queue_depth(self, depth: int) -> None:
        with self._lock:
            self._ocr_queue_depth = max(0, depth)

    def set_active_db_connections(self, count: int) -> None:
        with self._lock:
            self._active_db_connections = max(0, count)

    def record_sop_audit(self, verdict: str) -> None:
        with self._lock:
            self._sop_audits_total[verdict] = self._sop_audits_total.get(verdict, 0) + 1

    def set_active_cases(self, status: str, count: int) -> None:
        with self._lock:
            self._active_cases_by_status[status.upper()] = count

    def generate_prometheus_text(self) -> str:
        """Generates RFC-compliant Prometheus exposition format output."""
        lines: List[str] = [
            "# HELP http_requests_total Total number of HTTP requests processed by method, endpoint, and status.",
            "# TYPE http_requests_total counter",
        ]

        with self._lock:
            # 1. HTTP requests total
            if not self._http_requests:
                lines.append('http_requests_total{method="GET",endpoint="/health",status="200"} 0')
            else:
                for (m, ep, s), count in sorted(self._http_requests.items()):
                    lines.append(f'http_requests_total{{method="{m}",endpoint="{ep}",status="{s}"}} {count}')

            # 2. HTTP request duration seconds (Histogram)
            lines.append("# HELP http_request_duration_seconds HTTP request execution latency distribution in seconds.")
            lines.append("# TYPE http_request_duration_seconds histogram")
            for (m, ep), data in sorted(self._http_durations.items()):
                cum = 0
                for b in self.HISTOGRAM_BUCKETS:
                    cum += data["buckets"][b]
                    lines.append(f'http_request_duration_seconds_bucket{{method="{m}",endpoint="{ep}",le="{b}"}} {cum}')
                lines.append(f'http_request_duration_seconds_bucket{{method="{m}",endpoint="{ep}",le="+Inf"}} {data["count"]}')
                lines.append(f'http_request_duration_seconds_sum{{method="{m}",endpoint="{ep}"}} {data["sum"]:.6f}')
                lines.append(f'http_request_duration_seconds_count{{method="{m}",endpoint="{ep}"}} {data["count"]}')

            # 3. Active database connections gauge
            lines.append("# HELP documento_active_db_connections Active database connections currently checked out.")
            lines.append("# TYPE documento_active_db_connections gauge")
            lines.append(f"documento_active_db_connections {self._active_db_connections}")

            # 4. OCR asynchronous processing queue depth
            lines.append("# HELP documento_ocr_queue_depth Pending document analysis and OCR tasks in queue.")
            lines.append("# TYPE documento_ocr_queue_depth gauge")
            lines.append(f"documento_ocr_queue_depth {self._ocr_queue_depth}")

            # 5. Cases by status gauge
            lines.append("# HELP documento_active_cases Active cases managed in system by stage.")
            lines.append("# TYPE documento_active_cases gauge")
            for st, cnt in sorted(self._active_cases_by_status.items()):
                lines.append(f'documento_active_cases{{status="{st}"}} {cnt}')

            # 6. SOP Audit Verdicts counter
            lines.append("# HELP documento_sop_audits_total Total Statement of Purpose evaluations by statutory verdict.")
            lines.append("# TYPE documento_sop_audits_total counter")
            for verd, cnt in sorted(self._sop_audits_total.items()):
                lines.append(f'documento_sop_audits_total{{verdict="{verd}"}} {cnt}')

        return "\n".join(lines) + "\n"

    def _normalize_endpoint(self, path: str) -> str:
        """Sanitizes high-cardinality path segments like UUIDs into generic placeholders."""
        parts = path.strip("/").split("/")
        norm_parts = []
        for part in parts:
            # Check UUID
            if len(part) == 36 and part.count("-") == 4:
                norm_parts.append(":id")
            # Check integer ID
            elif part.isdigit():
                norm_parts.append(":id")
            else:
                norm_parts.append(part)
        return "/" + "/".join(norm_parts) if norm_parts else "/"


# Global singleton metrics collector
metrics_collector = MetricsCollector()


class PrometheusMetricsMiddleware(BaseHTTPMiddleware):
    """Middleware measuring request latency and status codes for Prometheus exposition."""

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/metrics":
            return await call_next(request)

        start = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            duration = time.perf_counter() - start
            metrics_collector.record_http_request(
                method=request.method,
                endpoint=request.url.path,
                status_code=status_code,
                duration_seconds=duration,
            )
