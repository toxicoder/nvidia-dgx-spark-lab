#!/usr/bin/env bash
#
# ## install-dev-tools
#
# Host-side bootstrap for contributors who are **not** using the devcontainer.
# Prefer the multi-arch devcontainer when possible (Apple Silicon, Windows,
# Linux, DGX Spark).
#
# Usage:
#   ./scripts/utilities/install-dev-tools.sh status
#   ./scripts/utilities/install-dev-tools.sh run
#
# @command install-dev-tools
set -euo pipefail

# shellcheck source=../lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/../lib/paths.sh"
SCRIPT_DIR="$(lab_script_dir 1 utilities)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

CMD="${1:-status}"

# @function print_platform
# Describe host OS/arch and recommended path.
print_platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"
  echo "Host: ${os} / ${arch}"
  case "${os}" in
    Darwin)
      if [[ ${arch} == "arm64" ]]; then
        echo "Recommended: Dev Containers on Docker Desktop (Apple Silicon → linux/arm64 image)."
      else
        echo "Recommended: Dev Containers on Docker Desktop (Intel Mac → linux/amd64 image)."
      fi
      ;;
    Linux)
      if [[ ${arch} == "aarch64" || ${arch} == "arm64" ]]; then
        echo "Recommended: Dev Containers or native tools (linux/arm64; includes DGX Spark Grace)."
      else
        echo "Recommended: Dev Containers or scripts/ci/install-lint-tools.sh (linux/amd64)."
      fi
      ;;
    MINGW* | MSYS* | CYGWIN*)
      echo "Recommended: Docker Desktop + WSL2 + Dev Containers (Windows x86_64 → linux/amd64)."
      ;;
    *)
      echo "Recommended: Dev Containers (multi-arch linux/amd64 + linux/arm64 image)."
      ;;
  esac
}

# @function cmd_status
# Report whether key tools are on PATH.
cmd_status() {
  print_platform
  echo ""
  echo "Tool PATH check (not a full doctor — use bash .devcontainer/doctor.sh in-container):"
  for t in bazelisk buildifier shfmt shellcheck yamllint kubeconform ruff mypy node npm jq docker; do
    if command -v "${t}" >/dev/null 2>&1; then
      echo "  OK  ${t}"
    else
      echo "  --  ${t}"
    fi
  done
  if [[ -f "${REPO_ROOT}/.devcontainer/tool-versions.env" ]]; then
    echo ""
    echo "Pinned versions: ${REPO_ROOT}/.devcontainer/tool-versions.env"
  fi
}

# @function cmd_run
# Best-effort install of lint tools on this host.
cmd_run() {
  print_platform
  local os
  os="$(uname -s)"
  case "${os}" in
    Linux)
      echo "→ scripts/ci/install-lint-tools.sh (multi-arch Linux)"
      bash "${REPO_ROOT}/scripts/ci/install-lint-tools.sh"
      echo ""
      echo "Also install: Node.js ${NODE_MAJOR:-22}+ (nodesource/nvm/fnm) and Bazelisk if missing."
      echo "Docs: pip install -r docs/requirements.txt && python -m playwright install --with-deps chromium"
      echo "Dashboard: cd dashboard && npm ci"
      ;;
    Darwin)
      echo "macOS host install is best-effort via Homebrew when available."
      if command -v brew >/dev/null 2>&1; then
        brew install bazelisk shellcheck shfmt yamllint jq || true
        brew install buildifier 2>/dev/null || brew install buildifier || true
        echo "Install kubeconform: brew install kubeconform (or use the devcontainer)."
        echo "Python tools: pip3 install ruff mypy ansible ansible-lint pytest"
        echo "Node 22: brew install node@22"
      else
        echo "Homebrew not found. Prefer Dev Containers (see docs/dev-environment.md)." >&2
        exit 1
      fi
      ;;
    *)
      echo "Automated host install is only implemented for Linux and macOS." >&2
      echo "On Windows use Docker Desktop + Dev Containers (docs/dev-environment.md)." >&2
      exit 1
      ;;
  esac
  echo ""
  echo "Done. Prefer: Dev Containers: Reopen in Container for full parity with CI."
}

case "${CMD}" in
  status) cmd_status ;;
  run) cmd_run ;;
  -h | --help | help)
    echo "Usage: install-dev-tools.sh status|run"
    ;;
  *)
    echo "Unknown command: ${CMD}" >&2
    echo "Usage: install-dev-tools.sh status|run" >&2
    exit 1
    ;;
esac
