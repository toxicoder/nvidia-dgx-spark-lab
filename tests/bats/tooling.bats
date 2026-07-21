#!/usr/bin/env bats
#
# Hermetic tests for repo tooling scripts (validate, yaml_format).

load 'test_helper'

setup() {
  TEST_TMP_DIR="$(mktemp -d)"
  export TEST_TMP_DIR
  REPO_ROOT="$(bats_canonical_repo_root)"
  export REPO_ROOT
}

teardown() {
  rm -rf "$TEST_TMP_DIR" || true
}

@test "validate.sh --help prints usage" {
  run bash "${REPO_ROOT}/scripts/validate.sh" --help
  [ "$status" -eq 0 ]
  [[ $output == *"Usage: validate.sh"* ]]
  [[ $output == *"--all"* ]]
  [[ $output == *"--ci"* ]]
}

@test "yaml_format.sh --help prints usage" {
  run bash "${REPO_ROOT}/scripts/yaml_format.sh" --help
  [ "$status" -eq 0 ]
  [[ $output == *"Usage: yaml_format.sh"* ]]
  [[ $output == *"--write"* ]]
  [[ $output == *"--check"* ]]
}

@test "prometheus_scrape dump_yaml_literal works" {
  run python3 "${REPO_ROOT}/scripts/lib/py/test_prometheus_scrape.py"
  [ "$status" -eq 0 ]
}

@test "Gitea CI long-lived branches match GitHub CI" {
  # development is the primary integration branch — both CI surfaces must run on it.
  # Use portable grep (not host ripgrep): GHA ubuntu-latest has no rg by default.
  local gh="${REPO_ROOT}/.github/workflows/ci.yml"
  local gitea="${REPO_ROOT}/.gitea/workflows/ci.yml"
  [[ -f $gh && -f $gitea ]]
  grep -q 'development' "$gh"
  grep -q 'development' "$gitea"
  # Pull-request targets should include development on both.
  grep -A2 'pull_request:' "$gh" | grep -q 'development'
  grep -A2 'pull_request:' "$gitea" | grep -q 'development'
}

# Extract unique "owner/name@vN" (or "owner/name@vN.M") pins from a workflow YAML.
# Ignores local composite actions (./.github/...).
_ci_action_pins() {
  local file="$1"
  # Match marketplace-style uses: lines; drop leading whitespace / "- uses:".
  grep -oE 'uses:[[:space:]]+[^[:space:]#]+' "$file" |
    sed -E 's/^uses:[[:space:]]+//' |
    grep -E '^[^./][^@]*@v[0-9]+' |
    sed -E 's|@v([0-9]+).*|@v\1|' |
    sort -u
}

@test "Gitea CI mirrors GitHub CI jobs, filters, commands, and action majors" {
  # Feature parity: .gitea/workflows/ci.yml is the Forgejo/Gitea mirror of
  # .github/workflows/ci.yml. Job graph, path filters, Bazel commands, and
  # marketplace action major versions must stay aligned. Intentional
  # non-parity (deploy-docs, dependabot, Gitea header comment) is out of scope.
  local gh="${REPO_ROOT}/.github/workflows/ci.yml"
  local gitea="${REPO_ROOT}/.gitea/workflows/ci.yml"
  [[ -f $gh && -f $gitea ]]

  local job
  for job in changes bazel-core dashboard-unit dashboard-hermetic docs-and-render validate-gate; do
    grep -qE "^  ${job}:" "$gh"
    grep -qE "^  ${job}:" "$gitea"
  done

  local filter
  for filter in bazel-core dashboard docs ci-graph ci-workflow; do
    grep -qE "^[[:space:]]+${filter}:" "$gh"
    grep -qE "^[[:space:]]+${filter}:" "$gitea"
  done

  local cmd
  for cmd in \
    '//:test-fast //:lint' \
    '//dashboard:fast-test' \
    'DASHBOARD_TEST_MODE=visual' \
    'DASHBOARD_TEST_MODE=full' \
    '//docs:test_mkdocs_render' \
    'scripts/ci_check_only.sh'; do
    grep -qF "$cmd" "$gh"
    grep -qF "$cmd" "$gitea"
  done

  # Shared setup composite must remain referenced from Gitea (do not fork it).
  grep -qF './.github/actions/setup-bazel' "$gitea"

  local gh_pins gitea_pins
  gh_pins="$(_ci_action_pins "$gh")"
  gitea_pins="$(_ci_action_pins "$gitea")"
  if [[ $gh_pins != "$gitea_pins" ]]; then
    echo "Marketplace action major pins differ (bump both in the same PR):" >&2
    echo "--- GitHub ---" >&2
    echo "$gh_pins" >&2
    echo "--- Gitea ---" >&2
    echo "$gitea_pins" >&2
    diff -u <(printf '%s\n' "$gh_pins") <(printf '%s\n' "$gitea_pins") >&2 || true
    return 1
  fi
}

@test "GitHub Actions cache action is Node-24-capable (not cache@v4)" {
  # actions/cache@v4 targets deprecated Node 20 on GitHub runners.
  # Prefer @v5+ (repo standard: @v6) in workflows and composite actions.
  # CI YAML is provided hermetically via //:ci_workflows runfiles.
  local setup_bazel="${REPO_ROOT}/.github/actions/setup-bazel/action.yml"
  local hits=""
  local f
  for f in \
    "${REPO_ROOT}/.github/actions/setup-bazel/action.yml" \
    "${REPO_ROOT}/.github/workflows/ci.yml" \
    "${REPO_ROOT}/.github/workflows/deploy-docs.yml" \
    "${REPO_ROOT}/.gitea/workflows/ci.yml"; do
    if [[ -f $f ]] && grep -qE 'actions/cache@v4([^0-9]|$)' "$f"; then
      hits+="$(grep -nE 'actions/cache@v4([^0-9]|$)' "$f")"$'\n'
    fi
  done
  if [[ -n $hits ]]; then
    echo "Found deprecated actions/cache@v4 (use actions/cache@v6):" >&2
    echo "$hits" >&2
    return 1
  fi
  # Positive control: setup-bazel must pin a modern cache major.
  [[ -f $setup_bazel ]]
  grep -qE 'actions/cache@v[56]([^0-9]|$)' "$setup_bazel"
}

@test "Deploy Documentation workflow publishes only after merge (not on PR)" {
  # Public docs go live via mike on push to long-lived branches (PR merge)
  # or workflow_dispatch. Opening a PR must not deploy-pages or trigger a
  # pull_request publish path (PR validation is //docs in CI).
  local deploy="${REPO_ROOT}/.github/workflows/deploy-docs.yml"
  [[ -f $deploy ]]
  # No PR trigger for this workflow.
  if grep -qE '^[[:space:]]*pull_request:' "$deploy"; then
    echo "deploy-docs.yml must not trigger on pull_request:" >&2
    grep -nE '^[[:space:]]*pull_request:' "$deploy" >&2 || true
    return 1
  fi
  # No GitHub Actions Pages deploy from this workflow (mike → gh-pages only).
  if grep -qF 'actions/deploy-pages' "$deploy"; then
    echo "deploy-docs.yml must not use actions/deploy-pages:" >&2
    grep -nF 'actions/deploy-pages' "$deploy" >&2 || true
    return 1
  fi
  if grep -qF 'upload-pages-artifact' "$deploy"; then
    echo "deploy-docs.yml must not upload Pages artifacts for PR preview:" >&2
    grep -nF 'upload-pages-artifact' "$deploy" >&2 || true
    return 1
  fi
  # Positive controls: merge/push + manual republish + mike publish.
  grep -qE '^[[:space:]]*push:' "$deploy"
  grep -qF 'workflow_dispatch' "$deploy"
  grep -qE 'branches:[[:space:]]*\[.*development' "$deploy"
  grep -qF 'mike deploy' "$deploy"
}
