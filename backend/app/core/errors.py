import logging
import uuid
from typing import Any

from fastapi import Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.app.core.logging import correlation_id_ctx

logger = logging.getLogger(__name__)


class AppException(Exception):
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST, details: Any = None):
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)


class AuthenticationError(AppException):
    def __init__(self, message: str = "Authentication required", details: Any = None):
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED, details=details)


class PermissionDeniedError(AppException):
    def __init__(self, message: str = "Permission denied", details: Any = None):
        super().__init__(message, status_code=status.HTTP_403_FORBIDDEN, details=details)


class TenantIsolationError(AppException):
    def __init__(self, message: str = "Cross-tenant access strictly forbidden", details: Any = None):
        super().__init__(message, status_code=status.HTTP_403_FORBIDDEN, details=details)


class EntityNotFoundError(AppException):
    def __init__(self, entity_name: str, entity_id: Any):
        super().__init__(f"{entity_name} '{entity_id}' not found", status_code=status.HTTP_404_NOT_FOUND)


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found", details: Any = None):
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND, details=details)


class ConflictError(AppException):
    def __init__(self, message: str, details: Any = None):
        super().__init__(message, status_code=status.HTTP_409_CONFLICT, details=details)


class ValidationError(AppException):
    def __init__(self, message: str, details: Any = None):
        super().__init__(message, status_code=status.HTTP_400_BAD_REQUEST, details=details)


def _get_correlation_id(request: Request) -> str:
    return (
        correlation_id_ctx.get()
        or request.headers.get("X-Correlation-ID")
        or request.headers.get("x-correlation-id")
        or str(uuid.uuid4())
    )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    cid = _get_correlation_id(request)
    logger.warning(
        "Application exception: %s (status %s, correlation_id %s)",
        exc.message,
        exc.status_code,
        cid,
        extra={"path": request.url.path, "correlation_id": cid},
    )
    return JSONResponse(
        status_code=exc.status_code,
        headers={"X-Correlation-ID": cid},
        content={
            "error": exc.__class__.__name__,
            "message": exc.message,
            "detail": exc.message,
            "details": jsonable_encoder(exc.details) if exc.details is not None else None,
            "correlation_id": cid,
        },
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    cid = _get_correlation_id(request)
    detail_str = str(exc.detail) if hasattr(exc, "detail") else "HTTP error"
    raw_details = getattr(exc, "detail", None)
    details_val = jsonable_encoder(raw_details) if isinstance(raw_details, (list, dict)) else None

    status_error_map = {
        400: "BadRequest",
        401: "Unauthorized",
        403: "Forbidden",
        404: "NotFound",
        405: "MethodNotAllowed",
        409: "Conflict",
        422: "UnprocessableEntity",
        429: "TooManyRequests",
        500: "InternalServerError",
    }
    error_name = status_error_map.get(exc.status_code, exc.__class__.__name__)
    logger.warning(
        "HTTPException: %s %s (correlation_id %s)",
        exc.status_code,
        detail_str,
        cid,
        extra={"path": request.url.path, "correlation_id": cid},
    )
    return JSONResponse(
        status_code=exc.status_code,
        headers={"X-Correlation-ID": cid},
        content={
            "error": error_name,
            "message": detail_str,
            "detail": detail_str,
            "details": details_val,
            "correlation_id": cid,
        },
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    cid = _get_correlation_id(request)
    errors = exc.errors()
    error_messages = []
    for err in errors:
        loc = " -> ".join(str(l) for l in err.get("loc", []))
        msg = err.get("msg", "")
        error_messages.append(f"{loc}: {msg}" if loc else msg)
    summary_message = "; ".join(error_messages) if error_messages else "Request validation failed"

    logger.warning(
        "RequestValidationError on %s (correlation_id %s): %s",
        request.url.path,
        cid,
        summary_message,
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        headers={"X-Correlation-ID": cid},
        content={
            "error": "RequestValidationError",
            "message": "Invalid request payload or parameters",
            "detail": summary_message,
            "details": jsonable_encoder(errors),
            "correlation_id": cid,
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    cid = _get_correlation_id(request)
    logger.error(
        "Unhandled server exception: %s (correlation_id %s)",
        str(exc),
        cid,
        exc_info=True,
        extra={"path": request.url.path, "correlation_id": cid},
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        headers={"X-Correlation-ID": cid},
        content={
            "error": "InternalServerError",
            "message": "An unexpected server error occurred. Please contact support.",
            "detail": str(exc),
            "details": None,
            "correlation_id": cid,
        },
    )
