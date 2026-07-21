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
  local gh="${REPO_ROOT}/.github/workflows/ci.yml"
  local gitea="${REPO_ROOT}/.gitea/workflows/ci.yml"
  [[ -f $gh && -f $gitea ]]
  rg -q 'development' "$gh"
  rg -q 'development' "$gitea"
  # Pull-request targets should include development on both.
  rg -A2 'pull_request:' "$gh" | rg -q 'development'
  rg -A2 'pull_request:' "$gitea" | rg -q 'development'
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
    if [[ -f $f ]] && rg -q 'actions/cache@v4\b' "$f"; then
      hits+="$(rg -n 'actions/cache@v4\b' "$f")"$'\n'
    fi
  done
  if [[ -n $hits ]]; then
    echo "Found deprecated actions/cache@v4 (use actions/cache@v6):" >&2
    echo "$hits" >&2
    return 1
  fi
  # Positive control: setup-bazel must pin a modern cache major.
  [[ -f $setup_bazel ]]
  rg -q 'actions/cache@v[56]\b' "$setup_bazel"
}
