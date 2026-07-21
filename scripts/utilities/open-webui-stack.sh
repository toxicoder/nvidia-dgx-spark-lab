#!/usr/bin/env bash
#
# ## open-webui-stack
#
# Open WebUI Helm lifecycle — Hermes gateway agent chat UI.
#
# Usage:
#   ./scripts/utilities/open-webui-stack.sh catalog [--json]
#   ./scripts/utilities/open-webui-stack.sh status [--json]
#   ./scripts/utilities/open-webui-stack.sh start <stack-id> --confirm yes
#   ./scripts/utilities/open-webui-stack.sh stop
#
# @command open-webui-stack

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
# shellcheck source=../lib/open-webui.sh
source "${REPO_ROOT}/scripts/lib/open-webui.sh"

# @function usage
# Print open-webui-stack CLI usage to stdout.

usage() {
  cat <<EOF
Usage:
  open-webui-stack.sh catalog [--json]
  open-webui-stack.sh status [--json]
  open-webui-stack.sh start <stack-id> --confirm yes
  open-webui-stack.sh stop
EOF
}

# @function cmd_catalog
# Emit Open WebUI stack catalog JSON (pretty-printed unless --json).
# @param $1  Optional --json flag.

cmd_catalog() {
  local json_flag="${1:-}"
  get_openwebui_catalog_json | if [[ $json_flag == "--json" ]]; then cat; else jq '.'; fi
}

# @function cmd_status
# Emit Open WebUI stack status JSON (pretty-printed unless --json).
# @param $1  Optional --json flag.

cmd_status() {
  local json_flag="${1:-}"
  get_openwebui_status_json | if [[ $json_flag == "--json" ]]; then cat; else jq '.'; fi
}

# @function cmd_start
# Start Open WebUI stack after confirmation token validation.
# @param $1  Stack or model identifier.

cmd_start() {
  local stack_id="${1:-open-webui-lab}"
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
  export LAB_NON_INTERACTIVE=1
  export LAB_CONFIRM_TOKEN="${confirm:-}"
  start_openwebui_stack "$stack_id"
  echo '{"ok":true,"action":"start","stack":"'"$stack_id"'"}'
}

# @function cmd_stop
# Stop Open WebUI stack and emit ok JSON.

cmd_stop() {
  stop_openwebui_stack
  echo '{"ok":true,"action":"stop"}'
}

# @function main
# CLI entry: dispatch open-webui-stack subcommands.

main() {
  local sub="${1:-status}"
  shift || true
  case "$sub" in
    catalog) cmd_catalog "${1:-}" ;;
    status) cmd_status "${1:-}" ;;
    start) cmd_start "$@" ;;
    stop) cmd_stop ;;
    -h | --help | help) usage ;;
    *)
      err "Unknown subcommand: $sub"
      usage
      exit 1
      ;;
  esac
}

main "$@"
