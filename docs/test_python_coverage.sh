#!/usr/bin/env bash
# Enforce 100% line coverage on docs Python tooling.
set -euo pipefail

ROOT="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$ROOT"

PY="${PYTHON:-python3}"

if ! "$PY" -c "import pytest, pytest_cov" 2>/dev/null; then
  echo "test_python_coverage: install pytest and pytest-cov (pip install pytest pytest-cov)" >&2
  exit 1
fi

cd "$ROOT/docs"
"$PY" -m pytest \
  test_generate_shell_docs.py \
  test_hooks.py \
  --cov=generate_shell_docs \
  --cov=hooks \
  --cov-report=term-missing \
  --cov-fail-under=100 \
  -q

echo "test_python_coverage: 100% on docs Python modules"