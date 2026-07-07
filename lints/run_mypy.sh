#!/usr/bin/env bash
# Purpose: Run mypy strict type-checking on all git-tracked Python files.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${BUILD_WORKSPACE_DIRECTORY:-}" ]]; then
  ROOT="${BUILD_WORKSPACE_DIRECTORY}"
elif [[ -n "${TEST_SRCDIR:-}" ]]; then
  ROOT="${TEST_SRCDIR}/_main"
else
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
# shellcheck source=../scripts/lib/check_tool.sh
source "$ROOT/scripts/lib/check_tool.sh"

check_tool python3 "install Python 3"
check_tool mypy "pip install mypy or add to devcontainer"

cd "$ROOT"
mapfile -t PY_FILES < <(git ls-files '*.py')
if [[ ${#PY_FILES[@]} -eq 0 ]]; then
  echo "mypy: no tracked Python files"
  exit 0
fi

echo "Running mypy on ${#PY_FILES[@]} file(s)..."
python3 -m mypy --config-file mypy.ini "${PY_FILES[@]}"
echo "mypy: all checks passed"