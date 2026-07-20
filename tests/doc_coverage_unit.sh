#!/usr/bin/env bash
# Run unit tests for doc_coverage pure helpers.
set -euo pipefail
ROOT="${BUILD_WORKSPACE_DIRECTORY:-}"
if [[ -z "${ROOT}" ]]; then
  if [[ -n "${TEST_SRCDIR:-}" ]]; then
    ROOT="${TEST_SRCDIR}/_main"
  else
    ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  fi
fi
cd "${ROOT}/tests"
# Import sibling doc_coverage.py from the tests package dir.
PYTHONPATH="${ROOT}/tests${PYTHONPATH:+:${PYTHONPATH}}" \
  python3 -m unittest test_doc_coverage -v
