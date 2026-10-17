import json
import logging
import sys
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any

correlation_id_ctx: ContextVar[str | None] = ContextVar("correlation_id_ctx", default=None)

SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "mfa_secret",
    "token_hash",
    "passport_number",
    "passport_number_hash",
    "ssn",
    "authorization",
    "api_key",
    "key",
    "pan",
    "cvv",
    "card_number",
    "credit_card",
    "tax_id",
    "tin",
    "national_id",
    "alien_registration_number",
    "uscis_online_account_number",
    "aadhaar",
    "raw_document_content",
    "extracted_text",
    "document_bytes",
    "file_payload",
}


def sanitize_dict(data: dict[str, Any]) -> dict[str, Any]:
    sanitized: dict[str, Any] = {}
    for k, v in data.items():
        if k.lower() in SENSITIVE_KEYS:
            sanitized[k] = "[REDACTED]"
        elif isinstance(v, dict):
            sanitized[k] = sanitize_dict(v)
        elif isinstance(v, list):
            sanitized[k] = [sanitize_dict(item) if isinstance(item, dict) else item for item in v]
        else:
            sanitized[k] = v
    return sanitized


redact_pii = sanitize_dict



class StructuredJsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        cid = getattr(record, "correlation_id", None) or correlation_id_ctx.get()
        log_obj: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "correlation_id": cid,
            "message": record.getMessage(),
        }

        # Include custom extra attributes
        for key, value in record.__dict__.items():
            if key not in {
                "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
                "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
                "created", "msecs", "relativeCreated", "thread", "threadName",
                "processName", "process", "message"
            }:
                if isinstance(value, dict):
                    log_obj[key] = sanitize_dict(value)
                elif key.lower() in SENSITIVE_KEYS:
                    log_obj[key] = "[REDACTED]"
                else:
                    log_obj[key] = value

        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj)


def setup_logging(level: str = "INFO") -> None:
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredJsonFormatter())
    
    # Avoid duplicate handlers
    root_logger.handlers = [handler]
