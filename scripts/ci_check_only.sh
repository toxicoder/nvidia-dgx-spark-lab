#!/usr/bin/env bash
#
# ## ci_check_only — lightweight CI validate-gate
#
# Verifies path-filtered GitHub/Gitea jobs reported success (or were correctly
# skipped). No Bazel cold start — intended for the validate-gate job only.
#
# Env (set by CI):
#   BAZEL_CORE_RESULT, DASHBOARD_UNIT_RESULT, DASHBOARD_HERMETIC_RESULT, DOCS_RESULT
#   RUN_BAZEL_CORE, RUN_DASHBOARD, RUN_DOCS  (true/false or 1/0)
#
set -euo pipefail

fail=0

check_job() {
  local name="$1"
  local should_run="$2"
  local result="$3"
  if [[ $should_run != "1" && $should_run != "true" ]]; then
    echo "skip $name (unchanged paths)"
    return 0
  fi
  if [[ $result != "success" ]]; then
    echo "FAIL $name result=$result"
    fail=1
  else
    echo "ok $name"
  fi
}

check_job bazel-core "${RUN_BAZEL_CORE:-0}" "${BAZEL_CORE_RESULT:-skipped}"
check_job dashboard-unit "${RUN_DASHBOARD:-0}" "${DASHBOARD_UNIT_RESULT:-${DASHBOARD_RESULT:-skipped}}"
check_job dashboard-hermetic "${RUN_DASHBOARD:-0}" "${DASHBOARD_HERMETIC_RESULT:-${DASHBOARD_RESULT:-skipped}}"
check_job docs-and-render "${RUN_DOCS:-0}" "${DOCS_RESULT:-skipped}"

exit "$fail"
