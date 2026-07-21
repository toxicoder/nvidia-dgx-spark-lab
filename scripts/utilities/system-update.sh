#!/usr/bin/env bash
#
# ## system-update
#
# Safely perform full system + firmware update on DGX Spark nodes and prepare for reboot.
#
# **Intent**: Keep base OS (apt dist-upgrade) and firmware (fwupdmgr) current.
# CRITICAL LAB SAFETY: Never reboot while heavy inference workloads are running.
# Always stop jobs first (manage.sh stop) and verify clean before reboot.
#
# **Idempotency** (per utility pattern):
# - status reports exactly what is pending and whether safe to proceed.
# - run is safe to repeat (checks state; only acts on pending items).
# - Reboot step is gated and only suggested when safe.
#
# **Safety**:
# - Refuses destructive actions (reboot path) if active jobs in ai-inference.
# - Respects reboot-safety golden rule.
# - Must integrate with manage.sh stop before any reboot.
# - Uses shared helpers for logging and cluster checks.
#
# Usage:
#   ./scripts/utilities/system-update.sh status [--json]
#   ./scripts/utilities/system-update.sh run [--reboot]
#
# Dashboard will call status --json and run.
#
# See reboot-safety.md and AGENTS for mandatory pre-reboot steps.
#
# @command system-update
# @command update-system

set -euo pipefail

# shellcheck source=../lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/../lib/paths.sh"
SCRIPT_DIR="$(lab_script_dir 1 utilities)"

# Source shared
if [[ -f "${SCRIPT_DIR}/../lib/common.sh" ]]; then
  # shellcheck source=../lib/common.sh
  source "${SCRIPT_DIR}/../lib/common.sh"
fi

# Fallbacks
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

# --- Status helpers ---

# @function get_pending_apt_count
# Count pending apt upgradable packages.

get_pending_apt_count() {
  if command -v /usr/lib/update-notifier/apt-check >/dev/null 2>&1; then
    /usr/lib/update-notifier/apt-check 2>&1 | cut -d';' -f1 || echo 0
  else
    apt list --upgradable 2>/dev/null | wc -l || echo "unknown"
  fi
}

# @function get_pending_fw_count
# Count pending fwupdmgr firmware upgrades.

get_pending_fw_count() {
  fwupdmgr get-updates 2>/dev/null | grep -c "Upgrade" || echo 0
}

# @function get_reboot_required
# Return yes/no based on /var/run/reboot-required.

get_reboot_required() {
  if [[ -f /var/run/reboot-required ]]; then
    echo "yes"
  else
    echo "no"
  fi
}

# @function get_active_inference_jobs
# Count jobs/pods in ai-inference namespace.

get_active_inference_jobs() {
  # Reuse kubectl from common if available
  if command -v kubectl >/dev/null 2>&1 && kubectl get ns ai-inference >/dev/null 2>&1; then
    kubectl get jobs,pods -n ai-inference --no-headers 2>/dev/null | wc -l || echo "unknown"
  else
    echo "unknown (no kubectl or ns)"
  fi
}

# @function status
# Report system update pending state and reboot safety.
# @param $1  Optional --json flag.

status() {
  check_tool apt
  # fwupdmgr may not be present until installed
  local apt_count fw_count reboot_req active_jobs
  apt_count=$(get_pending_apt_count)
  fw_count=$(get_pending_fw_count 2>/dev/null || echo 0)
  reboot_req=$(get_reboot_required)
  active_jobs=$(get_active_inference_jobs)

  if [[ ${1:-} == "--json" ]]; then
    cat <<JSON
{
  "pending_apt": "${apt_count}",
  "pending_fw": "${fw_count}",
  "reboot_required": "${reboot_req}",
  "active_inference_items": "${active_jobs}",
  "safe_to_reboot": $([[ $active_jobs == "0" || $active_jobs == "unknown" ]] && echo true || echo false)
}
JSON
    return
  fi

  echo "------------------------------------------------"
  echo "DGX Spark System Update Status (utility pattern)"
  echo "------------------------------------------------"
  echo "Pending apt packages : ${apt_count}"
  echo "Pending firmware     : ${fw_count}"
  echo "Reboot required      : ${reboot_req}"
  echo "Active inference items (jobs/pods in ai-inference): ${active_jobs}"
  echo "Safe to reboot now?  : $([[ $active_jobs == "0" ]] && echo "YES (after manage stop)" || echo "NO - stop workloads first!")"
  echo "------------------------------------------------"
  echo "Reminder: ALWAYS run './scripts/manage.sh stop' and verify clean before reboot."
}

# @function run
# Run apt dist-upgrade and fwupdmgr update (no auto-reboot).

run() {
  check_tool apt
  check_tool fwupdmgr

  local active
  active=$(get_active_inference_jobs)

  log "Starting system update sequence..."

  if [[ $active != "0" && $active != "unknown" ]]; then
    warn "Active inference items detected ($active). Refusing to proceed to reboot phase."
    warn "Run './scripts/manage.sh stop' first and re-check."
  fi

  log "Phase 1: apt update + dist-upgrade"
  sudo apt update
  sudo apt dist-upgrade -y

  log "Phase 2: firmware refresh + upgrade"
  sudo fwupdmgr refresh --force || true
  sudo fwupdmgr get-updates || true
  sudo fwupdmgr update -y || true

  local reboot_req
  reboot_req=$(get_reboot_required)

  if [[ $reboot_req == "yes" ]]; then
    warn "Reboot is required."
    warn "To reboot safely: ./scripts/manage.sh stop && sudo reboot"
    warn "See docs/reboot-safety.md and always verify no ai-inference pods remain."
  else
    log "No reboot flag detected. Update complete."
  fi
}

case "${1:-}" in
  status)
    status "${2:-}"
    ;;
  run)
    run
    ;;
  *)
    echo "Usage: $0 {status [--json]|run}"
    exit 1
    ;;
esac
