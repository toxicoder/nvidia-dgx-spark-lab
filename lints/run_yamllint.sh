#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${BUILD_WORKSPACE_DIRECTORY:-}" ]]; then
  ROOT="${BUILD_WORKSPACE_DIRECTORY}"
elif [[ -n "${TEST_SRCDIR:-}" ]]; then
  ROOT="${TEST_SRCDIR}/_main"
else
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
source "$ROOT/scripts/lib/check_tool.sh"

check_tool yamllint "pip install yamllint"
cd "$ROOT"

echo "Running yamllint..."
yamllint --version
# Errors fail the target; line-length etc. stay warnings (see .yamllint.yml).
yamllint -c .yamllint.yml .
echo "YAML lint passed."
