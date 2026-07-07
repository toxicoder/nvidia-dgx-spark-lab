#!/usr/bin/env bash
# Runner for the MkDocs render test (build + HTML/JS asset / mermaid validation + browser visual goldens).
# The visual portion (Playwright screenshots of key pages vs goldens) makes actual
# rendered site part of the test suite.
# - Current renders are *always generated* when the test runs (actuals in outputs).
# - Diffs vs committed goldens fail the test.
# - UPDATE_SNAPSHOTS=1 approves/updates goldens (via visual-update target).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Reuse the official setup so mkdocs + plugins (incl. playwright) are present in the venv.
# This mirrors how manage-docs.sh works.
if [[ -f "$SCRIPT_DIR/setup-docs.sh" ]]; then
    QUIET=true "$SCRIPT_DIR/setup-docs.sh" || true
fi

# Activate if the venv was created by setup-docs.sh
VENV_DIR="${BUILD_WORKSPACE_DIRECTORY:-$SCRIPT_DIR/..}/.venv-docs"
if [[ -f "$VENV_DIR/bin/activate" ]]; then
    # shellcheck disable=SC1091
    source "$VENV_DIR/bin/activate" || true
fi

# Determine a python interpreter that sees the activated venv packages (activate may
# only affect PATH for this shell; be explicit for bazel sh_binary runs).
PYTHON="python3"
if [[ -x "$VENV_DIR/bin/python" ]]; then
  PYTHON="$VENV_DIR/bin/python"
elif [[ -x "$VENV_DIR/bin/python3" ]]; then
  PYTHON="$VENV_DIR/bin/python3"
fi

MKDOCS_TEST_MODE="${MKDOCS_TEST_MODE:-all}"

# Ensure browser binaries for Playwright visual tests (idempotent, best-effort).
# Skip when running build-only mode (fast path for //:test-fast).
if [[ "$MKDOCS_TEST_MODE" != "build" ]]; then
    if "$PYTHON" -c "import playwright" >/dev/null 2>&1; then
        "$PYTHON" -m playwright install --with-deps chromium >/dev/null 2>&1 || true
    fi
fi

# Robustly locate the companion .py (works for: direct source run, sh_test sandbox,
# sh_binary via bazel run which uses runfiles layout for data= deps).
find_py() {
  local d
  d="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -f "$d/test_mkdocs_render.py" ]]; then
    echo "$d/test_mkdocs_render.py"
    return 0
  fi
  if [[ -n "${BUILD_WORKSPACE_DIRECTORY:-}" && -f "${BUILD_WORKSPACE_DIRECTORY}/docs/test_mkdocs_render.py" ]]; then
    echo "${BUILD_WORKSPACE_DIRECTORY}/docs/test_mkdocs_render.py"
    return 0
  fi
  # Bazel runfiles (sh_binary data files live here: $RUNFILES_DIR/_main/docs/...)
  local rf="${RUNFILES_DIR:-${JAVA_RUNFILES:-}}"
  if [[ -n "$rf" ]]; then
    if [[ -f "$rf/_main/docs/test_mkdocs_render.py" ]]; then
      echo "$rf/_main/docs/test_mkdocs_render.py"
      return 0
    fi
    local found
    found="$(find "$rf" -path '*docs/test_mkdocs_render.py' 2>/dev/null | head -1 || true)"
    if [[ -n "$found" ]]; then
      echo "$found"
      return 0
    fi
  fi
  # Fallback (will likely fail loudly, surfaces the real layout issue)
  echo "$d/test_mkdocs_render.py"
}

PY="$(find_py)"
exec "$PYTHON" "$PY" "$@"