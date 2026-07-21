#!/usr/bin/env bash
#
# ## nemotron-stack
#
# One-click Nemotron agentic stack lifecycle for the dashboard.
#
# Usage:
#   ./scripts/utilities/nemotron-stack.sh catalog [--json]
#   ./scripts/utilities/nemotron-stack.sh status [--json]
#   ./scripts/utilities/nemotron-stack.sh check --action stack:<id> [--json]
#   ./scripts/utilities/nemotron-stack.sh start <stack-id> --confirm yes
#   ./scripts/utilities/nemotron-stack.sh stop <stack-id|all>
#
# @command nemotron-stack

set -euo pipefail

# shellcheck source=../lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/../lib/paths.sh"
SCRIPT_DIR="$(lab_script_dir 1 utilities)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# shellcheck disable=SC2034
export NAMESPACE="ai-inference"

if [[ -f "${REPO_ROOT}/kubeconfig/config" ]]; then
  export KUBECONFIG="${REPO_ROOT}/kubeconfig/config"
fi

# shellcheck source=../lib/common.sh
source "${REPO_ROOT}/scripts/lib/common.sh"
# shellcheck source=../lib/resources.sh
source "${REPO_ROOT}/scripts/lib/resources.sh"
# shellcheck source=../lib/models.sh
source "${REPO_ROOT}/scripts/lib/models.sh"

# @function usage
# Print nemotron-stack CLI usage to stdout.

usage() {
  cat <<EOF
Usage:
  nemotron-stack.sh catalog [--json]
  nemotron-stack.sh status [--json]
  nemotron-stack.sh check --action stack:<id> [--json]
  nemotron-stack.sh start <stack-id> --confirm yes
  nemotron-stack.sh stop <stack-id|all>
EOF
}

# @function cmd_catalog
# Emit Nemotron model/stack catalog JSON.
# @param $1  Optional --json flag.

cmd_catalog() {
  local json_flag="${1:-}"
  get_nemotron_catalog_json | if [[ $json_flag == "--json" ]]; then cat; else jq '.'; fi
}

# @function cmd_status
# Emit Nemotron stack status JSON.
# @param $1  Optional --json flag.

cmd_status() {
  local json_flag="${1:-}"
  get_nemotron_stack_status_json | if [[ $json_flag == "--json" ]]; then cat; else jq '.'; fi
}

# @function cmd_check
# Run Resource Guard pre-flight for a Nemotron action.
# @param --action  Resource action string.

cmd_check() {
  local action=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --action)
        action="${2:-}"
        shift 2
        ;;
      --json) shift ;;
      *)
        err "Unknown arg: $1"
        usage
        exit 1
        ;;
    esac
  done
  if [[ -z $action ]]; then
    err "--action required (stack:nemotron-agentic-spark-N)"
    exit 1
  fi
  check_capacity "$action"
}

# @function cmd_start
# Start Nemotron stack after confirmation.
# @param $1  Stack identifier.

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
  start_nemotron_stack "$stack_id"
  echo '{"ok":true,"action":"start","stack":"'"$stack_id"'"}'
}

# @function cmd_stop
# Stop Nemotron stack and emit ok JSON.

cmd_stop() {
  local target="${1:-all}"
  stop_nemotron_stack "$target"
  echo '{"ok":true,"action":"stop","stack":"'"$target"'"}'
}

# @function main
# CLI entry: dispatch nemotron-stack subcommands.

main() {
  local sub="${1:-status}"
  shift || true
  require_kubectl
  check_cluster_access

  case "$sub" in
    catalog) cmd_catalog "${1:-}" ;;
    status) cmd_status "${1:-}" ;;
    check) cmd_check "$@" ;;
    start) cmd_start "$@" ;;
    stop) cmd_stop "${1:-}" ;;
    -h | --help | help) usage ;;
    *)
      err "Unknown subcommand: ${sub:-<empty>}"
      usage
      exit 1
      ;;
  esac
}

main "$@"
