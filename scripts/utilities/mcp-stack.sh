#!/usr/bin/env bash
#
# ## mcp-stack
#
# One-click MCP agent toolkit lifecycle.
#
# Usage:
#   ./scripts/utilities/mcp-stack.sh catalog [--json]
#   ./scripts/utilities/mcp-stack.sh status [--json]
#   ./scripts/utilities/mcp-stack.sh start <stack-id> --confirm yes
#   ./scripts/utilities/mcp-stack.sh stop <stack-id|all>
#
# @command mcp-stack

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
# shellcheck source=../lib/mcp.sh
source "${REPO_ROOT}/scripts/lib/mcp.sh"

# @function usage
# Print mcp-stack CLI usage to stdout.

usage() {
  cat <<EOF
Usage:
  mcp-stack.sh catalog [--json]
  mcp-stack.sh status [--json]
  mcp-stack.sh start <stack-id> --confirm yes
  mcp-stack.sh stop <stack-id|all>
EOF
}

# @function cmd_catalog
# Emit MCP agent toolkit stack catalog JSON (pretty-printed unless --json).
# @param $1  Optional --json flag.

cmd_catalog() {
  local json_flag="${1:-}"
  get_mcp_catalog_json | if [[ $json_flag == "--json" ]]; then cat; else jq '.'; fi
}

# @function cmd_status
# Emit MCP agent toolkit stack status JSON (pretty-printed unless --json).
# @param $1  Optional --json flag.

cmd_status() {
  local json_flag="${1:-}"
  get_mcp_stack_status_json | if [[ $json_flag == "--json" ]]; then cat; else jq '.'; fi
}

# @function cmd_start
# Start MCP agent toolkit stack after confirmation token validation.
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
  start_mcp_stack "$stack_id"
  echo '{"ok":true,"action":"start","stack":"'"$stack_id"'"}'
}

# @function cmd_stop
# Stop MCP agent toolkit stack and emit ok JSON.

cmd_stop() {
  local target="${1:-all}"
  stop_mcp_stack "$target"
  echo '{"ok":true,"action":"stop","stack":"'"$target"'"}'
}

# @function main
# CLI entry: dispatch mcp-stack subcommands.

main() {
  local sub="${1:-status}"
  shift || true

  case "$sub" in
    -h | --help | help) usage ;;
    catalog)
      cmd_catalog "${1:-}"
      ;;
    status)
      require_kubectl
      check_cluster_access
      cmd_status "${1:-}"
      ;;
    start)
      require_kubectl
      check_cluster_access
      cmd_start "$@"
      ;;
    stop)
      require_kubectl
      check_cluster_access
      cmd_stop "${1:-}"
      ;;
    *)
      err "Unknown subcommand: ${sub:-<empty>}"
      usage
      exit 1
      ;;
  esac
}

main "$@"
