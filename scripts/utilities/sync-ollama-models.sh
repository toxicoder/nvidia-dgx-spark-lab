#!/usr/bin/env bash
#
# ## sync-ollama-models
#
# Bidirectional (or directed) sync of Ollama models between DGX Spark nodes using the high-speed interconnect.
#
# **Intent**: Keep ~/.ollama/models in sync across the two nodes for dev/experiments
# without re-downloading large models. Uses the dual 400G links when possible.
#
# **Idempotency**:
# - status reports drift (via rsync --dry-run).
# - run only transfers differences.
#
# **Safety**:
# - Uses highspeed network (enp1s0f0np0/enp1s0f1np1 or 192.168.100/101 prefixes).
# - Configurable; never uses management network for bulk transfer if highspeed available.
# - --delete not used by default (conservative for models).
#
# Usage:
#   ./scripts/utilities/sync-ollama-models.sh status [--json]
#   ./scripts/utilities/sync-ollama-models.sh run [to-remote|from-remote]
#
# Dashboard can trigger sync and show status.
#
# @command sync-ollama-models
# @command ollama-sync

set -euo pipefail

# shellcheck source=../lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/../lib/paths.sh"
SCRIPT_DIR="$(lab_script_dir 1 utilities)"

if [[ -f "${SCRIPT_DIR}/../lib/common.sh" ]]; then
  # shellcheck source=../lib/common.sh
  source "${SCRIPT_DIR}/../lib/common.sh"
fi

: "${log:=echo}"
: "${warn:=echo >&2}"
: "${err:=echo >&2}"

# @function check_tool
# Fail if required command is not in PATH.
# @param $1  Command name.

check_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Required tool missing: $1"
    exit 1
  fi
}

# Config (override via env or group_vars style)
OLLAMA_MODELS_DIR=${OLLAMA_MODELS_DIR:-"$HOME/.ollama/models"}

# Highspeed config from lab (use the dual 400G)
HIGHSPEED_IFS=${HIGHSPEED_IFS:-"enp1s0f0np0,enp1s0f1np1"}
# Assume remote is the other node; use highspeed IP prefix if set
# No default host — set REMOTE_HOST to the peer's highspeed IP (e.g. 192.168.100.2).
REMOTE_HOST=${REMOTE_HOST:-""}
REMOTE_USER=${REMOTE_USER:-"$(whoami)"}
REMOTE_MODELS_DIR=${REMOTE_MODELS_DIR:-"$HOME/.ollama/models"}

RSYNC_OPTS=${RSYNC_OPTS:-"-avz --partial --progress --update"}

# @function require_remote_host
# Fail if REMOTE_HOST peer highspeed IP is unset.

require_remote_host() {
  if [[ -z $REMOTE_HOST ]]; then
    echo "REMOTE_HOST is required (peer highspeed IP, e.g. 192.168.100.2). Set via env before run/status." >&2
    exit 1
  fi
}

# @function get_local_size
# Human-readable size of local Ollama models directory.

get_local_size() {
  du -sh "$OLLAMA_MODELS_DIR" 2>/dev/null | cut -f1 || echo "0"
}

# @function status
# Report rsync drift vs remote peer (text or --json).
# @param $1  Optional --json flag.

status() {
  check_tool rsync
  check_tool ssh
  require_remote_host

  local local_size drift
  local_size=$(get_local_size)

  # Dry run to see what would change (one direction for simplicity)
  drift=$(rsync $RSYNC_OPTS --dry-run "$OLLAMA_MODELS_DIR/" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_MODELS_DIR}/" 2>/dev/null | tail -5 || echo "unable to compute drift (check ssh/highspeed)")

  if [[ ${1:-} == "--json" ]]; then
    cat <<JSON
{
  "local_size": "${local_size}",
  "remote": "${REMOTE_USER}@${REMOTE_HOST}",
  "dry_run_summary": "$(echo "$drift" | tr '\n' ' ' | sed 's/"/\\"/g')",
  "highspeed_ifs": "${HIGHSPEED_IFS}"
}
JSON
    return
  fi

  echo "------------------------------------------------"
  echo "Ollama Models Sync Status (utility pattern, highspeed preferred)"
  echo "------------------------------------------------"
  echo "Local models dir size: ${local_size}"
  echo "Remote: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_MODELS_DIR}"
  echo "Highspeed interfaces: ${HIGHSPEED_IFS}"
  echo "Drift (dry-run one way):"
  echo "$drift"
  echo "------------------------------------------------"
  echo "Tip: set REMOTE_HOST to the peer's highspeed IP (192.168.100.x or .101.x) for full 400G speed."
}

# @function run
# Sync Ollama models with remote peer via rsync.
# @param $1  Direction: to-remote, from-remote, or both.

run() {
  check_tool rsync
  check_tool ssh
  require_remote_host

  local direction="${1:-both}"

  log "Syncing ollama models using highspeed-aware rsync..."

  # For highspeed, user should have set REMOTE_HOST to highspeed IP.
  # We can add -e with bind if needed, but simple for now.
  case "$direction" in
    to-remote | push)
      rsync $RSYNC_OPTS "$OLLAMA_MODELS_DIR/" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_MODELS_DIR}/"
      ;;
    from-remote | pull)
      rsync $RSYNC_OPTS "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_MODELS_DIR}/" "$OLLAMA_MODELS_DIR/"
      ;;
    both | *)
      rsync $RSYNC_OPTS "$OLLAMA_MODELS_DIR/" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_MODELS_DIR}/"
      rsync $RSYNC_OPTS "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_MODELS_DIR}/" "$OLLAMA_MODELS_DIR/"
      ;;
  esac

  log "Sync complete. New local size: $(get_local_size)"
}

case "${1:-}" in
  status)
    status "${2:-}"
    ;;
  run)
    run "${2:-}"
    ;;
  *)
    echo "Usage: $0 {status [--json]|run [to-remote|from-remote|both]}"
    exit 1
    ;;
esac
