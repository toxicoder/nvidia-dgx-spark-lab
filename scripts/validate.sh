#!/usr/bin/env bash
#
# ## validate — unified build / test / lint orchestrator
#
# Single entry point for local and CI validation. Mirrors path filters from
# `.github/workflows/ci.yml` so developers run the same slices CI would run.
#
# **Behavior**: the core slice (build --nobuild, test-fast, lint) always runs;
# docs and dashboard slices are gated by changed paths, `--all`, or CI env vars.
#
# **Safety**: delegates to existing Bazel targets (`//:test-fast`, safety
# invariants, lint). Does not bypass manage.sh confirmations or weaken k8s
# manifest checks.
#
# Usage:
#   bazelisk run //:validate
#   bazelisk run //:validate -- --all
#   bazelisk run //:validate -- --update-goldens
#   bazelisk run //:validate -- --ci --check-only
#
# @command validate
# @description Run build, test, lint, and conditional docs/dashboard checks based on changed paths.
# Usage: bazelisk run //:validate [-- --all | --update-goldens | --ci [--check-only]]
# Safety: Read-only orchestration; calls existing hermetic test targets only.
# Examples:
#   bazelisk run //:validate
#   bazelisk run //:validate -- --all
#   UPDATE_SNAPSHOTS=1 bazelisk run //:validate -- --update-goldens

set -euo pipefail

# When invoked via `bazel run`, the script lives under bazel-bin/; use the
# workspace env var Bazel sets so nested bazelisk calls run from the repo root.
if [[ -n ${BUILD_WORKSPACE_DIRECTORY:-} ]]; then
  ROOT="${BUILD_WORKSPACE_DIRECTORY}"
  # shellcheck source=lib/paths.sh disable=SC1091
  source "${ROOT}/scripts/lib/paths.sh"
else
  # shellcheck source=lib/paths.sh disable=SC1091
  source "$(cd "$(dirname "${0}")" && pwd)/lib/paths.sh"
  ROOT="$(cd "$(lab_script_dir 0 scripts)/.." && pwd)"
fi
cd "$ROOT"

BAZEL="${BAZEL:-$(command -v bazelisk 2>/dev/null || command -v bazel 2>/dev/null || true)}"

RUN_ALL=0
RUN_CI=0
CHECK_ONLY=0
UPDATE_GOLDENS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)
      RUN_ALL=1
      shift
      ;;
    --ci)
      RUN_CI=1
      shift
      ;;
    --check-only)
      CHECK_ONLY=1
      shift
      ;;
    --update-goldens)
      UPDATE_GOLDENS=1
      shift
      ;;
    -h | --help)
      cat <<'EOF'
Usage: validate.sh [--all] [--ci] [--check-only] [--update-goldens]

  (default)   Git-aware: run slices matching changed paths vs merge-base.
  --all       Run every slice regardless of changes.
  --ci        Use RUN_BAZEL_CORE / RUN_DOCS / RUN_DASHBOARD env (CI paths-filter).
  --check-only  With --ci: verify parallel job results only (no heavy re-run).
  --update-goldens  Regenerate docs/dashboard visual baselines when slices run.
EOF
      exit 0
      ;;
    *)
      echo "validate: unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

need_bazel() {
  if [[ -z $BAZEL ]]; then
    echo "validate: bazelisk or bazel not found in PATH" >&2
    exit 1
  fi
}

# --- path filter helpers (mirror .github/workflows/ci.yml) ---

path_matches_bazel_core() {
  local path="$1"
  [[ $path == scripts/* ]] && return 0
  [[ $path == k8s/* ]] && return 0
  [[ $path == ansible/* ]] && return 0
  [[ $path == tests/* ]] && return 0
  [[ $path == lints/* ]] && return 0
  [[ $path == helm/* ]] && return 0
  [[ $path == mcp/* ]] && return 0
  [[ $path == hermes/* ]] && return 0
  [[ $path == config/* ]] && return 0
  return 1
}

path_matches_dashboard() {
  local path="$1"
  [[ $path == dashboard/* ]] && return 0
  [[ $path == scripts/utilities/* ]] && return 0
  return 1
}

path_matches_docs() {
  local path="$1"
  # Do not fire docs/Playwright for arbitrary scripts — only shell doc sources
  # and docs tree. Mirrors .github/workflows/ci.yml docs filter.
  [[ $path == docs/* ]] && return 0
  [[ $path == mkdocs.yml ]] && return 0
  [[ $path == scripts/manage.sh ]] && return 0
  [[ $path == scripts/lib/* ]] && return 0
  [[ $path == scripts/utilities/* ]] && return 0
  return 1
}

# Graph / orchestrator changes force all expensive CI slices.
path_matches_ci_graph() {
  local path="$1"
  [[ $path == BUILD.bazel ]] && return 0
  [[ $path == MODULE.bazel ]] && return 0
  [[ $path == MODULE.bazel.lock ]] && return 0
  [[ $path == .bazelrc ]] && return 0
  [[ $path == .bazelversion ]] && return 0
  [[ $path == fix.sh ]] && return 0
  [[ $path == scripts/validate.sh ]] && return 0
  return 1
}

# Workflow/action YAML only — does not force hermetic/docs by itself.
path_matches_ci_workflow() {
  local path="$1"
  [[ $path == .github/* ]] && return 0
  [[ $path == .gitea/* ]] && return 0
  return 1
}

path_matches_ci_config() {
  local path="$1"
  path_matches_ci_graph "$path" && return 0
  path_matches_ci_workflow "$path" && return 0
  return 1
}

classify_path() {
  local path="$1"
  path_matches_bazel_core "$path" && echo bazel-core
  path_matches_dashboard "$path" && echo dashboard
  path_matches_docs "$path" && echo docs
  path_matches_ci_graph "$path" && echo ci-graph
  path_matches_ci_workflow "$path" && echo ci-workflow
}

detect_changed_slices() {
  local slices=()
  local base=""
  local path class

  if git rev-parse --verify main >/dev/null 2>&1; then
    base="$(git merge-base HEAD main 2>/dev/null || echo HEAD)"
  elif git rev-parse --verify HEAD >/dev/null 2>&1; then
    base="HEAD"
  else
    echo "validate: no git history; use --all for first commit" >&2
    return 1
  fi

  while IFS= read -r path; do
    [[ -z $path ]] && continue
    class="$(classify_path "$path" || true)"
    [[ -z $class ]] && continue
    slices+=("$class")
  done < <(
    git diff --name-only "$base" HEAD 2>/dev/null
    git diff --name-only --cached
    git diff --name-only
  )

  if [[ ${#slices[@]} -eq 0 ]]; then
    return 1
  fi

  local want_bazel=0 want_docs=0 want_dashboard=0
  for class in "${slices[@]}"; do
    case "$class" in
      bazel-core) want_bazel=1 ;;
      docs) want_docs=1 ;;
      dashboard) want_dashboard=1 ;;
      # Graph/orchestrator changes force all expensive slices.
      ci-graph)
        want_bazel=1
        want_docs=1
        want_dashboard=1
        ;;
      # Workflow YAML alone: core only (setup-bazel / lint install paths).
      ci-workflow) want_bazel=1 ;;
      # Legacy label from older classify_path
      ci-config)
        want_bazel=1
        want_docs=1
        want_dashboard=1
        ;;
    esac
  done

  RUN_BAZEL_CORE=$want_bazel
  RUN_DOCS=$want_docs
  RUN_DASHBOARD=$want_dashboard
}

resolve_slices() {
  if [[ $RUN_ALL -eq 1 ]]; then
    RUN_BAZEL_CORE=1
    RUN_DOCS=1
    RUN_DASHBOARD=1
    return 0
  fi

  if [[ $RUN_CI -eq 1 ]]; then
    # Accept both RUN_BAZEL_CORE and legacy RUN_BAZEL from workflow env.
    RUN_BAZEL_CORE="${RUN_BAZEL_CORE:-${RUN_BAZEL:-0}}"
    RUN_DOCS="${RUN_DOCS:-0}"
    RUN_DASHBOARD="${RUN_DASHBOARD:-0}"
    # Graph/orchestrator changes force all slices. Workflow-only does not.
    if [[ ${RUN_CI_GRAPH:-0} == "1" || ${RUN_CI_GRAPH:-} == "true" ]]; then
      RUN_BAZEL_CORE=1
      RUN_DOCS=1
      RUN_DASHBOARD=1
    fi
    # Legacy RUN_CI_CONFIG=1 meant "everything" — keep that for old callers.
    if [[ ${RUN_CI_CONFIG:-0} == "1" || ${RUN_CI_CONFIG:-} == "true" ]]; then
      if [[ ${RUN_CI_GRAPH:-0} == "1" || ${RUN_CI_GRAPH:-} == "true" ]]; then
        :
      elif [[ -z ${RUN_CI_GRAPH:-} ]]; then
        # Old workflows only set RUN_CI_CONFIG — preserve full force.
        RUN_BAZEL_CORE=1
        RUN_DOCS=1
        RUN_DASHBOARD=1
      fi
    fi
    # Normalize workflow true/false strings to 1/0.
    [[ $RUN_BAZEL_CORE == "true" ]] && RUN_BAZEL_CORE=1
    [[ $RUN_DOCS == "true" ]] && RUN_DOCS=1
    [[ $RUN_DASHBOARD == "true" ]] && RUN_DASHBOARD=1
    return 0
  fi

  RUN_BAZEL_CORE=0
  RUN_DOCS=0
  RUN_DASHBOARD=0
  if detect_changed_slices; then
    :
  else
    echo "validate: no matching path changes detected; running core only"
  fi
}

ci_check_only_gate() {
  local fail=0
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
}

check_generated_artifacts() {
  local dirty=0
  if ! git diff --quiet -- docs/generated/shell/reference.md 2>/dev/null; then
    echo "validate: docs/generated/shell/reference.md is dirty — run: bazelisk run //docs:docs" >&2
    dirty=1
  fi
  if [[ ${RUN_DASHBOARD:-0} == "1" ]] && ! git diff --quiet -- docs/generated/dashboard-api 2>/dev/null; then
    echo "validate: docs/generated/dashboard-api is dirty — run: bazelisk run //dashboard:docs" >&2
    dirty=1
  fi
  if [[ $dirty -ne 0 ]]; then
    exit 1
  fi
  echo "validate: generated docs artifacts are committed"
}

run_core_slice() {
  echo "==> validate: core (build --nobuild, test-fast, lint, key builds)"
  need_bazel
  "$BAZEL" build //... --nobuild
  # test-fast already includes //tests:manifest_coverage — do not re-run it.
  "$BAZEL" test //:test-fast
  if [[ $RUN_ALL -eq 1 ]]; then
    # python coverage is in test-fast; re-run is cheap when cached. Keep
    # optional host-tool suites behind --all only.
    if command -v helm >/dev/null 2>&1; then
      echo "==> validate: helm chart template smoke test"
      "$BAZEL" test //helm:chart_test --test_tag_filters=manual
    else
      echo "validate: skipping //helm:chart_test (helm not in PATH)"
    fi
    if command -v kcov >/dev/null 2>&1 && kcov /tmp/kcov-validate-probe /usr/bin/true >/dev/null 2>&1; then
      rm -rf /tmp/kcov-validate-probe
      echo "==> validate: shell line coverage (kcov + BATS)"
      "$BAZEL" test //tests:shell_coverage --test_tag_filters=manual
    else
      rm -rf /tmp/kcov-validate-probe 2>/dev/null || true
      echo "validate: skipping //tests:shell_coverage (kcov unavailable on this host; use Linux devcontainer)"
    fi
  fi
  "$BAZEL" test //:lint --test_tag_filters=manual
  "$BAZEL" build //:manage //:all
}

run_docs_slice() {
  need_bazel
  "$BAZEL" run //docs:docs
  if [[ $UPDATE_GOLDENS -eq 1 ]]; then
    echo "==> validate: docs (visual golden update)"
    UPDATE_SNAPSHOTS=1 "$BAZEL" run //docs:visual-update
  elif [[ $RUN_ALL -eq 1 ]]; then
    echo "==> validate: docs (build + visual regression)"
    "$BAZEL" test //docs:test_mkdocs_render
  else
    echo "==> validate: docs (fast build checks; visual on --all)"
    "$BAZEL" test //docs:test_mkdocs_build
  fi
}

run_dashboard_slice() {
  if [[ $RUN_ALL -eq 1 || $UPDATE_GOLDENS -eq 1 ]]; then
    echo "==> validate: dashboard (hermetic Docker: Vitest + build + Playwright)"
    if ! command -v docker >/dev/null 2>&1; then
      echo "validate: docker not found; install Docker Desktop and retry" >&2
      exit 1
    fi
    if ! docker info >/dev/null 2>&1; then
      echo "validate: docker daemon not reachable; start/restart Docker Desktop and retry" >&2
      exit 1
    fi
    if [[ $UPDATE_GOLDENS -eq 1 ]]; then
      UPDATE_SNAPSHOTS=1 "$ROOT/dashboard/scripts/run-hermetic-tests.sh"
    else
      "$BAZEL" run //dashboard:hermetic-test
    fi
  else
    echo "==> validate: dashboard (fast: Vitest + lint + typecheck; full visual on --all)"
    "$BAZEL" run //dashboard:fast-test
  fi
}

# --- main ---

resolve_slices

echo "validate: slices — bazel-core=${RUN_BAZEL_CORE:-0} docs=${RUN_DOCS:-0} dashboard=${RUN_DASHBOARD:-0}"

if [[ $RUN_CI -eq 1 && $CHECK_ONLY -eq 1 ]]; then
  ci_check_only_gate
fi

# Core always runs (fast feedback even when only docs/dashboard changed)
run_core_slice

if [[ ${RUN_DOCS:-0} == "1" || ${RUN_DOCS} == "true" ]]; then
  run_docs_slice
fi

if [[ ${RUN_DASHBOARD:-0} == "1" || ${RUN_DASHBOARD} == "true" ]]; then
  run_dashboard_slice
fi

if [[ $CHECK_ONLY -eq 1 ]]; then
  check_generated_artifacts
fi

echo "validate: all requested slices passed"
