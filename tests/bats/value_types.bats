#!/usr/bin/env bats
#
# Hermetic tests for scripts/lib/types.sh — the typed value contracts bash lacks.
#
# Each contract is checked both ways: a value that must pass, and a value that
# must be rejected *with a diagnostic naming the parameter on stderr*. A checker
# that silently returns success is the failure mode these tests exist to catch,
# because every `require_*` helper is written as `check || return 1`.

load 'test_helper'

setup() {
  TYPES_LIB="${BATS_TEST_DIRNAME}/../../scripts/lib/types.sh"
}

# Source the library and evaluate an expression in one bash.
probe() {
  run bash -c "set -uo pipefail; source '${TYPES_LIB}'; $1"
}

@test "types.sh exists and parses" {
  [ -f "$TYPES_LIB" ]
  run bash -n "$TYPES_LIB"
  [ "$status" -eq 0 ]
}

@test "types.sh has no set -euo pipefail (library inherits caller options)" {
  run grep -E "^set -[a-z]+ ?pipefail" "$TYPES_LIB"
  [ "$status" -ne 0 ]
}

@test "every function in types.sh carries a # @function tag" {
  run bash -c "
    set -euo pipefail
    missing=0
    while IFS= read -r line; do
      fn=\${line%%()*}
      fn=\${fn##* }
      if ! grep -qB3 \"^# @function \$fn\$\" '${TYPES_LIB}'; then
        echo \"missing @function: \$fn\"
        missing=1
      fi
    done < <(grep -E '^[a-z_]+\(\) \{' '${TYPES_LIB}')
    exit \$missing
  "
  [ "$status" -eq 0 ]
}

@test "is_integer accepts whole numbers and rejects the rest" {
  probe 'is_integer 42'
  [ "$status" -eq 0 ]
  probe 'is_integer "-7"'
  [ "$status" -eq 0 ]
  probe 'is_integer 4.2'
  [ "$status" -ne 0 ]
  probe 'is_integer abc'
  [ "$status" -ne 0 ]
  probe 'is_integer ""'
  [ "$status" -ne 0 ]
}

@test "is_number accepts decimals" {
  probe 'is_number 3.14'
  [ "$status" -eq 0 ]
  probe 'is_number 0'
  [ "$status" -eq 0 ]
  probe 'is_number 1e5'
  [ "$status" -ne 0 ]
}

@test "is_unsigned_integer rejects the sign that is_integer accepts" {
  probe 'is_unsigned_integer 42'
  [ "$status" -eq 0 ]
  probe 'is_unsigned_integer 0'
  [ "$status" -eq 0 ]
  probe 'is_unsigned_integer -1'
  [ "$status" -ne 0 ]
  probe 'is_unsigned_integer 1.5'
  [ "$status" -ne 0 ]
  probe 'is_unsigned_integer ""'
  [ "$status" -ne 0 ]
  # The signed grammar is still available where a negative is meaningful.
  probe 'is_integer -1'
  [ "$status" -eq 0 ]
}

@test "is_unsigned_number matches the old is_numeric grammar exactly" {
  probe 'is_unsigned_number 1400'
  [ "$status" -eq 0 ]
  probe 'is_unsigned_number 78.5'
  [ "$status" -eq 0 ]
  probe 'is_unsigned_number -78.5'
  [ "$status" -ne 0 ]
  probe 'is_unsigned_number .5'
  [ "$status" -ne 0 ]
  probe 'is_unsigned_number 1.2.3'
  [ "$status" -ne 0 ]
}

@test "repo-bound utilities source the contract library" {
  local util="${BATS_TEST_DIRNAME}/../../scripts/utilities/benchmark-qwen36.sh"
  # Guarded on existence: a missing file here would otherwise pass vacuously.
  [ -f "$util" ]
  run grep -F 'source "${SCRIPT_DIR}/../lib/types.sh"' "$util"
  [ "$status" -eq 0 ]
  # And it uses the shared predicate rather than re-rolling the regex.
  run grep -F 'is_unsigned_integer "$completion_tokens"' "$util"
  [ "$status" -eq 0 ]
  run grep -E '=~ \^\[0-9\]\+\$' "$util"
  [ "$status" -ne 0 ]
}

@test "is_boolean accepts the documented spellings only" {
  probe 'is_boolean true'
  [ "$status" -eq 0 ]
  probe 'is_boolean no'
  [ "$status" -eq 0 ]
  probe 'is_boolean maybe'
  [ "$status" -ne 0 ]
}

@test "is_port bounds 1..65535" {
  probe 'is_port 1'
  [ "$status" -eq 0 ]
  probe 'is_port 65535'
  [ "$status" -eq 0 ]
  probe 'is_port 0'
  [ "$status" -ne 0 ]
  probe 'is_port 65536'
  [ "$status" -ne 0 ]
  probe 'is_port 80m'
  [ "$status" -ne 0 ]
}

@test "is_percent rejects out-of-range and non-numeric" {
  probe 'is_percent 0'
  [ "$status" -eq 0 ]
  probe 'is_percent 100'
  [ "$status" -eq 0 ]
  probe 'is_percent 101'
  [ "$status" -ne 0 ]
  probe 'is_percent 12.5'
  [ "$status" -ne 0 ]
}

@test "is_k8s_quantity accepts CPU and memory forms and rejects typos" {
  probe 'is_k8s_quantity 600m'
  [ "$status" -eq 0 ]
  probe 'is_k8s_quantity 24Gi'
  [ "$status" -eq 0 ]
  probe 'is_k8s_quantity 512M'
  [ "$status" -eq 0 ]
  probe 'is_k8s_quantity 4'
  [ "$status" -eq 0 ]
  probe 'is_k8s_quantity 24Gig'
  [ "$status" -ne 0 ]
  probe 'is_k8s_quantity " 4Gi"'
  [ "$status" -ne 0 ]
}

@test "is_k8s_name enforces DNS-1123 shape" {
  probe 'is_k8s_name lab-dashboard'
  [ "$status" -eq 0 ]
  probe 'is_k8s_name ai-inference'
  [ "$status" -eq 0 ]
  probe 'is_k8s_name Lab-Dashboard'
  [ "$status" -ne 0 ]
  probe 'is_k8s_name -lead'
  [ "$status" -ne 0 ]
  probe 'is_k8s_name "a b"'
  [ "$status" -ne 0 ]
}

@test "is_absolute_path requires a leading slash" {
  probe 'is_absolute_path /mnt/models'
  [ "$status" -eq 0 ]
  probe 'is_absolute_path ./models'
  [ "$status" -ne 0 ]
}

@test "is_enum_value matches only the listed set" {
  probe 'is_enum_value critical critical management optional_dev'
  [ "$status" -eq 0 ]
  probe 'is_enum_value Critical critical management'
  [ "$status" -ne 0 ]
}

@test "require_integer fails and names the parameter on stderr" {
  run bash -c "set -uo pipefail; source '${TYPES_LIB}'; require_integer 3.5 cpu"
  [ "$status" -eq 1 ]
  [[ "$output" == *"cpu must be an integer"* ]]
}

@test "require_integer failure writes nothing to stdout" {
  # The diagnostic belongs on stderr, so a utility can still capture stdout cleanly.
  # bats merges streams into $output, so stderr is discarded here and whatever is
  # left is what went to stdout: nothing.
  run bash -c "set -uo pipefail; source '${TYPES_LIB}'; require_integer x port 2>/dev/null"
  [ "$status" -ne 0 ]
  [ -z "$output" ]
}

@test "require_integer success writes no diagnostic at all" {
  probe 'require_integer 42 port'
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "require_positive_integer rejects zero and negatives" {
  probe 'require_positive_integer 1 replicas'
  [ "$status" -eq 0 ]
  probe 'require_positive_integer 0 replicas'
  [ "$status" -ne 0 ]
  probe 'require_positive_integer -- -1 replicas'
  [ "$status" -ne 0 ]
}

@test "require_nonempty rejects blank and whitespace-only" {
  probe "require_nonempty '' model"
  [ "$status" -ne 0 ]
  probe "require_nonempty '   ' model"
  [ "$status" -ne 0 ]
  probe "require_nonempty kimi model"
  [ "$status" -eq 0 ]
}

@test "require_port rejects a non-numeric port" {
  run bash -c "set -uo pipefail; source '${TYPES_LIB}'; require_port http nodeport"
  [ "$status" -eq 1 ]
  [[ "$output" == *"nodeport must be a port in 1..65535"* ]]
}

@test "require_percent rejects 101" {
  probe 'require_percent 101 headroom'
  [ "$status" -ne 0 ]
  probe 'require_percent 15 headroom'
  [ "$status" -eq 0 ]
}

@test "require_k8s_quantity rejects the 24Gig typo" {
  run bash -c "set -uo pipefail; source '${TYPES_LIB}'; require_k8s_quantity 24Gig memory_min_per_node"
  [ "$status" -eq 1 ]
  [[ "$output" == *"memory_min_per_node must be a Kubernetes quantity"* ]]
}

@test "require_k8s_name rejects an uppercase namespace" {
  probe 'require_k8s_name DEV namespace'
  [ "$status" -ne 0 ]
  probe 'require_k8s_name ai-inference namespace'
  [ "$status" -eq 0 ]
}

@test "require_absolute_path rejects a relative path" {
  probe 'require_absolute_path models/fake path'
  [ "$status" -ne 0 ]
  probe 'require_absolute_path /mnt/models path'
  [ "$status" -eq 0 ]
}

@test "require_enum lists the accepted values in its diagnostic" {
  run bash -c "set -uo pipefail; source '${TYPES_LIB}'; require_enum wrong tier critical management"
  [ "$status" -eq 1 ]
  [[ "$output" == *"tier must be one of: critical management"* ]]
}

@test "require_args prints a usage line when short" {
  run bash -c "set -uo pipefail; source '${TYPES_LIB}'; require_args 1 2 'start-flux <quality>'"
  [ "$status" -eq 1 ]
  [[ "$output" == *"usage: start-flux <quality>"* ]]
}

@test "a failed require aborts a script running under set -e" {
  run bash -c "set -euo pipefail; source '${TYPES_LIB}'; require_port 99999 port; echo REACHED"
  [ "$status" -ne 0 ]
  [[ "$output" != *"REACHED"* ]]
}

@test "a passing require lets the script continue" {
  run bash -c "set -euo pipefail; source '${TYPES_LIB}'; require_port 32085 port; echo REACHED"
  [ "$status" -eq 0 ]
  [[ "$output" == *"REACHED"* ]]
}
