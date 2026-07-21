#!/usr/bin/env bash
#
# ## Devcontainer / contributor environment doctor
#
# Verifies CLI tools required for bazelisk //:fix, //:lint, and day-to-day
# contribution. Designed for multi-arch Linux containers (amd64 + arm64) used
# from macOS (Apple Silicon), Windows (Docker Desktop / WSL2 x86_64), Linux
# workstations, and NVIDIA DGX Spark (Grace ARM64).
#
# Exit codes:
#   0 — all required tools present (optional tools may warn)
#   1 — one or more required tools missing, or --help invalid usage
#   2 — tool-versions.env missing / unreadable
#
# Usage:
#   bash .devcontainer/doctor.sh
#   bash .devcontainer/doctor.sh --help
#   bash .devcontainer/doctor.sh --quiet
#
# Environment:
#   REQUIRE_LINT_TOOLS=1  (default in devcontainer) — same strictness as CI
#   DEVCONTAINER_DOCTOR_STRICT=0 — only warn on missing required tools (exit 0)
#
# @command doctor (devcontainer)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VERSIONS_FILE="${SCRIPT_DIR}/tool-versions.env"
QUIET=0
STRICT="${DEVCONTAINER_DOCTOR_STRICT:-1}"

usage() {
  cat <<'EOF'
Usage: doctor.sh [--quiet] [--help]

Verify contributor tooling (bazelisk, shellcheck, node, …) against
.devcontainer/tool-versions.env.

Exit 0 when required tools are present; exit 1 when any required tool is missing
(unless DEVCONTAINER_DOCTOR_STRICT=0).

Platform notes:
  - Container is always Linux (amd64 or arm64).
  - Hosts: macOS arm64/x86_64, Windows x86_64 (Docker Desktop), Linux, DGX Spark.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    -q | --quiet)
      QUIET=1
      shift
      ;;
    *)
      echo "doctor: unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

log() {
  if [[ ${QUIET} -eq 0 ]]; then
    echo "$@"
  fi
}

log_err() {
  echo "$@" >&2
}

if [[ ! -f ${VERSIONS_FILE} ]]; then
  log_err "doctor: missing ${VERSIONS_FILE}"
  exit 2
fi

# shellcheck source=/dev/null
set -a
# shellcheck disable=SC1090
source "${VERSIONS_FILE}"
set +a

MISSING=0
WARNED=0

# @function check_required
# Record a missing required CLI.
# @param $1 tool name on PATH
# @param $2 human install hint
check_required() {
  local tool="$1"
  local hint="${2:-install ${tool}}"
  if command -v "${tool}" >/dev/null 2>&1; then
    log "  OK  ${tool}  ($(command -v "${tool}"))"
  else
    log_err "  MISSING  ${tool}  — ${hint}"
    MISSING=$((MISSING + 1))
  fi
}

# @function check_optional
# Warn when an optional CLI is missing (never fails doctor).
check_optional() {
  local tool="$1"
  local hint="${2:-optional}"
  if command -v "${tool}" >/dev/null 2>&1; then
    log "  OK  ${tool}  (optional)"
  else
    log "  --  ${tool}  (optional; ${hint})"
    WARNED=$((WARNED + 1))
  fi
}

# @function check_node_major
# Ensure Node.js major version matches NODE_MAJOR pin.
check_node_major() {
  local expected="${NODE_MAJOR:-22}"
  if ! command -v node >/dev/null 2>&1; then
    log_err "  MISSING  node  — Node.js ${expected}.x required"
    MISSING=$((MISSING + 1))
    return
  fi
  local ver major
  ver="$(node --version 2>/dev/null || echo "")"
  major="${ver#v}"
  major="${major%%.*}"
  if [[ ${major} == "${expected}" ]]; then
    log "  OK  node  ${ver} (major ${expected})"
  else
    log_err "  BAD   node  ${ver} (want major ${expected})"
    MISSING=$((MISSING + 1))
  fi
}

log "=== nvidia-dgx-spark-lab environment doctor ==="
log "Repo: ${REPO_ROOT}"
log "Arch: $(uname -m)  OS: $(uname -s)"
log "Pins: bazelisk=${BAZELISK_VERSION:-?} buildifier=${BUILDIFIER_VERSION:-?} shfmt=${SHFMT_VERSION:-?} kubeconform=${KUBECONFORM_VERSION:-?}"
log ""
log "Required tools:"

check_required bazelisk "see .devcontainer or brew install bazelisk"
check_required buildifier "install-lint-tools / devcontainer"
check_required shfmt "install-lint-tools / devcontainer"
check_required shellcheck "apt/brew install shellcheck"
check_required yamllint "pip/apt install yamllint"
check_required kubeconform "install-lint-tools / devcontainer"
check_required ruff "pip install ruff"
check_required mypy "pip install mypy"
check_required jq "apt/brew install jq"
check_required git "system package"
check_required curl "system package"
check_node_major

if command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1; then
  py="$(command -v python3 || command -v python)"
  log "  OK  python  ($(${py} --version 2>&1 | head -1))"
else
  log_err "  MISSING  python3"
  MISSING=$((MISSING + 1))
fi

log ""
log "Recommended (ops / hermetic tests):"
check_optional kubectl "cluster ops"
check_optional helm "helm charts"
check_optional ansible "cluster bootstrap"
check_optional ansible-lint "ansible lint"
check_optional bats "host bats (Bazel vendors bats-core)"
check_optional prettier "npm / global prettier ${PRETTIER_VERSION:-}"
check_optional docker "hermetic dashboard image builds (host Docker / DooD)"
check_optional kcov "shell coverage on Linux"
check_optional pre-commit "optional git hooks"
check_optional pytest "docs python coverage"
check_optional grok "Grok Build CLI (post-create install; then grok login)"
check_optional hermes "Hermes Agent CLI (post-create install only; hermes setup when you need it)"

# Soft checks for workspace deps (do not fail create when network skipped)
if [[ -d "${REPO_ROOT}/dashboard/node_modules" ]]; then
  log "  OK  dashboard/node_modules"
else
  log "  --  dashboard/node_modules (run post-create / npm ci)"
  WARNED=$((WARNED + 1))
fi

if [[ -f "${REPO_ROOT}/docs/requirements.txt" ]]; then
  log "  OK  docs/requirements.txt present"
fi

# Soft check: host-created .venv-docs (macOS/Windows) is often broken in Linux.
if [[ -d "${REPO_ROOT}/.venv-docs" ]]; then
  docs_py="${REPO_ROOT}/.venv-docs/bin/python"
  if [[ -x ${docs_py} ]] && "${docs_py}" -c 'import sys' >/dev/null 2>&1; then
    log "  OK  docs venv (.venv-docs) usable"
  else
    log "  --  docs venv (.venv-docs) present but unusable (host/foreign python?)"
    log "      fix: rm -rf .venv-docs && bash docs/setup-docs.sh"
    WARNED=$((WARNED + 1))
  fi
else
  log "  --  docs venv (.venv-docs) missing (run docs/setup-docs.sh or post-create)"
  WARNED=$((WARNED + 1))
fi

log ""
if [[ ${MISSING} -gt 0 ]]; then
  log_err "doctor: ${MISSING} required tool(s) missing (${WARNED} optional warnings)"
  if [[ ${STRICT} == "0" ]]; then
    log_err "doctor: STRICT=0 — reporting only (exit 0)"
    exit 0
  fi
  exit 1
fi

log "doctor: all required tools present (${WARNED} optional warnings)"
exit 0
