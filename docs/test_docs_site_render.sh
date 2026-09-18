#!/usr/bin/env bash
#
# test_docs_site_render.sh
# Runner for the documentation-site render checks (docs/test_docs_site_render.py).
#
# Replaces test_mkdocs_render.sh. The source-level checks always run; the checks that read
# the published output are skipped unless an export exists, so this stays usable as a fast
# gate. Set DOCS_REQUIRE_EXPORT=1 to build the export first and make those checks real
# instead of skipped (what the CI docs job does).
#
# Usage:
#   ./docs/test_docs_site_render.sh              # source checks; export checks skip if absent
#   DOCS_REQUIRE_EXPORT=1 ./docs/test_docs_site_render.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n ${BUILD_WORKSPACE_DIRECTORY:-} ]]; then
  REPO_ROOT="${BUILD_WORKSPACE_DIRECTORY}"
else
  REPO_ROOT="$(dirname "$SCRIPT_DIR")"
fi
SITE_DIR="${REPO_ROOT}/docs-site"

find_py() {
  local d="$1"
  if [[ -f "$d/test_docs_site_render.py" ]]; then
    echo "$d/test_docs_site_render.py"
    return 0
  fi
  if [[ -f "${REPO_ROOT}/docs/test_docs_site_render.py" ]]; then
    echo "${REPO_ROOT}/docs/test_docs_site_render.py"
    return 0
  fi
  # Bazel runfiles layout for sh_test data deps.
  local rf="${RUNFILES_DIR:-${JAVA_RUNFILES:-}}"
  if [[ -n $rf ]]; then
    local found
    found="$(find "$rf" -path '*docs/test_docs_site_render.py' 2>/dev/null | head -1 || true)"
    if [[ -n $found ]]; then
      echo "$found"
      return 0
    fi
  fi
  echo "$d/test_docs_site_render.py"
}

if [[ ${DOCS_REQUIRE_EXPORT:-} == "1" ]]; then
  echo "→ building the documentation site export"
  (cd "$SITE_DIR" && npm run --if-present build >/dev/null || "${SITE_DIR}/run_npm.sh" build)
fi

exec python3 "$(find_py "$SCRIPT_DIR")" "$@"
