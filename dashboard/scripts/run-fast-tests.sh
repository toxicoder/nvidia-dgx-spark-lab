#!/usr/bin/env bash
#
# Host-native fast dashboard tests (Vitest + lint + typecheck; no Docker, no Playwright).
#
# Usage:
#   ./dashboard/scripts/run-fast-tests.sh
#   bazelisk run //dashboard:fast-test
#
set -euo pipefail

if [[ -n ${BUILD_WORKSPACE_DIRECTORY:-} ]]; then
  ROOT="${BUILD_WORKSPACE_DIRECTORY}"
else
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi

cd "$ROOT/dashboard"

if [[ ! -x "node_modules/.bin/vitest" ]]; then
  echo "==> dashboard fast-test: installing npm deps"
  npm ci --legacy-peer-deps
fi

export DASHBOARD_TEST_MODE=fast
exec bash scripts/test-entrypoint.sh
