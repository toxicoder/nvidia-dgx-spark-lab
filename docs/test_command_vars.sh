#!/usr/bin/env bash
#
# test_command_vars.sh
# Contract gate for the interactive cluster-variables panel.
#
# Replaces the MkDocs-era version of this gate.  Two halves, both fast and browser-free:
#   1. the Vitest unit suite in docs-site/tests/unit, which exercises the shipped component
#      (seed/merge/profile/substitute plus the mutation guard that stops the rewrite loop);
#   2. the Python checks in docs/test_command_vars.py, which pin the wiring around it — the
#      pages that must mount the panel, the storage key, and that the export leaves the
#      tokens editable rather than frozen into literals.
#
# Usage: ./docs/test_command_vars.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n ${BUILD_WORKSPACE_DIRECTORY:-} ]]; then
  REPO_ROOT="${BUILD_WORKSPACE_DIRECTORY}"
else
  REPO_ROOT="$(dirname "$SCRIPT_DIR")"
fi
SITE_DIR="${REPO_ROOT}/docs-site"
# Under `bazelisk test` the site arrives as runfiles symlinks into the workspace, and Vite
# resolves modules to their real path. Running from the symlinked tree loads React, vitest and
# the setup file twice -- once per tree -- so jest-dom registers its matchers on a different
# expect than the specs use (`Invalid Chai property: toBeInTheDocument`). Follow the links to
# the physical package directory, as tests/shell_coverage.sh does for kcov.
if [[ -f "${SITE_DIR}/package.json" ]]; then
  PHYSICAL_SITE_DIR="$(dirname "$(readlink -f "${SITE_DIR}/package.json" 2>/dev/null || true)")"
  if [[ -n $PHYSICAL_SITE_DIR && -d $PHYSICAL_SITE_DIR ]]; then
    SITE_DIR="$PHYSICAL_SITE_DIR"
  fi
fi

failures=0

echo "→ Vitest: docs-site unit suite (cluster-variables contract)"
(
  cd "$SITE_DIR"
  # The same lock //docs-site:unit takes. Both targets resolve to this one physical package
  # directory, and two first-run `npm ci` calls in it race (`npm error ENOTEMPTY`). It is held
  # for the rest of this subshell, so the install cannot land under a running suite.
  if [[ -f scripts/npm-install-lock.sh ]]; then
    # shellcheck source=/dev/null
    source ./scripts/npm-install-lock.sh
    npm_install_lock "$SITE_DIR"
  fi
  if [[ ! -x node_modules/.bin/vitest ]]; then
    echo "  node_modules missing; installing" >&2
    npm ci --legacy-peer-deps
  fi
  ./node_modules/.bin/vitest run
) || failures=$((failures + 1))

echo "→ Python: docs-site panel wiring checks"
python3 "${SCRIPT_DIR}/test_command_vars.py" || failures=$((failures + 1))

if [[ $failures -gt 0 ]]; then
  echo "${failures} command-vars check(s) failed" >&2
  exit 1
fi
echo "command-vars contract OK"
