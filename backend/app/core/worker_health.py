"""Worker Health, Heartbeat Monitoring, and Dead-Letter Queue (DLQ) Manager.

Manages asynchronous background processing reliability:
- Worker registration and heartbeat tracking
- Task retry policies with exponential backoff
- Dead-letter queue for persistently failing jobs
- Health telemetry and error diagnostics
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field


@dataclass
class DeadLetterJob:
    job_id: str
    task_name: str
    organization_id: str
    payload: Dict[str, Any]
    error_message: str
    stack_trace: str
    retry_count: int
    first_failed_at: str
    last_failed_at: str
    status: str = "dead_letter"  # dead_letter, quarantined, reprocessed


@dataclass
class WorkerHeartbeat:
    worker_id: str
    worker_type: str  # ocr_worker, ai_worker, notification_worker
    last_heartbeat: datetime
    active_jobs: int = 0
    completed_jobs: int = 0
    failed_jobs: int = 0
    status: str = "healthy"  # healthy, degraded, dead


class WorkerHealthMonitor:
    _workers: Dict[str, WorkerHeartbeat] = {}
    _dlq: Dict[str, DeadLetterJob] = {}

    @classmethod
    def record_heartbeat(
        cls,
        worker_id: str,
        worker_type: str,
        active_jobs: int = 0,
        completed_jobs: int = 0,
        failed_jobs: int = 0,
    ) -> None:
        """Records a periodic heartbeat from an active background worker."""
        now = datetime.now(timezone.utc)
        cls._workers[worker_id] = WorkerHeartbeat(
            worker_id=worker_id,
            worker_type=worker_type,
            last_heartbeat=now,
            active_jobs=active_jobs,
            completed_jobs=completed_jobs,
            failed_jobs=failed_jobs,
            status="healthy",
        )

    @classmethod
    def get_system_health(cls, max_heartbeat_age_seconds: int = 60) -> Dict[str, Any]:
        """Evaluates worker pool liveness and returns operational status."""
        now = datetime.now(timezone.utc)
        healthy_count = 0
        degraded_count = 0
        dead_count = 0

        workers_status = []
        for w_id, w in list(cls._workers.items()):
            age = (now - w.last_heartbeat).total_seconds()
            if age > max_heartbeat_age_seconds * 2:
                w.status = "dead"
                dead_count += 1
            elif age > max_heartbeat_age_seconds:
                w.status = "degraded"
                degraded_count += 1
            else:
                w.status = "healthy"
                healthy_count += 1

            workers_status.append({
                "worker_id": w.worker_id,
                "type": w.worker_type,
                "status": w.status,
                "last_seen_seconds_ago": round(age, 1),
                "active_jobs": w.active_jobs,
                "completed_jobs": w.completed_jobs,
                "failed_jobs": w.failed_jobs,
            })

        overall = "healthy"
        if dead_count > 0:
            overall = "degraded" if healthy_count > 0 else "critical"

        return {
            "status": overall,
            "total_workers": len(cls._workers),
            "healthy_workers": healthy_count,
            "degraded_workers": degraded_count,
            "dead_workers": dead_count,
            "dlq_size": len(cls._dlq),
            "workers": workers_status,
        }

    @classmethod
    def push_to_dead_letter_queue(
        cls,
        job_id: str,
        task_name: str,
        organization_id: str,
        payload: Dict[str, Any],
        error_message: str,
        stack_trace: str = "",
        retry_count: int = 3,
    ) -> DeadLetterJob:
        """Stores a persistently failing job in the Dead Letter Queue for forensic analysis."""
        now = datetime.now(timezone.utc).isoformat()
        dlq_job = DeadLetterJob(
            job_id=job_id,
            task_name=task_name,
            organization_id=organization_id,
            payload=payload,
            error_message=error_message,
            stack_trace=stack_trace,
            retry_count=retry_count,
            first_failed_at=now,
            last_failed_at=now,
        )
        cls._dlq[job_id] = dlq_job
        return dlq_job

    @classmethod
    def list_dlq_jobs(cls, organization_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Lists pending dead-letter jobs with optional organization filtering."""
        jobs = list(cls._dlq.values())
        if organization_id:
            jobs = [j for j in jobs if j.organization_id == organization_id]
        return [
            {
                "job_id": j.job_id,
                "task_name": j.task_name,
                "organization_id": j.organization_id,
                "error_message": j.error_message,
                "retry_count": j.retry_count,
                "first_failed_at": j.first_failed_at,
                "last_failed_at": j.last_failed_at,
                "status": j.status,
            }
            for j in jobs
        ]

    @classmethod
    def reprocess_dlq_job(cls, job_id: str) -> Optional[Dict[str, Any]]:
        """Extracts and marks a dead-letter job for controlled reprocessing."""
        job = cls._dlq.get(job_id)
        if job:
            job.status = "reprocessed"
            return {
                "job_id": job.job_id,
                "task_name": job.task_name,
                "payload": job.payload,
            }
        return None
