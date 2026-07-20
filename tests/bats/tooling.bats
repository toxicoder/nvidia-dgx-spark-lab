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
