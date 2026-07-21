#!/usr/bin/env bash
#
# ## inference-workloads
#
# Dashboard-controllable inference lifecycle (start/stop/status) with Resource Guard gates.
#
# Usage:
#   ./scripts/utilities/inference-workloads.sh status [--json]
#   ./scripts/utilities/inference-workloads.sh check --action model:kimi [--json]
#   ./scripts/utilities/inference-workloads.sh start <model> --confirm yes
#   ./scripts/utilities/inference-workloads.sh stop <model|all|ray>
#
# @command inference-workloads

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
# Print inference-workloads CLI usage to stdout.

usage() {
  cat <<EOF
Usage:
  inference-workloads.sh status [--json]
  inference-workloads.sh check --action model:<name> [--json]
  inference-workloads.sh start <model> --confirm yes
  inference-workloads.sh stop <model|all|ray>
EOF
}

# @function cmd_status
# Emit inference workload status JSON.
# @param $1  Optional --json flag.

cmd_status() {
  local json_flag="${1:-}"
  if [[ $json_flag == "--json" ]]; then
    get_inference_status_json
  else
    get_inference_status_json | jq '.'
  fi
}

# @function cmd_check
# Resource Guard pre-flight for a model action.
# @param --action  e.g. model:kimi

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
    err "--action required"
    exit 1
  fi
  local result
  result=$(check_capacity "$action" 2>/dev/null) || {
    echo "$result" 2>/dev/null || check_capacity "$action" || true
    exit 1
  }
  echo "$result"
}

# @function cmd_start
# Start inference model with non-interactive confirmation.
# @param $1  Model name.

cmd_start() {
  local model="${1:-}"
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

  if [[ -z $model ]]; then
    err "Model name required"
    usage
    exit 1
  fi

  export LAB_NON_INTERACTIVE=1
  export LAB_CONFIRM_TOKEN="${confirm:-}"

  start_model "$model"
  echo '{"ok":true,"action":"start","model":"'"$model"'"}'
}

# @function cmd_stop
# Stop inference model, ray, or all workloads.
# @param $1  Target (model name, all, or ray).

cmd_stop() {
  local target="${1:-all}"
  if [[ -z $target ]]; then
    err "Stop target required (model name, all, or ray)"
    exit 1
  fi
  stop_model "$target"
  echo '{"ok":true,"action":"stop","target":"'"$target"'"}'
}

# @function main
# CLI entry: dispatch inference-workloads subcommands.

main() {
  local sub="${1:-status}"
  shift || true
  require_kubectl
  check_cluster_access

  case "$sub" in
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
