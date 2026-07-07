#!/bin/sh
#
# ## Dashboard container entrypoint
#
# Apply SQLite migrations before handing off to the container command.
# Used by the production dashboard Docker image (`dashboard/Dockerfile`).
#
# **Safety**:
# - Runs `migrate.cjs` once at container start; idempotent schema upgrades only.
# - Does not modify cluster state or inference workloads.
#
# Environment:
#   DATABASE_URL     SQLite connection string (default: file:/data/lab-dashboard.db)
#   MIGRATIONS_DIR   Path to SQL migration files (default: /app/lib/db/migrations)
#
# Usage (internal — invoked by Docker CMD/ENTRYPOINT):
#   docker-entrypoint.sh node server.js
#
set -e

export DATABASE_URL="${DATABASE_URL:-file:/data/lab-dashboard.db}"
export MIGRATIONS_DIR="${MIGRATIONS_DIR:-/app/lib/db/migrations}"

node /app/scripts/migrate.cjs
exec "$@"