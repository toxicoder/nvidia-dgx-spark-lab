#!/usr/bin/env bash
#
# ## hermes-stack
#
# Hermes Agent Docker lifecycle on the Spark K3s node.
#
# Usage:
#   ./scripts/utilities/hermes-stack.sh catalog [--json]
#   ./scripts/utilities/hermes-stack.sh status [--json]
#   ./scripts/utilities/hermes-stack.sh start <stack-id> --confirm yes
#   ./scripts/utilities/hermes-stack.sh stop
#
# @command hermes-stack

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
# shellcheck source=../lib/resources.sh
source "${REPO_ROOT}/scripts/lib/resources.sh"
# shellcheck source=../lib/hermes.sh
source "${REPO_ROOT}/scripts/lib/hermes.sh"

# @function usage
# Print hermes-stack CLI usage to stdout.

usage() {
  cat <<EOF
Usage:
  hermes-stack.sh catalog [--json]
  hermes-stack.sh status [--json]
  hermes-stack.sh start <stack-id> --confirm yes
  hermes-stack.sh stop
EOF
}

# @function cmd_catalog
# Emit Hermes Agent stack catalog JSON (pretty-printed unless --json).
# @param $1  Optional --json flag.

cmd_catalog() {
  local json_flag="${1:-}"
  get_hermes_catalog_json | if [[ $json_flag == "--json" ]]; then cat; else jq '.'; fi
}

# @function cmd_status
# Emit Hermes Agent stack status JSON (pretty-printed unless --json).
# @param $1  Optional --json flag.

cmd_status() {
  local json_flag="${1:-}"
  get_hermes_status_json | if [[ $json_flag == "--json" ]]; then cat; else jq '.'; fi
}

# @function cmd_start
# Start Hermes Agent stack after confirmation token validation.
# @param $1  Stack or model identifier.

cmd_start() {
  local stack_id="${1:-}"
  local confirm=""
  shift || true
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --confirm)
        confirm="${2:-}"
        shift 2
        ;;
      *)
        err "Unknown arg: $1"
        exit 1
        ;;
    esac
  done
  if [[ -z $stack_id ]]; then
    err "Stack id required"
    usage
    exit 1
  fi
  export LAB_NON_INTERACTIVE=1
  export LAB_CONFIRM_TOKEN="${confirm:-}"
  start_hermes_stack "$stack_id"
  echo '{"ok":true,"action":"start","stack":"'"$stack_id"'"}'
}

# @function cmd_stop
# Stop Hermes Agent stack and emit ok JSON.

cmd_stop() {
  stop_hermes_stack
  echo '{"ok":true,"action":"stop"}'
}

# @function main
# CLI entry: dispatch hermes-stack subcommands.

main() {
  local sub="${1:-status}"
  shift || true

  case "$sub" in
    -h | --help | help) usage ;;
    catalog)
      cmd_catalog "${1:-}"
      ;;
    status)
      cmd_status "${1:-}"
      ;;
    start)
      require_kubectl
      check_cluster_access
      cmd_start "$@"
      ;;
    stop)
      cmd_stop
      ;;
    *)
      err "Unknown subcommand: ${sub:-<empty>}"
      usage
      exit 1
      ;;
  esac
}

main "$@"
