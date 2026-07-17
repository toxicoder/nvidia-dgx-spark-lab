#!/usr/bin/env bats
#
# Hermetic tests for repo tooling scripts (validate, yaml_format).

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