# Production Incident Response & Disaster Recovery Runbook

**Classification**: Confidential / Operations  
**Compliance**: SOC 2 Type II, ISO 27001, Privacy Act, GDPR  
**Platform**: AI Immigration SaaS Platform  

---

## 1. Incident Severity Definitions

| Severity | Definition | Target MTTR | Examples |
| :--- | :--- | :--- | :--- |
| **SEV-0 (Critical Emergency)** | Platform unavailable for all organizations, confirmed data breach, or unauthorized cross-tenant data exposure. | < 1 hour | Cross-tenant document leak, database corruption, ransomware. |
| **SEV-1 (High Severity)** | Core workflow blocked for an organization (e.g. document upload offline, filing packages cannot be assembled), security vulnerability actively exploitable. | < 4 hours | OCR worker pool dead, payment gateway failure, rate-limiter failure. |
| **SEV-2 (Medium Severity)** | Non-blocking feature failure, performance degradation, transient third-party API timeout. | < 24 hours | Analytics dashboard delayed, email notification retry delay. |
| **SEV-3 (Low Severity)** | Minor UI bug, cosmetic defect, non-critical warning logs. | Next sprint | Typo in error string, non-critical accessibility contrast warning. |

---

## 2. P0/SEV-0 Immediate Containment Protocol

When a data breach or cross-tenant contamination is detected:
1. **Isolate Compromised Services**:
   ```bash
   # Immediately scale down affected worker or web containers
   docker compose -f docker-compose.prod.yml stop backend worker
   ```
2. **Revoke Active Sessions & Tokens**:
   ```sql
   -- Invalidate all active user sessions across the platform
   UPDATE sessions SET revoked_at = NOW() WHERE revoked_at IS NULL;
   ```
3. **Trigger Emergency Secret Rotation**:
   - Generate a new 64-byte `JWT_SECRET_KEY`.
   - Update in AWS Secrets Manager / Vault / `.env.production`.
   - Restart the backend instances to force re-authentication with fresh keys.

---

## 3. Cryptographic Key & Credential Rotation Runbook

### A. JWT Signing Key Rotation
1. Update `JWT_SECRET_KEY` in environment.
2. Restart backend pods/containers.
3. All previous sessions become immediately invalid, requiring re-login with MFA.

### B. Database Password Rotation
1. In PostgreSQL:
   ```sql
   ALTER USER ai_immigration_app WITH PASSWORD 'NEW_SECURE_PASSWORD_HERE';
   ```
2. Update `DATABASE_URL` in `.env.production`.
3. Restart `backend` and `worker` services.
4. Verify `/api/v1/health/ready` returns `status: "ready"`.

### C. MinIO / S3 Access Key Rotation
1. Generate new S3 access key / secret key pair.
2. Update `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` or S3 IAM credentials.
3. Execute canary upload test: verify document upload & presigned URL download works.

---

## 4. Disaster Recovery & Backup Restoration

### Scheduled Backup Policy
- **Full Snapshot**: Every 24 hours at 02:00 UTC with SHA-256 integrity verification.
- **Continuous Archiving**: WAL logs / binlogs synced to cross-region S3 vault.
- **Retention**: 90 daily snapshots, 12 monthly snapshots, 7-year statutory archive.

### Complete Restoration Procedure
1. Verify backup file and checksum integrity:
   ```bash
   python backend/scripts/backup_restore.py verify /backups/snapshot_2026-10-11.json
   ```
2. Initialize clean PostgreSQL instance:
   ```bash
   python backend/scripts/migrate.py
   ```
3. Restore database snapshot:
   ```bash
   python backend/scripts/backup_restore.py restore "$DATABASE_URL" /backups/snapshot_2026-10-11.json
   ```
4. Verify record counts and run the post-recovery verification checklist.

---

## 5. Rollback Procedures

### Containerized Rollback
```bash
# Roll back to previous verified image tag
docker compose -f docker-compose.prod.yml pull backend:v1.8.0
docker compose -f docker-compose.prod.yml up -d --no-deps backend
```

### Database Schema Downgrade
```bash
# Downgrade one revision safely
python -m alembic downgrade -1
```

---

## 6. Dead-Letter Queue (DLQ) Remediation Runbook
1. Query DLQ health:
   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" https://api.ai-immigration.com/api/v1/health/workers
   ```
2. Inspect quarantined jobs and failure reasons.
3. If caused by transient external outage (e.g. OCR API timeout), trigger controlled reprocessing:
   ```python
   WorkerHealthMonitor.reprocess_dlq_job(job_id)
   ```
4. If caused by corrupted file, notify caseworker and request clean evidentiary re-upload.
