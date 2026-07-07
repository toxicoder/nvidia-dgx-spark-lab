#!/usr/bin/env bash
#
# ## Hermetic dashboard test entrypoint (in-container)
#
# Orchestrates the dashboard CI pipeline inside the test Docker image.
#
# Modes (DASHBOARD_TEST_MODE):
#   fast      — vitest run + lint + typecheck (no coverage, no visual)
#   coverage  — vitest with 100% coverage gate only
#   full      — default: coverage + build + lint/tsc + Playwright visual
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

MODE="${DASHBOARD_TEST_MODE:-full}"
VISUAL_HARNESS_ENV=(
  USE_MOCKS=1
  AUTH_BYPASS=1
  VISUAL_TEST=1
  BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-visual-test-only-not-for-production}"
)

run_vitest() {
  if [[ "${UPDATE_SNAPSHOTS:-0}" == "1" ]]; then
    UPDATE_SNAPSHOTS=1 npm run test:coverage
  elif [[ "$MODE" == "fast" ]]; then
    npm test -- --run
  else
    npm run test:coverage
  fi
}

run_fast_checks() {
  echo "==> ESLint + TypeScript check (parallel)"
  npm run lint &
  lint_pid=$!
  npm run typecheck &
  typecheck_pid=$!
  lint_status=0
  typecheck_status=0
  wait "$lint_pid" || lint_status=$?
  wait "$typecheck_pid" || typecheck_status=$?
  if [[ "$lint_status" -ne 0 || "$typecheck_status" -ne 0 ]]; then
    exit 1
  fi
}

case "$MODE" in
  fast)
    echo "==> Dashboard fast mode: Vitest + lint + typecheck"
    run_vitest
    run_fast_checks
    echo "==> Dashboard fast tests passed"
    exit 0
    ;;
  coverage)
    echo "==> Dashboard coverage mode: Vitest 100% gate"
    run_vitest
    echo "==> Dashboard coverage tests passed"
    exit 0
    ;;
  full) ;;
  *)
    echo "test-entrypoint: unknown DASHBOARD_TEST_MODE=$MODE (use fast, coverage, full)" >&2
    exit 2
    ;;
esac

echo "==> Vitest unit tests + 100% coverage gate"
run_vitest

echo "==> Next.js production build"
env "${VISUAL_HARNESS_ENV[@]}" npm run build

run_fast_checks

echo "==> Playwright visual regression"
export CI=1
export PLAYWRIGHT_SKIP_BUILD=1
for kv in "${VISUAL_HARNESS_ENV[@]}"; do
  export "${kv?}"
done

if [[ "${UPDATE_SNAPSHOTS:-0}" == "1" ]]; then
  npm run visual:update
else
  npm run visual
fi

echo "==> All hermetic dashboard tests passed"