#!/usr/bin/env bash
#
# ## kasm-workspace-image
#
# Build the Spark Lab Kasm desktop image with Hermes workspace-dev preinstalled.
#
# Usage:
#   ./scripts/utilities/kasm-workspace-image.sh build [--tag TAG]
#   ./scripts/utilities/kasm-workspace-image.sh info
#
# @command kasm-workspace-image

set -euo pipefail

# shellcheck source=../lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/../lib/paths.sh"
SCRIPT_DIR="$(lab_script_dir 1 utilities)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# shellcheck source=../lib/common.sh
source "${REPO_ROOT}/scripts/lib/common.sh"

DEFAULT_TAG="spark-lab-kasm-desktop:1.19.0"
DOCKERFILE="${REPO_ROOT}/k8s/dev/images/kasm-spark-desktop/Dockerfile"

# @function usage
# Print kasm-workspace-image CLI usage to stdout.

usage() {
  cat <<EOF
Usage:
  kasm-workspace-image.sh build [--tag TAG]
  kasm-workspace-image.sh info
EOF
}

# @function cmd_info
# Print image build metadata and Kasm registration hints.

cmd_info() {
  cat <<EOF
Image:    ${DEFAULT_TAG}
Dockerfile: ${DOCKERFILE}
Base:     kasmweb/core-ubuntu-focal:1.19.0-rolling-weekly
Hermes:   workspace-dev profile (in-cluster inference + MCP)

After build, register in Kasm Admin → Workspaces → Add Workspace:
  Docker Image: ${DEFAULT_TAG}
  Docker Run Config Override: {"user":"1000"}
EOF
}

# @function cmd_build
# Build Spark Lab Kasm desktop Docker image.
# @param --tag  Optional image tag override.

cmd_build() {
  local tag="${DEFAULT_TAG}"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tag) tag="${2:-}"; shift 2 ;;
      *) err "Unknown arg: $1"; exit 1 ;;
    esac
  done

  if ! command -v docker >/dev/null 2>&1; then
    err "docker not found"
    exit 1
  fi

  log "Building ${tag} from repo root..."
  docker build \
    -t "${tag}" \
    -f "${DOCKERFILE}" \
    --build-arg KASM_VERSION=1.19.0 \
    "${REPO_ROOT}"

  log "Built ${tag}"
  log "Register in Kasm Admin UI as a new Workspace image."
  echo "{\"ok\":true,\"action\":\"build\",\"tag\":\"${tag}\"}"
}

# @function main
# CLI entry: dispatch kasm-workspace-image subcommands.

main() {
  local sub="${1:-info}"
  shift || true
  case "$sub" in
    -h | --help | help) usage ;;
    build) cmd_build "$@" ;;
    info) cmd_info ;;
    *)
      err "Unknown subcommand: ${sub:-<empty>}"
      usage
      exit 1
      ;;
  esac
}

main "$@"
