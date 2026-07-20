#!/usr/bin/env bash
#
# setup-docs.sh
# Idempotent setup for Material for MkDocs documentation site.
# Must be run from repo root or docs/ dir (it cds appropriately).
# Forces bash, zsh-compatible.
# Creates pinned requirements, venv, updates .bazelignore if needed.
# Supports QUIET=true for automation from manage-docs.sh
#
# Usage: ./docs/setup-docs.sh
#        QUIET=true ./docs/setup-docs.sh

set -euo pipefail

QUIET=${QUIET:-false}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${BUILD_WORKSPACE_DIRECTORY:-}" ]]; then
    # bazel run support: operate on the real source checkout.
    REPO_ROOT="${BUILD_WORKSPACE_DIRECTORY}"
else
    REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
fi

if [[ "$QUIET" != "true" ]]; then
  echo "=== nvidia-dgx-spark-lab Documentation Setup ==="
  echo "Repo root: ${REPO_ROOT}"
fi
cd "${REPO_ROOT}"

# Ensure docs/requirements.txt exists (pinned)
if [[ ! -f docs/requirements.txt ]]; then
  if [[ "$QUIET" != "true" ]]; then echo "Creating docs/requirements.txt..."; fi
  cat > docs/requirements.txt << 'EOF'
mkdocs==1.6.1
mkdocs-material==9.7.6
mkdocs-glightbox==0.5.2
# Pin Playwright for reproducible visual goldens across local/CI Chromium builds.
playwright==1.61.0
Pillow>=10.0.0
# mkdocs-git-revision-date-localized==1.3.0
EOF
elif [[ "$QUIET" != "true" ]]; then
  echo "docs/requirements.txt already exists (pinned versions)."
fi

# Create isolated venv for docs
VENV_DIR=".venv-docs"
if [[ ! -d "${VENV_DIR}" ]]; then
  if [[ "$QUIET" != "true" ]]; then echo "Creating isolated docs virtualenv at ${VENV_DIR}..."; fi
  python3 -m venv "${VENV_DIR}"
elif [[ "$QUIET" != "true" ]]; then
  echo "Virtualenv ${VENV_DIR} already exists."
fi

# Activate and install
# shellcheck disable=SC1091
source "${VENV_DIR}/bin/activate"
pip install --upgrade pip setuptools wheel -q
pip install -r docs/requirements.txt -q

if [[ "$QUIET" != "true" ]]; then
  echo "Documentation dependencies installed in ${VENV_DIR}."
fi

# Update .bazelignore (idempotent append)
if ! grep -q "site/" .bazelignore 2>/dev/null; then
  if [[ "$QUIET" != "true" ]]; then echo "Updating .bazelignore for docs artifacts..."; fi
  cat >> .bazelignore << 'EOG'

# MkDocs generated output and venv (Bazel should ignore)
site/
.venv-docs/
__pycache__/
EOG
fi

# Create minimal docs/BUILD.bazel if not present (lightweight, shell-based)
if [[ ! -f docs/BUILD.bazel ]]; then
  if [[ "$QUIET" != "true" ]]; then echo "Creating docs/BUILD.bazel (lightweight shell wrapper)..."; fi
  cat > docs/BUILD.bazel << 'EOG'
"""Bazel targets for documentation site (Material for MkDocs).

Primary interface is still docs/manage-docs.sh for simplicity and
cross-platform compatibility.

Bazel users can do:
  bazel run //docs:serve
  bazel build //docs:docs
"""

load("@rules_shell//shell:sh_binary.bzl", "sh_binary")

sh_binary(
    name = "serve",
    srcs = ["manage-docs.sh"],
    args = ["serve"],
    data = [
        "//:mkdocs.yml",
        "assets",
        "generate_shell_docs.py",
        "hooks.py",
        "requirements.txt",
        "setup-docs.sh",
    ],
    visibility = ["//visibility:public"],
)

sh_binary(
    name = "docs",
    srcs = ["manage-docs.sh"],
    args = ["build"],
    data = [
        "//:mkdocs.yml",
        "assets",
        "generate_shell_docs.py",
        "hooks.py",
        "requirements.txt",
        "setup-docs.sh",
    ],
    visibility = ["//visibility:public"],
)

# Convenience: status
sh_binary(
    name = "status",
    srcs = ["manage-docs.sh"],
    args = ["status"],
    visibility = ["//visibility:public"],
)
EOG
elif [[ "$QUIET" != "true" ]]; then
  echo "docs/BUILD.bazel already exists."
fi

if [[ "$QUIET" != "true" ]]; then
  echo ""
  echo "=== Setup complete ==="
  echo "Activate venv: source .venv-docs/bin/activate"
  echo "Then: ./docs/manage-docs.sh serve          # auto-opens browser, port 8000"
  echo "       ./docs/manage-docs.sh serve --port 8080 --no-browser"
  echo "       ./docs/manage-docs.sh build         # strict by default"
  echo "       ./docs/manage-docs.sh preview       # build + static serve"
  echo "Or with Bazel: bazel run //docs:serve"

  echo ""
  echo "New QoL: auto-browser, --port, strict-by-default build, 'preview' cmd."

  echo ""
  echo "IMPORTANT: Review and customize the 'nav:' section in mkdocs.yml"
  echo "to match the actual docs/ file tree (Getting Started → Concepts → etc.)."
  echo "Run './docs/manage-docs.sh build --strict' after changes."

  echo ""
  echo "All original .md files preserved."
fi
