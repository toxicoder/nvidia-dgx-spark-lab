#!/usr/bin/env bash
# ## build-mcp-images — build local lab-mcp/* container images for agent-tools
#
# Builds pre-baked MCP gateway images so Deployments do not apt/npm/pip at
# pod start. Run from a machine with Docker (or via Bazel utility runner).
#
# Usage:
#   bazelisk run //scripts:run-utility -- build-mcp-images status
#   bazelisk run //scripts:run-utility -- build-mcp-images run
#   bazelisk run //scripts:run-utility -- build-mcp-images run -- component=mcp-fetch

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "${SCRIPT_DIR}/../lib/common.sh"
# shellcheck source=../lib/paths.sh
source "${SCRIPT_DIR}/../lib/paths.sh" 2>/dev/null || true

REPO_ROOT="${REPO_ROOT:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"
IMAGES=(
  context7-proxy
  mcp-fetch
  mcp-gitea
  mcp-qdrant
  mcp-memory
  mcp-searxng
  mcp-firecrawl
  doc-ingest
)

# @function status
# @command status
# List MCP image Dockerfiles and whether local tags exist.
status() {
  for name in "${IMAGES[@]}"; do
    local df="${REPO_ROOT}/mcp/docker/${name}/Dockerfile"
    local tag="lab-mcp/${name}:local"
    if [[ ! -f $df ]]; then
      echo "MISSING dockerfile ${name}"
      continue
    fi
    if docker image inspect "$tag" >/dev/null 2>&1; then
      echo "OK     ${tag}"
    else
      echo "NEEDED ${tag}  (docker build -f mcp/docker/${name}/Dockerfile -t ${tag} .)"
    fi
  done
}

# @function run
# @command run
# Build one or all MCP images from the repository root.
run() {
  local only="${1:-}"
  if [[ -n $only && $only == component=* ]]; then
    only="${only#component=}"
  fi
  cd "$REPO_ROOT"
  for name in "${IMAGES[@]}"; do
    if [[ -n $only && $name != "$only" ]]; then
      continue
    fi
    local tag="lab-mcp/${name}:local"
    log "Building ${tag}..."
    docker build -f "mcp/docker/${name}/Dockerfile" -t "$tag" .
  done
  status
}

# @function usage
# Print CLI help for build-mcp-images.
usage() {
  cat <<USAGE
Usage: build-mcp-images {status|run} [component=NAME]
USAGE
}

# @function main
# Dispatch utility subcommands (status/run).
main() {
  local cmd="${1:-status}"
  shift || true
  case "$cmd" in
    status) status "$@" ;;
    run) run "$@" ;;
    -h | --help | help) usage ;;
    *)
      err "unknown command: $cmd"
      usage
      exit 1
      ;;
  esac
}

if [[ ${BASH_SOURCE[0]} == "${0}" ]]; then
  main "$@"
fi
