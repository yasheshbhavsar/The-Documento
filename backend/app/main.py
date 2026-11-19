from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from backend.app.core.config import get_settings
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError
from backend.app.core.errors import (
    AppException,
    app_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    unhandled_exception_handler,
)
from backend.app.core.logging import setup_logging
from backend.app.core.middleware import (
    CorrelationIdMiddleware,
    SecurityHeadersMiddleware,
    SimpleRateLimiterMiddleware,
)
from starlette.responses import PlainTextResponse
from backend.app.observability import metrics_collector, PrometheusMetricsMiddleware

# Unified v1 API Router
from backend.app.api.v1 import api_router

# Initialize structured logging
setup_logging()
settings = get_settings()

app = FastAPI(
    title="AI Immigration SaaS API",
    version="1.0.0",
    description="Multi-tenant immigration case management and evidence intelligence platform.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=[
        {"name": "authentication", "description": "Login, logout, session lifecycle, password reset, invitations, and MFA"},
        {"name": "organizations", "description": "Multi-tenant organization, branch, team, member, and invitation management"},
        {"name": "cases", "description": "Immigration cases, petition lifecycles, and staff assignments with object-level authorization"},
        {"name": "clients", "description": "Retained client and applicant profiles with strict privacy"},
        {"name": "notifications", "description": "User notifications, alerts, and deadline tracking"},
        {"name": "roles", "description": "Platform roles, permissions, and security boundary assignment rules"},
        {"name": "documents", "description": "Document management, OCR, structured extraction, provenance, and verification"},
        {"name": "findings", "description": "AI discrepancy detection, document validation, and discrepancy resolution"},
        {"name": "rules", "description": "Versioned immigration rules, official sources, and declarative requirement engine"},
        {"name": "foundation", "description": "System foundation, tenant health, and immutable audit log"},
        {"name": "health", "description": "Service health and readiness probes"},
    ],
)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        tags=app.openapi_tags,
    )
    openapi_schema["components"] = openapi_schema.get("components", {})
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Enter JWT Bearer token to authorize API requests in Swagger UI",
        }
    }
    openapi_schema["security"] = [{"BearerAuth": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi

# Exception Handlers
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SimpleRateLimiterMiddleware, max_requests=settings.rate_limit_per_minute)
app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(PrometheusMetricsMiddleware)

# Versioned API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    return {
        "service": "ai-immigration-api",
        "status": "ok",
        "version": "1.0.0",
        "environment": settings.environment,
    }


@app.get("/metrics", response_class=PlainTextResponse, tags=["health"])
def metrics() -> PlainTextResponse:
    """Exposes real-time Prometheus metrics for telemetry and alerting."""
    return PlainTextResponse(
        content=metrics_collector.generate_prometheus_text(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )

