"""Cryptographic helpers for secret encryption at rest (AES-256-GCM) and RFC 6238 TOTP MFA."""
from __future__ import annotations

import base64
import hashlib
import os
import re
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import pyotp

from backend.app.core.config import get_settings

_COMPACT_B32_PREFIX = "e1:"
_GENERAL_ENC_PREFIX = "enc:v1:"
_B32_RE = re.compile(r"^[A-Z2-7]{16,32}$")
_AAD_B32 = b"documento:totp:b32:v1"
_AAD_UTF8 = b"documento:secret:utf8:v1"


def _derive_aes_key() -> bytes:
    """Derives a 256-bit AES key via SHA-256 from configured encryption_key or jwt_secret_key."""
    settings = get_settings()
    key_material = (
        getattr(settings, "encryption_key", "")
        or getattr(settings, "secret_key", "")
        or settings.jwt_secret_key
    )
    if not key_material:
        raise ValueError("Encryption key material is not configured")
    return hashlib.sha256(key_material.encode("utf-8")).digest()


def encrypt_secret(plaintext: str) -> str:
    """Encrypts a secret string using authenticated AES-256-GCM.

    Uses a compact Base85 representation for standard RFC 4648 Base32 TOTP secrets
    (160-bit / 32-char secrets encrypt to 63 ASCII chars, fitting safely inside VARCHAR(64)).
    """
    if not plaintext:
        raise ValueError("Cannot encrypt empty secret")

    aesgcm = AESGCM(_derive_aes_key())
    nonce = os.urandom(12)

    if _B32_RE.match(plaintext) and len(plaintext) % 8 == 0:
        raw_bytes = base64.b32decode(plaintext.encode("ascii"))
        ct_and_tag = aesgcm.encrypt(nonce, raw_bytes, _AAD_B32)
        encoded = base64.b85encode(nonce + ct_and_tag).decode("ascii")
        return f"{_COMPACT_B32_PREFIX}{encoded}"

    ct_and_tag = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), _AAD_UTF8)
    encoded = base64.urlsafe_b64encode(nonce + ct_and_tag).decode("ascii")
    return f"{_GENERAL_ENC_PREFIX}{encoded}"


def decrypt_secret(ciphertext: str) -> str:
    """Decrypts an AES-256-GCM encrypted secret, with backward-compatible passthrough for legacy plaintext."""
    if not ciphertext:
        raise ValueError("Cannot decrypt empty secret")

    if ciphertext.startswith(_COMPACT_B32_PREFIX):
        try:
            blob = base64.b85decode(ciphertext[len(_COMPACT_B32_PREFIX):].encode("ascii"))
            if len(blob) < 28:  # 12-byte nonce + 16-byte GCM tag minimum
                raise ValueError("Truncated ciphertext")
            nonce, ct_and_tag = blob[:12], blob[12:]
            raw_bytes = AESGCM(_derive_aes_key()).decrypt(nonce, ct_and_tag, _AAD_B32)
            return base64.b32encode(raw_bytes).decode("ascii")
        except Exception as exc:
            raise ValueError("Failed to decrypt secret") from exc

    if ciphertext.startswith(_GENERAL_ENC_PREFIX):
        try:
            blob = base64.urlsafe_b64decode(ciphertext[len(_GENERAL_ENC_PREFIX):].encode("ascii"))
            if len(blob) < 28:
                raise ValueError("Truncated ciphertext")
            nonce, ct_and_tag = blob[:12], blob[12:]
            pt_bytes = AESGCM(_derive_aes_key()).decrypt(nonce, ct_and_tag, _AAD_UTF8)
            return pt_bytes.decode("utf-8")
        except Exception as exc:
            raise ValueError("Failed to decrypt secret") from exc

    # Backward-compatible decode for legacy plaintext secrets stored in existing tests/records
    return ciphertext


def generate_totp_secret() -> str:
    """Generates a cryptographically random 160-bit RFC 4648 Base32 TOTP secret."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str, issuer: str = "Documento") -> str:
    """Builds an otpauth:// provisioning URI for authenticator apps (Google Authenticator, 1Password, Authy)."""
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)


def verify_totp_code(secret: str, code: str) -> bool:
    """Verifies a 6-digit RFC 6238 TOTP code with +/- 1 step (30s) clock-skew tolerance."""
    if not secret or not code:
        return False
    clean_code = code.strip()
    if len(clean_code) != 6 or not clean_code.isdigit():
        return False
    try:
        return bool(pyotp.TOTP(secret).verify(clean_code, valid_window=1))
    except Exception:
        return False
