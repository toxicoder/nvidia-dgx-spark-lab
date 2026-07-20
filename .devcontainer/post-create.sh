#!/usr/bin/env bash
#
# ## Devcontainer post-create / content update
#
# Installs workspace-scoped deps after the image is built:
#   - docs Python deps + Playwright Chromium (+ OS deps)
#   - dashboard npm ci
#   - optional pre-commit hooks
#   - environment doctor
#
# Never fails the whole Dev Containers "create" flow solely because a Bazel
# smoke suite is red — missing tools still fail via doctor when STRICT.
#
# Usage:
#   bash .devcontainer/post-create.sh
#   bash .devcontainer/post-create.sh --deps-only
#   bash .devcontainer/post-create.sh --smoke
#   DEVCONTAINER_SMOKE=1 bash .devcontainer/post-create.sh
#
# Flags:
#   --deps-only   Install deps only (skip doctor summary polish / smoke)
#   --smoke       Run non-blocking //:test-fast after deps
#   --help        Show help
#
# @command post-create
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

DEPS_ONLY=0
RUN_SMOKE="${DEVCONTAINER_SMOKE:-0}"

usage() {
  cat <<'EOF'
Usage: post-create.sh [--deps-only] [--smoke] [--help]

Bootstrap workspace dependencies inside the nvidia-dgx-spark-lab dev container.
Safe to re-run (idempotent npm ci / pip install).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --deps-only)
      DEPS_ONLY=1
      shift
      ;;
    --smoke)
      RUN_SMOKE=1
      shift
      ;;
    *)
      echo "post-create: unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

echo "=== Post-create setup for nvidia-dgx-spark-lab ==="
echo "Repo: ${REPO_ROOT}"
echo "Arch: $(uname -m)  User: $(id -un)"

# Ensure user-local bin is on PATH (pip --user, npm global under vscode)
export PATH="${HOME}/.local/bin:${REPO_ROOT}/dashboard/node_modules/.bin:${PATH}"

# ---------------------------------------------------------------------------
# Docs tooling
# ---------------------------------------------------------------------------
if [[ -x "${REPO_ROOT}/docs/setup-docs.sh" ]]; then
  echo "→ docs/setup-docs.sh (venv + requirements)"
  QUIET=true bash "${REPO_ROOT}/docs/setup-docs.sh" || {
    echo "post-create: docs/setup-docs.sh failed; falling back to pip --user" >&2
    python3 -m pip install --user --upgrade pip setuptools wheel
    python3 -m pip install --user -r docs/requirements.txt
  }
else
  echo "→ pip install docs/requirements.txt (user)"
  python3 -m pip install --user --upgrade pip setuptools wheel
  python3 -m pip install --user -r docs/requirements.txt
fi

# Prefer venv python for playwright when present
PLAYWRIGHT_PY=python3
if [[ -x "${REPO_ROOT}/.venv-docs/bin/python" ]]; then
  PLAYWRIGHT_PY="${REPO_ROOT}/.venv-docs/bin/python"
fi

echo "→ Playwright Chromium (+ OS deps when available)"
# --with-deps needs root on bare systems; in feature-based images it may no-op.
if [[ "$(id -u)" -eq 0 ]]; then
  "${PLAYWRIGHT_PY}" -m playwright install --with-deps chromium
else
  if ! "${PLAYWRIGHT_PY}" -m playwright install --with-deps chromium 2>/dev/null; then
    echo "post-create: playwright --with-deps needs privileges; installing browser only" >&2
    "${PLAYWRIGHT_PY}" -m playwright install chromium
  fi
fi

# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
if [[ -f dashboard/package-lock.json ]]; then
  echo "→ dashboard npm ci"
  (cd dashboard && npm ci)
else
  echo "post-create: dashboard/package-lock.json missing — skip npm ci" >&2
fi

# Global prettier for //:fix / yaml_format when not using node_modules PATH.
if [[ -f "${SCRIPT_DIR}/tool-versions.env" ]]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck disable=SC1090
  source "${SCRIPT_DIR}/tool-versions.env"
  set +a
fi
if command -v npm >/dev/null 2>&1; then
  echo "→ npm install -g prettier@${PRETTIER_VERSION:-3.9.4}"
  npm install -g "prettier@${PRETTIER_VERSION:-3.9.4}" 2>/dev/null ||
    echo "post-create: global prettier install skipped (use dashboard/node_modules/.bin)" >&2
fi

# ---------------------------------------------------------------------------
# pre-commit (optional)
# ---------------------------------------------------------------------------
if command -v pre-commit >/dev/null 2>&1 && [[ -d .git ]]; then
  echo "→ pre-commit install"
  pre-commit install || echo "post-create: pre-commit install skipped" >&2
fi

# ---------------------------------------------------------------------------
# Agent CLIs (Grok Build + Hermes Agent) — no secrets; auth is interactive
# ---------------------------------------------------------------------------
if [[ -x "${SCRIPT_DIR}/install-agent-clis.sh" || -f "${SCRIPT_DIR}/install-agent-clis.sh" ]]; then
  echo "→ install-agent-clis (grok + hermes; privacy-safe)"
  bash "${SCRIPT_DIR}/install-agent-clis.sh" ||
    echo "post-create: agent CLI install skipped or partial (optional)" >&2
fi

if [[ ${DEPS_ONLY} -eq 1 ]]; then
  echo "=== Deps-only post-create complete ==="
  exit 0
fi

# ---------------------------------------------------------------------------
# Doctor
# ---------------------------------------------------------------------------
echo "→ environment doctor"
if ! bash "${SCRIPT_DIR}/doctor.sh"; then
  echo ""
  echo "=== Doctor reported missing required tools ===" >&2
  echo "The container image may need a rebuild (Dev Containers: Rebuild Container)." >&2
  echo "Workspace deps were still installed; fix tools then re-run doctor." >&2
  # Fail create when tools are missing so contributors do not get a silent half-env.
  exit 1
fi

# ---------------------------------------------------------------------------
# Optional non-blocking smoke (never the default create path)
# ---------------------------------------------------------------------------
if [[ ${RUN_SMOKE} == "1" ]]; then
  echo "→ optional smoke: bazelisk test //:test-fast --config=ci"
  if command -v bazelisk >/dev/null 2>&1; then
    if ! bazelisk test //:test-fast --config=ci; then
      echo ""
      echo "=== Smoke test failed (non-blocking for env usability) ===" >&2
      echo "  bazelisk test //:test-fast --config=ci --test_output=errors" >&2
      echo "  bazelisk run //:fix" >&2
      echo "See docs/dev-environment.md" >&2
    else
      echo "Smoke //:test-fast passed."
    fi
  else
    echo "post-create: bazelisk missing — skip smoke" >&2
  fi
fi

cat <<'EOF'

=== Dev environment ready ===

Recommended next steps:
  bazelisk run //:fix
  bazelisk run //:validate
  bazelisk run //:validate -- --all          # before merge
  bazelisk run //docs:serve -- --port 8080
  cd dashboard && npm run dev                 # http://localhost:3000
  bash .devcontainer/doctor.sh

Agent CLIs (optional; never commit API keys):
  grok login                                  # Grok Build TUI — https://github.com/xai-org/grok-build
  hermes setup                                # Hermes Agent — https://github.com/NousResearch/hermes-agent
  # Auth lives in volume-mounted ~/.grok and ~/.hermes only (see SECURITY.md).

Platform notes:
  - Image is multi-arch Linux (amd64 + arm64): Apple Silicon, Windows x86 Docker,
    Linux workstations, and DGX Spark (Grace ARM) hosts all use the same Dockerfile.
  - Hermetic dashboard tests need host Docker (docker-outside-of-docker).

See docs/dev-environment.md and CONTRIBUTING.md.
EOF
