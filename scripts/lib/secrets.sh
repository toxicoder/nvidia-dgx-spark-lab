#!/usr/bin/env bash
#
# ## secrets
# Manage lab dashboard secrets vault infrastructure (master key, status).
# Never prints secret values.
#
# @command secrets
# Usage:
#   ./scripts/manage.sh secrets status
#   ./scripts/manage.sh secrets ensure-key
#   ./scripts/manage.sh secrets list [--db-path PATH]
#
# Safety:
#   Read-only status/list (metadata only). ensure-key is idempotent and never echoes the key.

set -euo pipefail

SECRETS_NS="${SECRETS_NS:-dev}"
SECRETS_MASTER_SECRET="${SECRETS_MASTER_SECRET:-lab-dashboard-secrets}"
SECRETS_MASTER_KEY_NAME="${SECRETS_MASTER_KEY_NAME:-master-key}"
DEFAULT_DB_PATH="${REPO_ROOT:-}/dashboard/data/lab-dashboard.db"

# @function secrets_status
# Print master-key secret presence and stored secret count (metadata only).
# @param $1  Optional sqlite DB path override.

secrets_status() {
  log "=== Lab secrets vault status ==="
  echo "Namespace: ${SECRETS_NS}"
  echo "Master key secret: ${SECRETS_MASTER_SECRET}/${SECRETS_MASTER_KEY_NAME}"

  if kubectl get secret "${SECRETS_MASTER_SECRET}" -n "${SECRETS_NS}" >/dev/null 2>&1; then
    echo "Master key secret: present"
  else
    warn "Master key secret: missing (run: ./scripts/manage.sh secrets ensure-key)"
  fi

  local db_path="${1:-}"
  if [[ -z $db_path ]]; then
    if [[ -f "/data/lab-dashboard.db" ]]; then
      db_path="/data/lab-dashboard.db"
    elif [[ -f ${DEFAULT_DB_PATH} ]]; then
      db_path="${DEFAULT_DB_PATH}"
    fi
  fi

  if [[ -n $db_path && -f $db_path ]] && command -v sqlite3 >/dev/null 2>&1; then
    local count
    count="$(sqlite3 "$db_path" "SELECT COUNT(*) FROM lab_secrets;" 2>/dev/null || echo "?")"
    echo "Stored secrets (metadata count): ${count}"
    echo "Database: ${db_path}"
  else
    echo "Stored secrets: unknown (sqlite3 or DB not available)"
  fi
}

# @function secrets_ensure_key
# Create lab-dashboard-secrets master key in dev namespace if missing (idempotent).
# Never prints the generated key value.

secrets_ensure_key() {
  if kubectl get secret "${SECRETS_MASTER_SECRET}" -n "${SECRETS_NS}" >/dev/null 2>&1; then
    log "Master key secret already exists (${SECRETS_NS}/${SECRETS_MASTER_SECRET})"
    return 0
  fi

  local key_b64
  key_b64="$(openssl rand -base64 32)"
  kubectl create secret generic "${SECRETS_MASTER_SECRET}" -n "${SECRETS_NS}" \
    --from-literal="${SECRETS_MASTER_KEY_NAME}=${key_b64}"
  log "Created ${SECRETS_NS}/${SECRETS_MASTER_SECRET} (master key not printed)"
}

# @function secrets_list
# List secret names and categories from the dashboard sqlite vault.
# @param --db-path  Optional database path.
# Never prints secret values.

secrets_list() {
  local db_path=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --db-path)
        shift
        db_path="${1:-}"
        ;;
      *)
        err "Unknown argument: $1"
        return 1
        ;;
    esac
    shift || true
  done

  if [[ -z $db_path ]]; then
    if [[ -f "/data/lab-dashboard.db" ]]; then
      db_path="/data/lab-dashboard.db"
    elif [[ -f ${DEFAULT_DB_PATH} ]]; then
      db_path="${DEFAULT_DB_PATH}"
    fi
  fi

  if [[ -z $db_path || ! -f $db_path ]]; then
    err "Database not found. Pass --db-path or run inside dashboard pod."
    return 1
  fi

  if ! command -v sqlite3 >/dev/null 2>&1; then
    err "sqlite3 required for secrets list"
    return 1
  fi

  sqlite3 -header -column "$db_path" \
    "SELECT name, category, value_hint, k8s_sync_namespace, k8s_sync_secret_name, updated_at FROM lab_secrets ORDER BY name;"
}

# @function secrets_cmd
# CLI dispatcher for secrets subcommands (status, ensure-key, list).
# @param $1  Subcommand name.

secrets_cmd() {
  local sub="${1:-status}"
  shift || true
  case "$sub" in
    status)
      secrets_status "$@"
      ;;
    ensure-key)
      secrets_ensure_key
      ;;
    list)
      secrets_list "$@"
      ;;
    -h | --help | help)
      cat <<EOF
secrets subcommands:
  status [--db-path PATH]   Master key presence + stored secret count (read-only)
  ensure-key                Create lab-dashboard-secrets if missing (idempotent)
  list [--db-path PATH]     Names and categories only (never values)
EOF
      ;;
    *)
      err "Unknown secrets subcommand: $sub"
      secrets_cmd help
      return 1
      ;;
  esac
}
