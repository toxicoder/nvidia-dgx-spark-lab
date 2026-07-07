#!/usr/bin/env bats
#
# Hermetic tests for repo tooling scripts (validate, yaml_format, rebuild-history).

load 'test_helper'

setup() {
  TEST_TMP_DIR="$(mktemp -d)"
  export TEST_TMP_DIR
  export REPO_ROOT="$(bats_canonical_repo_root)"
}

teardown() {
  rm -rf "$TEST_TMP_DIR" || true
}

@test "validate.sh --help prints usage" {
  run bash "${REPO_ROOT}/scripts/validate.sh" --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage: validate.sh"* ]]
  [[ "$output" == *"--all"* ]]
  [[ "$output" == *"--ci"* ]]
}

@test "yaml_format.sh --help prints usage" {
  run bash "${REPO_ROOT}/scripts/yaml_format.sh" --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage: yaml_format.sh"* ]]
  [[ "$output" == *"--write"* ]]
  [[ "$output" == *"--check"* ]]
}

@test "rebuild-history.sh rejects an invalid WIP ref" {
  run env REBUILD_WIP_REF=does-not-exist bash "${REPO_ROOT}/scripts/utilities/rebuild-history.sh" 2>&1
  [ "$status" -ne 0 ]
}

@test "rebuild-history cleanup removes archive tags and transient branches" {
  local mini_repo="$TEST_TMP_DIR/rebuild-cleanup"
  git init -q -b main "$mini_repo"
  cd "$mini_repo"
  git config user.email "test@example.com"
  git config user.name "Test"
  git commit --allow-empty -q -m "init"
  git tag archive/pre-rebuild-20990101
  git tag archive/pre-cleanup-20990101
  git branch wip/integration
  git branch rebuilt-main
  git branch rebuild-temp

  # shellcheck disable=SC1091
  source "${REPO_ROOT}/scripts/lib/rebuild-cleanup.sh"
  cleanup_rebuild_refs

  [ "$(git tag -l)" = "" ]
  ! git show-ref --verify --quiet refs/heads/wip/integration
  ! git show-ref --verify --quiet refs/heads/rebuilt-main
  ! git show-ref --verify --quiet refs/heads/rebuild-temp
  git show-ref --verify --quiet refs/heads/main
}