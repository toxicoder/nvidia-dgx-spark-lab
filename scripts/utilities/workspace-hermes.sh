#!/usr/bin/env bash
#
# ## workspace-hermes
#
# Seed and verify Hermes workspace-dev profile for Coder/Kasm workspaces.
#
# Usage:
#   ./scripts/utilities/workspace-hermes.sh status [--json]
#   ./scripts/utilities/workspace-hermes.sh seed <target-dir>
#   ./scripts/utilities/workspace-hermes.sh render <target-dir>
#   ./scripts/utilities/workspace-hermes.sh verify
#
# @command workspace-hermes

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
# shellcheck source=../lib/hermes.sh
source "${REPO_ROOT}/scripts/lib/hermes.sh"
# shellcheck source=../lib/workspace-hermes.sh
source "${REPO_ROOT}/scripts/lib/workspace-hermes.sh"

# @function usage
# Print workspace-hermes CLI usage to stdout.

usage() {
  cat <<EOF
Usage:
  workspace-hermes.sh status [--json]
  workspace-hermes.sh seed <target-dir>
  workspace-hermes.sh render <target-dir>
  workspace-hermes.sh verify
EOF
}

# @function cmd_status
# Emit workspace-dev Hermes profile status JSON.
# @param $1  Optional --json flag.

cmd_status() {
  local json_flag="${1:-}"
  get_workspace_hermes_status_json | if [[ $json_flag == "--json" ]]; then cat; else jq '.'; fi
}

# @function cmd_seed
# Copy Hermes workspace-dev seed files into target directory.
# @param $1  Target directory path.

cmd_seed() {
  local target_dir="${1:-}"
  if [[ -z $target_dir ]]; then
    err "Target directory required"
    usage
    exit 1
  fi
  workspace_hermes_seed_data_dir "$target_dir"
  echo '{"ok":true,"action":"seed","target":"'"$target_dir"'"}'
}

# @function cmd_render
# Render Hermes workspace-dev config into target directory.
# @param $1  Target directory path.

cmd_render() {
  local target_dir="${1:-}"
  if [[ -z $target_dir ]]; then
    err "Target directory required"
    usage
    exit 1
  fi
  workspace_hermes_render_config "$target_dir"
  echo '{"ok":true,"action":"render","target":"'"$target_dir"'"}'
}

# @function cmd_verify
# Verify prerequisites for workspace-dev Hermes (cluster + stacks).

cmd_verify() {
  require_kubectl
  check_cluster_access
  if workspace_hermes_verify_prerequisites; then
    echo '{"ok":true,"action":"verify","stack":"hermes-workspace-dev"}'
  else
    err "Prerequisites not met — start nemotron-stack and mcp-stack first"
    exit 1
  fi
}

# @function main
# CLI entry: dispatch workspace-hermes subcommands.

main() {
  local sub="${1:-status}"
  shift || true

  case "$sub" in
    -h | --help | help) usage ;;
    status)
      cmd_status "${1:-}"
      ;;
    seed)
      cmd_seed "${1:-}"
      ;;
    render)
      cmd_render "${1:-}"
      ;;
    verify)
      cmd_verify
      ;;
    *)
      err "Unknown subcommand: ${sub:-<empty>}"
      usage
      exit 1
      ;;
  esac
}

main "$@"
