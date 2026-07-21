#!/usr/bin/env bash
#
# ## cluster-resources
#
# Resource Guard status and pre-flight checks for the dashboard.
#
# Usage:
#   ./scripts/utilities/cluster-resources.sh status [--json]
#   ./scripts/utilities/cluster-resources.sh check --action model:kimi [--json]
#   ./scripts/utilities/cluster-resources.sh suggest --action model:kimi [--json]
#
# @command cluster-resources

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

# @function usage
# Print cluster-resources CLI usage to stdout.

usage() {
  cat <<EOF
Usage:
  cluster-resources.sh status [--json]
  cluster-resources.sh check --action <action> [--json]
  cluster-resources.sh suggest --action <action> [--json]
EOF
}

# @function cmd_status
# Show cluster capacity via Resource Guard.
# @param $1  Optional --json flag.

cmd_status() {
  local json_flag="${1:-}"
  if [[ $json_flag == "--json" ]]; then
    get_cluster_capacity_json
  else
    print_resources_status
  fi
}

# @function cmd_check
# Pre-flight capacity check for an action.
# @param --action  e.g. model:kimi-test

cmd_check() {
  local action="" json_flag=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --action)
        action="${2:-}"
        shift 2
        ;;
      --json)
        json_flag="--json"
        shift
        ;;
      *)
        err "Unknown arg: $1"
        usage
        exit 1
        ;;
    esac
  done
  if [[ -z $action ]]; then
    err "--action required (e.g. model:kimi-test, dev:coder)"
    exit 1
  fi
  local result rc=0
  result=$(check_capacity "$action" 2>&1) || rc=$?
  echo "$result"
  exit "$rc"
}

# @function cmd_suggest
# Suggest free resources for an action.
# @param --action  Resource action string.

cmd_suggest() {
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
  suggest_free_resources "$action"
}

# @function main
# CLI entry: dispatch cluster-resources subcommands.

main() {
  local sub="${1:-status}"
  shift || true
  require_kubectl
  check_cluster_access

  case "$sub" in
    status) cmd_status "${1:-}" ;;
    check) cmd_check "$@" ;;
    suggest) cmd_suggest "$@" ;;
    -h | --help | help) usage ;;
    *)
      err "Unknown subcommand: ${sub:-<empty>}"
      usage
      exit 1
      ;;
  esac
}

main "$@"
