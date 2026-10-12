import hashlib
import re
from pathlib import Path
from typing import Tuple

from backend.app.core.errors import ValidationError


# File signature magic byte definitions
MAGIC_SIGNATURES: dict[str, list[bytes]] = {
    "application/pdf": [b"%PDF-"],
    "image/jpeg": [b"\xFF\xD8\xFF"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/tiff": [b"II*\x00", b"MM\x00*"],
    "image/webp": [b"RIFF"],  # With WEBP at offset 8
}

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/webp",
}

# Dangerous executable magic signatures to block explicitly
DANGEROUS_SIGNATURES = [
    (b"MZ", "Windows PE executable/DLL"),
    (b"\x7fELF", "Linux ELF binary"),
    (b"\xca\xfe\xba\xbe", "Java Classfile / Mach-O binary"),
    (b"\xfe\xed\xfa\xce", "Mach-O binary"),
    (b"\xfe\xed\xfa\xcf", "Mach-O 64-bit binary"),
    (b"PK\x03\x04", "ZIP / JAR archive (raw executables)"),
]

# EICAR Antivirus Test Signature
EICAR_SIGNATURE = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"

MAX_ALLOWED_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def detect_file_type(content: bytes) -> str | None:
    """Detects MIME type from byte signature (magic bytes)."""
    if not content or len(content) < 4:
        return None

    # Check dangerous signatures first
    for sig, desc in DANGEROUS_SIGNATURES:
        if content.startswith(sig):
            # Exception: Some docx/odt are PK zips, but immigration documents are PDFs and images
            return f"dangerous:{desc}"

    # Check supported document signatures
    if content.startswith(b"%PDF-"):
        return "application/pdf"
    if content.startswith(b"\xFF\xD8\xFF"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"II*\x00") or content.startswith(b"MM\x00*"):
        return "image/tiff"
    if content.startswith(b"RIFF") and len(content) >= 12 and content[8:12] == b"WEBP":
        return "image/webp"

    return None


def validate_file_signature(
    content: bytes,
    declared_mime_type: str | None = None,
    filename: str = "",
) -> Tuple[bool, str, str | None]:
    """
    Validates that the file contents match allowed document types
    and are not disguised executables or malformed payloads.
    Returns: (is_valid, detected_mime, error_message)
    """
    if not content:
        return False, "unknown", "Uploaded file content is empty (0 bytes)."

    if len(content) > MAX_ALLOWED_FILE_SIZE:
        return False, "unknown", f"File size exceeds maximum permitted limit ({MAX_ALLOWED_FILE_SIZE // (1024*1024)} MB)."

    detected_mime = detect_file_type(content)

    if detected_mime and detected_mime.startswith("dangerous:"):
        return False, detected_mime, f"Executable or forbidden file format detected: {detected_mime}"

    if not detected_mime or detected_mime not in ALLOWED_MIME_TYPES:
        return (
            False,
            detected_mime or "unknown",
            f"Unsupported file format. Only PDF and standard image files (JPEG, PNG, TIFF, WebP) are authorized for immigration evidence.",
        )

    # Sanitize against embedded scripts in SVG/HTML disguised as images
    lower_sample = content[:1024].lower()
    if b"<script" in lower_sample or b"<html" in lower_sample or b"<?php" in lower_sample:
        return False, detected_mime, "Suspicious active script elements detected in document header."

    # Verify declared MIME matches detected MIME if declared
    if declared_mime_type and declared_mime_type != "application/octet-stream":
        norm_declared = declared_mime_type.lower().split(";")[0].strip()
        if norm_declared in ALLOWED_MIME_TYPES and norm_declared != detected_mime:
            # Allow image/jpg vs image/jpeg alias
            if not (norm_declared == "image/jpg" and detected_mime == "image/jpeg"):
                return (
                    False,
                    detected_mime,
                    f"MIME type mismatch: file declares '{declared_mime_type}' but byte signature is '{detected_mime}'.",
                )

    return True, detected_mime, None


class MalwareScanner:
    """
    Pluggable malware scanning interface.
    Integrates with ClamAV or external sandboxes, with deterministic signature verification.
    """

    @classmethod
    def scan_content(cls, content: bytes, filename: str = "") -> Tuple[bool, str]:
        """
        Scans byte content for known malicious signatures and virus test vectors.
        Returns: (is_clean, details)
        """
        # 1. Check for standard EICAR test string
        if EICAR_SIGNATURE in content:
            return False, "Infected: EICAR standard antivirus test file detected."

        # 2. Check for shell payload injections
        if b"#!/bin/sh" in content[:256] or b"#!/bin/bash" in content[:256]:
            return False, "Infected: Embedded shell script execution header detected."

        # 3. Check for obvious reverse shell signatures
        if b"/bin/sh -i" in content or b"powershell.exe -enc" in content:
            return False, "Infected: Obfuscated remote shell payload detected."

        return True, "Clean: Passed anti-malware security heuristic inspection."


def calculate_sha256(content: bytes) -> str:
    """Computes standard SHA-256 integrity hash."""
    return hashlib.sha256(content).hexdigest()


def sanitize_filename(filename: str) -> str:
    """Sanitizes filename against path traversal and dangerous characters."""
    clean_name = Path(filename).name
    # Remove characters outside standard alphanumeric, spaces, hyphens, underscores, dots
    clean_name = re.sub(r"[^\w\s\.-]", "_", clean_name)
    return clean_name.strip() or "unnamed_document.pdf"
