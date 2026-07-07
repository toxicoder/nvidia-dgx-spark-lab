#!/usr/bin/env bash
#
# ## dev-workspaces
#
# Manage Coder and Kasm dev workspace stacks from the dashboard.
# Wraps scripts/lib/dev.sh start/stop/status helpers (idempotent).
#
# **Intent**: Let operators toggle heavy dev tooling on/off under tight cluster
# resources without using stop-dev (which removes the whole dev stack).
#
# **Safety**:
# - Only coder and kasm namespaces; never touches ai-inference.
# - start is idempotent (helm upgrade --install).
# - stop uninstalls a single Helm release.
#
# Usage:
#   ./scripts/utilities/dev-workspaces.sh status [--json]
#   ./scripts/utilities/dev-workspaces.sh run coder|kasm
#   ./scripts/utilities/dev-workspaces.sh stop coder|kasm
#
# Dashboard integration: Workspaces panel calls status --json and run/stop subcommands.
#
# @command dev-workspaces

set -euo pipefail

# shellcheck source=../lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/../lib/paths.sh"
SCRIPT_DIR="$(lab_script_dir 1 utilities)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# shellcheck source=../lib/common.sh
source "${REPO_ROOT}/scripts/lib/common.sh"
# shellcheck source=../lib/dev.sh
source "${REPO_ROOT}/scripts/lib/dev.sh"

# @function usage
# Print dev-workspaces CLI usage to stdout.

usage() {
  cat <<EOF
Usage:
  dev-workspaces.sh status [--json]
  dev-workspaces.sh run coder|kasm
  dev-workspaces.sh stop coder|kasm
EOF
}

# @function require_workspace_name
# Validate workspace name is coder or kasm.
# @param $1  Workspace name.
# @returns Echoes name on success; exits 1 otherwise.

require_workspace_name() {
  local name="${1:-}"
  case "$name" in
    coder | kasm) echo "$name" ;;
    *)
      err "Unknown workspace: ${name:-<empty>} (expected coder or kasm)"
      exit 1
      ;;
  esac
}

# @function cmd_status
# Report Coder/Kasm workspace status.
# @param $1  Optional --json flag.

cmd_status() {
  local json_flag="${1:-}"
  if [[ "$json_flag" == "--json" ]]; then
    get_all_workspaces_status
  else
    get_workspace_status coder
    get_workspace_status kasm
  fi
}

# @function cmd_run
# Start coder or kasm workspace via Helm.
# @param $1  Workspace name (coder|kasm).

cmd_run() {
  local name
  name=$(require_workspace_name "${1:-}")
  case "$name" in
    coder) start_coder ;;
    kasm) start_kasm ;;
  esac
}

# @function cmd_stop
# Stop coder or kasm workspace.
# @param $1  Workspace name (coder|kasm).

cmd_stop() {
  local name
  name=$(require_workspace_name "${1:-}")
  case "$name" in
    coder) stop_coder ;;
    kasm) stop_kasm ;;
  esac
}

# @function main
# CLI entry: dispatch dev-workspaces subcommands.

main() {
  local sub="${1:-}"
  shift || true

  case "$sub" in
    status) cmd_status "${1:-}" ;;
    run) cmd_run "${1:-}" ;;
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
