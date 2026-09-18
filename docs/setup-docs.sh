#!/usr/bin/env bash
# ##
# Purpose: Idempotent setup for the Fumadocs documentation site (npm packages + Python tooling).
# Source of truth: docs-site/package.json (JS deps) and docs/requirements.txt (Python deps).
# Regenerate: n/a (hand-maintained).
# Safety: Installs into docs-site/node_modules and an isolated virtualenv; touches no system
#   packages and never publishes.
#
# Must be run from the repo root or docs/ (it cds appropriately).  Supports QUIET=true for
# automation from manage-docs.sh.
#
# Host/container note: a .venv-docs created on macOS/Windows is not usable inside the Linux
# devcontainer (broken python symlinks).  This script detects unusable venvs and recreates
# them with the current python3.
#
# Usage: ./docs/setup-docs.sh
#        QUIET=true ./docs/setup-docs.sh
#        VENV_DIR=/path/to/venv ./docs/setup-docs.sh   # tests / advanced
set -euo pipefail

QUIET=${QUIET:-false}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n ${BUILD_WORKSPACE_DIRECTORY:-} ]]; then
  # bazel run support: operate on the real source checkout.
  REPO_ROOT="${BUILD_WORKSPACE_DIRECTORY}"
else
  REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
fi

if [[ $QUIET != "true" ]]; then
  echo "=== nvidia-dgx-spark-lab Documentation Setup ==="
  echo "Repo root: ${REPO_ROOT}"
fi
cd "${REPO_ROOT}"

SITE_DIR="${REPO_ROOT}/docs-site"

# @function docs_venv_is_usable
# Return 0 if VENV_DIR has a working python (and pip) that can run under this OS.
#
# Args:
#   $1 — path to the virtualenv directory.
# Returns:
#   0 when the venv python and pip both execute, 1 otherwise.
docs_venv_is_usable() {
  local venv="${1:-}"
  local py=""
  if [[ -z ${venv} || ! -d ${venv} ]]; then
    return 1
  fi
  if [[ -x "${venv}/bin/python" ]]; then
    py="${venv}/bin/python"
  elif [[ -x "${venv}/bin/python3" ]]; then
    py="${venv}/bin/python3"
  else
    return 1
  fi
  # Broken host bind-mounts: symlink exists but target is missing / wrong OS.
  if ! "${py}" -c 'import sys' >/dev/null 2>&1; then
    return 1
  fi
  # A python that cannot run pip cannot install docs requirements.
  if ! "${py}" -m pip --version >/dev/null 2>&1; then
    return 1
  fi
  return 0
}

# @function docs_ensure_venv
# Create the isolated docs virtualenv, recreating it when it is unusable.
#
# Args:
#   none — reads VENV_DIR.
# Returns:
#   Shell status; exits with a message when a usable venv cannot be produced.
docs_ensure_venv() {
  if docs_venv_is_usable "${VENV_DIR}"; then
    if [[ $QUIET != "true" ]]; then
      echo "Virtualenv ${VENV_DIR} already exists and is usable."
    fi
    return 0
  fi

  if [[ -d ${VENV_DIR} ]]; then
    echo "setup-docs: recreating unusable docs venv at ${VENV_DIR} (host/foreign python?)" >&2
    rm -rf "${VENV_DIR}"
  elif [[ $QUIET != "true" ]]; then
    echo "Creating isolated docs virtualenv at ${VENV_DIR}..."
  fi
  python3 -m venv "${VENV_DIR}"

  if ! docs_venv_is_usable "${VENV_DIR}"; then
    echo "setup-docs: failed to create a usable virtualenv at ${VENV_DIR}" >&2
    return 1
  fi
}

# @function docs_install_python_deps
# Install the pinned Python tooling into the venv (pytest, coverage, Pillow for diffs).
#
# Args:
#   none — reads VENV_DIR.
# Returns:
#   Shell status from pip.
docs_install_python_deps() {
  local venv_py="${VENV_DIR}/bin/python"
  [[ -x ${venv_py} ]] || venv_py="${VENV_DIR}/bin/python3"

  # Always install through the venv python so a broken activate cannot fall through.
  "${venv_py}" -m pip install --upgrade pip setuptools wheel -q
  "${venv_py}" -m pip install -r docs/requirements.txt -q
}

# @function docs_install_site_deps
# Install the Next.js app dependencies with the pinned lockfile.
#
# Args:
#   none — operates on SITE_DIR.
# Returns:
#   0 when dependencies are present or were installed; exits when npm is missing.
docs_install_site_deps() {
  if [[ ! -f "${SITE_DIR}/package.json" ]]; then
    if [[ $QUIET != "true" ]]; then
      echo "docs-site/package.json not found — skipping npm install (partial checkout?)."
    fi
    return 0
  fi
  if ! command -v npm >/dev/null 2>&1; then
    echo "setup-docs: npm is required for the documentation site (Node.js 22+, see .devcontainer)" >&2
    return 1
  fi

  # node_modules is considered present only when the binaries the scripts need exist.
  if [[ -x "${SITE_DIR}/node_modules/.bin/next" && -x "${SITE_DIR}/node_modules/.bin/vitest" ]]; then
    if [[ $QUIET != "true" ]]; then
      echo "docs-site dependencies already installed."
    fi
    return 0
  fi

  if [[ $QUIET != "true" ]]; then
    echo "→ docs-site: npm ci (Next.js, Fumadocs, Vitest, Playwright)"
  fi
  (cd "${SITE_DIR}" && npm ci --legacy-peer-deps >/dev/null)
}

# Ensure docs/requirements.txt exists (pinned).
if [[ ! -f docs/requirements.txt ]]; then
  if [[ $QUIET != "true" ]]; then echo "Creating docs/requirements.txt..."; fi
  cat >docs/requirements.txt <<'EOF'
# Python tooling for the documentation pipeline (the site itself is Node-based).
# pytest + pytest-cov back //docs:test_python_coverage; Pillow backs screenshot diffs.
pytest>=8.0.0
pytest-cov>=6.0.0
Pillow>=10.0.0
EOF
elif [[ $QUIET != "true" ]]; then
  echo "docs/requirements.txt already exists (pinned versions)."
fi

# Update .bazelignore (idempotent append) so build outputs stay out of the Bazel graph.
if [[ -f .bazelignore ]] && ! grep -q "docs-site/out/" .bazelignore 2>/dev/null; then
  if [[ $QUIET != "true" ]]; then echo "Updating .bazelignore for docs build artifacts..."; fi
  cat >>.bazelignore <<'EOG'

# Docs site build outputs (Bazel should ignore)
docs-site/out/
docs-site/.next/
docs-site/.source/
EOG
fi

VENV_DIR="${VENV_DIR:-.venv-docs}"
docs_ensure_venv
docs_install_python_deps
docs_install_site_deps

if [[ $QUIET != "true" ]]; then
  echo ""
  echo "=== Setup complete ==="
  echo "Activate the Python toolchain: source ${VENV_DIR}/bin/activate"
  echo "Then:"
  echo "  ./docs/manage-docs.sh serve              # dev server + hot reload, auto-opens browser"
  echo "  ./docs/manage-docs.sh serve --port 3007 --no-browser"
  echo "  ./docs/manage-docs.sh build               # static export into docs-site/out/"
  echo "  ./docs/manage-docs.sh preview             # build + serve the export (final check)"
  echo "Or with Bazel: bazelisk run //docs:serve"
  echo ""
  echo "Content lives in docs/; the sidebar is docs-site/lib/nav.json (hand-edit it, then npm run nav:check)."
fi
