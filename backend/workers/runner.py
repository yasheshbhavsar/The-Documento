import argparse
import logging
import signal
import sys
import time
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.db.session import SessionLocal
from backend.app.documents.processor import process_document_pipeline
from backend.app.domain.models import OutboxEvent, now_utc

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("ai_immigration.workers.runner")

# Global lifecycle flag for graceful shutdown
_RUNNING = True


def _handle_shutdown_signal(signum, frame):
    global _RUNNING
    sig_name = signal.Signals(signum).name
    logger.info(f"Received shutdown signal {sig_name}. Gracefully stopping worker...")
    _RUNNING = False


def process_outbox_batch(db: Session, batch_size: int = 10) -> int:
    """
    Polls and processes a batch of pending transactional outbox events.
    Returns the count of events successfully processed.
    """
    events = (
        db.query(OutboxEvent)
        .filter(OutboxEvent.status == "pending")
        .order_by(OutboxEvent.created_at.asc())
        .limit(batch_size)
        .all()
    )

    if not events:
        return 0

    processed_count = 0
    for event in events:
        logger.info(f"Processing outbox event: {event.id} ({event.event_type})")
        event_id = event.id
        try:
            if event.event_type == "document.processing.requested":
                payload = event.payload or {}
                doc_id_str = payload.get("document_id")
                if not doc_id_str:
                    raise ValueError(f"Outbox event {event_id} missing document_id in payload.")

                doc_id = UUID(doc_id_str)
                process_document_pipeline(db, doc_id)

            event.status = "published"
            event.published_at = now_utc()
            event.error_message = None
            processed_count += 1
            db.commit()
            logger.info(f"Outbox event {event_id} published successfully.")

        except Exception as e:
            logger.error(f"Failed to process outbox event {event_id}: {e}", exc_info=True)
            db.rollback()

            failed_event = db.query(OutboxEvent).filter_by(id=event_id).first()
            if failed_event:
                failed_event.retry_count += 1
                failed_event.error_message = str(e)
                if failed_event.retry_count >= 5:
                    failed_event.status = "failed"
                    logger.error(f"Outbox event {event_id} marked as failed after 5 retries.")
                db.commit()

    return processed_count


def run_worker(
    poll_interval: float = 2.0,
    batch_size: int = 10,
    once: bool = False,
    session_factory=None,
) -> int:
    """
    Runs the worker polling loop.
    If `once` is True, executes a single pass and returns the processed event count.
    """
    global _RUNNING
    logger.info(
        f"Starting Documento Worker Runner (poll_interval={poll_interval}s, "
        f"batch_size={batch_size}, once={once})"
    )

    # Register OS signals for graceful shutdown
    try:
        signal.signal(signal.SIGINT, _handle_shutdown_signal)
        signal.signal(signal.SIGTERM, _handle_shutdown_signal)
    except (ValueError, AttributeError):
        # In non-main thread or certain Windows contexts, signal handling may be skipped
        pass

    total_processed = 0
    maker = session_factory or SessionLocal

    while _RUNNING:
        session = maker()
        try:
            count = process_outbox_batch(session, batch_size=batch_size)
            total_processed += count
        except Exception as e:
            logger.error(f"Unhandled error in worker polling loop: {e}", exc_info=True)
        finally:
            session.close()

        if once:
            logger.info(f"Single-run complete. Total processed events: {total_processed}")
            break

        # Sleep in small increments for responsive termination
        sleep_elapsed = 0.0
        while _RUNNING and sleep_elapsed < poll_interval:
            time.sleep(min(0.2, poll_interval - sleep_elapsed))
            sleep_elapsed += 0.2

    logger.info("Documento Worker Runner stopped.")
    return total_processed


def main():
    parser = argparse.ArgumentParser(description="Documento Background Worker Runner")
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=2.0,
        help="Polling interval in seconds (default: 2.0)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=10,
        help="Number of events to process per batch (default: 10)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Execute a single polling iteration and exit (for testing/cron)",
    )
    args = parser.parse_args()

    run_worker(
        poll_interval=args.poll_interval,
        batch_size=args.batch_size,
        once=args.once,
    )


if __name__ == "__main__":
    main()
