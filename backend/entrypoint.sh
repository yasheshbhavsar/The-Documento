#!/usr/bin/env bash
set -e

# Run database migrations to head if DATABASE_URL is configured
if [ -n "$DATABASE_URL" ]; then
    echo "==> Running Alembic migrations to head..."
    if ! alembic -c /app/backend/alembic.ini upgrade head; then
        echo "==> Error: Database migration failed. Aborting startup."
        exit 1
    fi
    echo "==> Migrations applied successfully."
fi

echo "==> Starting application: $@"
exec "$@"
