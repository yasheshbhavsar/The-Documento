import time
import uuid
from collections import defaultdict
from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from backend.app.core.config import get_settings
from backend.app.core.logging import correlation_id_ctx


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        cid = request.headers.get("X-Correlation-ID") or request.headers.get("x-correlation-id") or str(uuid.uuid4())
        token = correlation_id_ctx.set(cid)
        try:
            response: Response = await call_next(request)
            response.headers["X-Correlation-ID"] = cid
            return response
        finally:
            correlation_id_ctx.reset(token)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


class SimpleRateLimiterMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        max_requests: int = 120,
        window_seconds: int = 60,
        auth_max_requests: int = 20,
        cleanup_interval: int = 300,
    ):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.auth_max_requests = auth_max_requests
        self.cleanup_interval = cleanup_interval
        self.last_cleanup = time.time()
        self.request_counts = defaultdict(list)
        self.auth_request_counts = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        """Resolves client IP supporting reverse proxies (X-Forwarded-For, X-Real-IP) with fallback."""
        xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
        if xff:
            ip = xff.split(",")[0].strip()
            if ip:
                return ip
        x_real_ip = request.headers.get("x-real-ip") or request.headers.get("X-Real-IP")
        if x_real_ip:
            ip = x_real_ip.strip()
            if ip:
                return ip
        return request.client.host if request.client else "unknown"

    def _evict_expired(self, now: float) -> None:
        """Evicts expired timestamp records to prevent unbounded memory growth."""
        if now - self.last_cleanup < self.cleanup_interval:
            return
        self.last_cleanup = now
        cutoff = now - self.window_seconds

        keys_to_delete = []
        for ip, timestamps in list(self.request_counts.items()):
            valid = [t for t in timestamps if t > cutoff]
            if valid:
                self.request_counts[ip] = valid
            else:
                keys_to_delete.append(ip)
        for ip in keys_to_delete:
            self.request_counts.pop(ip, None)

        auth_keys_to_delete = []
        for ip, timestamps in list(self.auth_request_counts.items()):
            valid = [t for t in timestamps if t > cutoff]
            if valid:
                self.auth_request_counts[ip] = valid
            else:
                auth_keys_to_delete.append(ip)
        for ip in auth_keys_to_delete:
            self.auth_request_counts.pop(ip, None)

    async def dispatch(self, request: Request, call_next) -> Response:
        client_ip = self._get_client_ip(request)
        # Exempt health check, root probe, docs, and local test client
        if request.url.path in ("/", "/api/v1/health", "/docs", "/openapi.json", "/redoc") or client_ip == "testclient":
            return await call_next(request)
        now = time.time()
        self._evict_expired(now)

        # Dedicated strict rate limiting for authentication and credential-sensitive endpoints
        is_auth_endpoint = any(
            request.url.path.startswith(prefix)
            for prefix in ("/api/v1/auth/login", "/api/v1/auth/password-reset")
        )
        if is_auth_endpoint:
            auth_timestamps = [t for t in self.auth_request_counts[client_ip] if now - t < self.window_seconds]
            if len(auth_timestamps) >= self.auth_max_requests:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "error": "RateLimitExceeded",
                        "message": f"Too many authentication attempts. Limit is {self.auth_max_requests} attempts per minute.",
                    },
                    headers={"Retry-After": str(self.window_seconds)},
                )
            auth_timestamps.append(now)
            self.auth_request_counts[client_ip] = auth_timestamps

        # Clean expired timestamps for general requests
        timestamps = [t for t in self.request_counts[client_ip] if now - t < self.window_seconds]
        if len(timestamps) >= self.max_requests:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "RateLimitExceeded",
                    "message": f"Too many requests. Limit is {self.max_requests} requests per minute.",
                },
                headers={"Retry-After": str(self.window_seconds)},
            )

        timestamps.append(now)
        self.request_counts[client_ip] = timestamps
        return await call_next(request)
