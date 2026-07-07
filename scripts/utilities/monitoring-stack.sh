#!/usr/bin/env bash
#
# ## monitoring-stack
#
# Observability stack status and verification for Grafana/Prometheus integration.
#
# Usage:
#   ./scripts/utilities/monitoring-stack.sh status [--json]
#   ./scripts/utilities/monitoring-stack.sh verify [--json]
#
# @command monitoring-stack

set -euo pipefail

# shellcheck source=../lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/../lib/paths.sh"
SCRIPT_DIR="$(lab_script_dir 1 utilities)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ -f "${REPO_ROOT}/kubeconfig/config" ]]; then
  export KUBECONFIG="${REPO_ROOT}/kubeconfig/config"
fi

# shellcheck source=../lib/common.sh
source "${REPO_ROOT}/scripts/lib/common.sh"
# shellcheck source=../lib/monitoring.sh
source "${REPO_ROOT}/scripts/lib/monitoring.sh"

# @function usage
# Print monitoring-stack CLI usage to stdout.

usage() {
  cat <<EOF
Usage:
  monitoring-stack.sh status [--json]
  monitoring-stack.sh verify [--json]
EOF
}

# @function cmd_status
# Emit observability stack status JSON.
# @param $1  Optional --json flag.

cmd_status() {
  local json_flag="${1:-}"
  get_monitoring_status_json | if [[ "$json_flag" == "--json" ]]; then cat; else python3 -m json.tool; fi
}

# @function cmd_verify
# Verify Prometheus scrape targets are reachable.
# @param $1  Optional --json flag.

cmd_verify() {
  local json_flag="${1:-}"
  if ! verify_scrape_targets | if [[ "$json_flag" == "--json" ]]; then cat; else python3 -m json.tool; fi; then
    exit 1
  fi
}

# @function main
# CLI entry: dispatch monitoring-stack subcommands.

main() {
  local sub="${1:-status}"
  shift || true
  case "$sub" in
    status) cmd_status "${1:-}" ;;
    verify) cmd_verify "${1:-}" ;;
    -h|--help|help) usage ;;
    *) err "Unknown subcommand: $sub"; usage; exit 1 ;;
  esac
}

main "$@"
