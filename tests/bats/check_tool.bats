#!/usr/bin/env bats
#
# Hermetic tests for scripts/lib/check_tool.sh CI vs resilient behavior.

load 'test_helper'

setup() {
  CHECK_TOOL="${BATS_TEST_DIRNAME}/../../scripts/lib/check_tool.sh"
}

@test "check_tool skips missing tool when CI is unset" {
  run bash -c "source '${CHECK_TOOL}'; check_tool '__bats_missing_tool_xyz__'"
  [ "$status" -eq 0 ]
  [[ "$output" == *"skipping"* ]]
}

@test "check_tool exits 1 for missing tool when CI=true" {
  run bash -c "export CI=true; source '${CHECK_TOOL}'; check_tool '__bats_missing_tool_xyz__'"
  [ "$status" -eq 1 ]
  [[ "$output" == *"required in CI"* ]]
}

@test "check_tool exits 1 for missing tool when REQUIRE_LINT_TOOLS=1" {
  run bash -c "export REQUIRE_LINT_TOOLS=1; source '${CHECK_TOOL}'; check_tool '__bats_missing_tool_xyz__'"
  [ "$status" -eq 1 ]
  [[ "$output" == *"required in CI"* ]]
}

@test "check_tool succeeds when tool exists" {
  run bash -c "source '${CHECK_TOOL}'; check_tool bash"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}