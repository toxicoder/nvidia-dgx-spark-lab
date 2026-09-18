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

failures=0

echo "→ Vitest: docs-site unit suite (cluster-variables contract)"
if [[ -x "${SITE_DIR}/node_modules/.bin/vitest" ]]; then
  (cd "$SITE_DIR" && ./node_modules/.bin/vitest run) || failures=$((failures + 1))
else
  echo "  node_modules missing; installing" >&2
  (cd "$SITE_DIR" && npm ci --legacy-peer-deps) >/dev/null 2>&1 || true
  (cd "$SITE_DIR" && ./node_modules/.bin/vitest run) || failures=$((failures + 1))
fi

echo "→ Python: docs-site panel wiring checks"
python3 "${SCRIPT_DIR}/test_command_vars.py" || failures=$((failures + 1))

if [[ $failures -gt 0 ]]; then
  echo "${failures} command-vars check(s) failed" >&2
  exit 1
fi
echo "command-vars contract OK"
