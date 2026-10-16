import hashlib
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from backend.app.core.config import get_settings


class StorageError(Exception):
    """Base exception for document storage errors."""
    pass


class ImmutableFileError(StorageError):
    """Raised when an attempt is made to overwrite an existing immutable document."""
    pass


class IntegrityVerificationError(StorageError):
    """Raised when stored file hash does not match expected hash."""
    pass


@dataclass(frozen=True)
class StoredDocumentArtifact:
    organization_id: UUID
    file_id: UUID
    filename: str
    storage_path: str
    sha256_hash: str
    byte_size: int
    content_type: str
    stored_at: datetime


class StorageBackend(ABC):
    @abstractmethod
    def store_file(
        self,
        organization_id: UUID,
        file_id: UUID,
        filename: str,
        content: bytes,
        content_type: str = "application/octet-stream",
    ) -> StoredDocumentArtifact:
        """Stores a document under strict organization isolation."""
        pass

    @abstractmethod
    def read_file(
        self,
        organization_id: UUID,
        file_id: UUID,
        filename: str,
        expected_hash: str | None = None,
    ) -> tuple[bytes, str]:
        """Reads document bytes and verifies sha256 hash if provided."""
        pass

    @abstractmethod
    def exists(self, organization_id: UUID, file_id: UUID, filename: str) -> bool:
        """Checks if a document exists."""
        pass

    @abstractmethod
    def delete_file(self, organization_id: UUID, file_id: UUID, filename: str) -> bool:
        """Deletes a document under strict organization isolation.

        Returns:
            bool: True if the file was deleted, False if it was already missing (idempotent).

        Raises:
            StorageError: If an unexpected I/O or network failure occurs during deletion.
        """
        pass

    def delete_by_storage_path(self, storage_path: str) -> bool:
        """Convenience method to delete an artifact given its stored storage_path.

        Returns:
            bool: True if deleted, False if already missing.

        Raises:
            StorageError: If deletion encounters an unexpected failure.
        """
        raise NotImplementedError("Storage backend must implement delete_by_storage_path")


class LocalDocumentStorage(StorageBackend):
    def __init__(self, base_dir: Path | str | None = None):
        if base_dir is None:
            self.base_dir = Path(os.environ.get("DOCUMENT_STORAGE_DIR", "./storage_data")).resolve()
        else:
            self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, organization_id: UUID, file_id: UUID, filename: str) -> Path:
        # Sanitize filename to prevent directory traversal
        safe_name = Path(filename).name
        # Organization-isolated directory structure
        path = self.base_dir / str(organization_id) / str(file_id) / safe_name
        return path

    def store_file(
        self,
        organization_id: UUID,
        file_id: UUID,
        filename: str,
        content: bytes,
        content_type: str = "application/octet-stream",
    ) -> StoredDocumentArtifact:
        target_path = self._resolve_path(organization_id, file_id, filename)
        sha256_hash = hashlib.sha256(content).hexdigest()

        if target_path.exists():
            existing_hash = hashlib.sha256(target_path.read_bytes()).hexdigest()
            if existing_hash != sha256_hash:
                raise ImmutableFileError(
                    f"Document {filename} in case/file {file_id} already exists with a different hash."
                )
            # Idempotent re-upload of identical file
            return StoredDocumentArtifact(
                organization_id=organization_id,
                file_id=file_id,
                filename=filename,
                storage_path=str(target_path),
                sha256_hash=sha256_hash,
                byte_size=len(content),
                content_type=content_type,
                stored_at=datetime.now(timezone.utc),
            )

        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(content)

        return StoredDocumentArtifact(
            organization_id=organization_id,
            file_id=file_id,
            filename=filename,
            storage_path=str(target_path),
            sha256_hash=sha256_hash,
            byte_size=len(content),
            content_type=content_type,
            stored_at=datetime.now(timezone.utc),
        )

    def read_file(
        self,
        organization_id: UUID,
        file_id: UUID,
        filename: str,
        expected_hash: str | None = None,
    ) -> tuple[bytes, str]:
        target_path = self._resolve_path(organization_id, file_id, filename)
        if not target_path.exists():
            raise FileNotFoundError(f"Document {filename} not found for organization {organization_id}")

        content = target_path.read_bytes()
        actual_hash = hashlib.sha256(content).hexdigest()
        if expected_hash and actual_hash != expected_hash:
            raise IntegrityVerificationError(
                f"Document hash mismatch: expected {expected_hash}, calculated {actual_hash}"
            )
        return content, actual_hash

    def exists(self, organization_id: UUID, file_id: UUID, filename: str) -> bool:
        return self._resolve_path(organization_id, file_id, filename).exists()

    def delete_file(self, organization_id: UUID, file_id: UUID, filename: str) -> bool:
        target_path = self._resolve_path(organization_id, file_id, filename)
        if not target_path.exists():
            return False
        try:
            target_path.unlink()
            try:
                parent_dir = target_path.parent
                if parent_dir.exists() and not any(parent_dir.iterdir()):
                    parent_dir.rmdir()
            except Exception:
                pass
            return True
        except Exception as e:
            raise StorageError(f"Failed to delete local document {filename}: {e}") from e

    def delete_by_storage_path(self, storage_path: str) -> bool:
        try:
            path = Path(storage_path).resolve()
            if not path.exists():
                return False
            path.unlink()
            try:
                if path.parent.exists() and not any(path.parent.iterdir()):
                    path.parent.rmdir()
            except Exception:
                pass
            return True
        except Exception as e:
            raise StorageError(f"Failed to delete local document at {storage_path}: {e}") from e


class S3DocumentStorage(StorageBackend):
    def __init__(
        self,
        endpoint_url: str,
        bucket_name: str,
        access_key: str = "",
        secret_key: str = "",
        region_name: str = "us-east-1",
    ):
        import boto3
        from botocore.config import Config

        self.bucket_name = bucket_name
        self.s3_client = boto3.client(
            "s3",
            endpoint_url=endpoint_url or None,
            aws_access_key_id=access_key or os.environ.get("AWS_ACCESS_KEY_ID", "localadmin"),
            aws_secret_access_key=secret_key or os.environ.get("AWS_SECRET_ACCESS_KEY", "local_dev_only_change_me"),
            region_name=region_name,
            config=Config(
                signature_version="s3v4",
                connect_timeout=1,
                read_timeout=2,
                retries={"max_attempts": 1},
            ),
        )
        self._ensure_bucket()

    def _ensure_bucket(self):
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except Exception:
            self.s3_client.create_bucket(Bucket=self.bucket_name)

    def _make_key(self, organization_id: UUID, file_id: UUID, filename: str) -> str:
        safe_name = Path(filename).name
        return f"tenants/{organization_id}/documents/{file_id}/{safe_name}"

    def store_file(
        self,
        organization_id: UUID,
        file_id: UUID,
        filename: str,
        content: bytes,
        content_type: str = "application/octet-stream",
    ) -> StoredDocumentArtifact:
        key = self._make_key(organization_id, file_id, filename)
        sha256_hash = hashlib.sha256(content).hexdigest()

        # Check existing object
        try:
            head = self.s3_client.head_object(Bucket=self.bucket_name, Key=key)
            existing_hash = head.get("Metadata", {}).get("sha256")
            if existing_hash and existing_hash != sha256_hash:
                raise ImmutableFileError(
                    f"Document {filename} already exists in bucket with a different hash."
                )
        except ImmutableFileError:
            raise
        except Exception:
            pass

        self.s3_client.put_object(
            Bucket=self.bucket_name,
            Key=key,
            Body=content,
            ContentType=content_type,
            Metadata={"sha256": sha256_hash, "organization_id": str(organization_id)},
        )

        return StoredDocumentArtifact(
            organization_id=organization_id,
            file_id=file_id,
            filename=filename,
            storage_path=f"s3://{self.bucket_name}/{key}",
            sha256_hash=sha256_hash,
            byte_size=len(content),
            content_type=content_type,
            stored_at=datetime.now(timezone.utc),
        )

    def read_file(
        self,
        organization_id: UUID,
        file_id: UUID,
        filename: str,
        expected_hash: str | None = None,
    ) -> tuple[bytes, str]:
        key = self._make_key(organization_id, file_id, filename)
        try:
            resp = self.s3_client.get_object(Bucket=self.bucket_name, Key=key)
            content = resp["Body"].read()
        except Exception as e:
            raise FileNotFoundError(f"Document {filename} not found: {e}")

        actual_hash = hashlib.sha256(content).hexdigest()
        if expected_hash and actual_hash != expected_hash:
            raise IntegrityVerificationError(
                f"Document hash mismatch: expected {expected_hash}, calculated {actual_hash}"
            )
        return content, actual_hash

    def exists(self, organization_id: UUID, file_id: UUID, filename: str) -> bool:
        key = self._make_key(organization_id, file_id, filename)
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=key)
            return True
        except Exception:
            return False

    def delete_file(self, organization_id: UUID, file_id: UUID, filename: str) -> bool:
        key = self._make_key(organization_id, file_id, filename)
        return self._delete_key(key)

    def delete_by_storage_path(self, storage_path: str) -> bool:
        if not storage_path or not isinstance(storage_path, str):
            return False
        if storage_path.startswith("s3://"):
            parts = storage_path[5:].split("/", 1)
            if len(parts) == 2:
                bucket, key = parts
                if bucket != self.bucket_name:
                    raise StorageError(f"Storage path bucket {bucket} does not match configured bucket {self.bucket_name}")
                return self._delete_key(key)
            return False
        elif storage_path.startswith("tenants/"):
            return self._delete_key(storage_path)
        return False

    def _delete_key(self, key: str) -> bool:
        from botocore.exceptions import ClientError
        exists = False
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=key)
            exists = True
        except ClientError as e:
            error_code = str(e.response.get("Error", {}).get("Code", ""))
            if error_code in ("404", "NoSuchKey", "NotFound"):
                return False
            raise StorageError(f"S3 head_object failed for {key}: {e}") from e
        except Exception as e:
            raise StorageError(f"S3 check failed for {key}: {e}") from e

        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            return True
        except Exception as e:
            raise StorageError(f"Failed to delete S3 object {key}: {e}") from e


def get_storage_backend() -> StorageBackend:
    """Returns configured storage backend, falling back to local isolated storage."""
    settings = get_settings()
    if settings.use_local_storage or os.environ.get("USE_LOCAL_STORAGE", "false").lower() in ("true", "1"):
        return LocalDocumentStorage(base_dir=settings.document_storage_dir)
    try:
        storage = S3DocumentStorage(
            endpoint_url=settings.object_storage_endpoint,
            bucket_name=settings.object_storage_bucket,
            access_key=settings.object_storage_access_key,
            secret_key=settings.object_storage_secret_key,
            region_name=settings.object_storage_region,
        )
        return storage
    except Exception:
        # Graceful fallback for local development without running MinIO
        return LocalDocumentStorage(base_dir=settings.document_storage_dir)
