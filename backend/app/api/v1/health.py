from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.core.config import get_settings
from backend.app.core.worker_health import WorkerHealthMonitor
from backend.app.db.session import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Standard liveness endpoint."""
    return {"status": "ok", "environment": get_settings().environment}


@router.get("/health/live")
def liveness() -> dict[str, str]:
    """Kubernetes / Docker liveness probe: verifies process is active."""
    return {"status": "alive"}


@router.get("/health/ready")
def readiness(db: Session = Depends(get_db)) -> dict[str, str]:
    """Kubernetes / Docker readiness probe: verifies database connectivity and core services."""
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "ready",
            "database": "connected",
            "environment": get_settings().environment,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service not ready: Database check failed: {e}",
        )


@router.get("/health/workers")
def worker_health() -> dict:
    """Returns telemetry on background workers and Dead Letter Queue."""
    return WorkerHealthMonitor.get_system_health()
