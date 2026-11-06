#!/usr/bin/env bash
#
# ## typed value contracts
#
# Bash has no type system, so the closest equivalent is validating the *kind* of
# every value at the boundary where it enters a function: a port that must be an
# integer in 1..65535, a memory floor that must be a Kubernetes quantity, a tier
# that must be one of a closed set. Without it, `--memory 24Gig` travels through
# half a script before `kubectl` rejects it, or worse, silently means something
# else.
#
# Every checker follows one contract:
#   * returns 0 when the value satisfies the contract;
#   * returns 1 otherwise, having written one diagnostic to **stderr** naming the
#     parameter, so stdout stays reserved for data.
# They never exit the shell, so a sourced library cannot kill its caller; under
# `set -e` a failed check aborts an entry script, which is the intent.
#
# Libraries here deliberately omit `set -euo pipefail` and inherit the caller's,
# as every other `scripts/lib/*.sh` does (see docs/project-conventions.md §6).
#
# Usage:
#   # shellcheck source=../lib/types.sh
#   source "$(dirname "${BASH_SOURCE[0]}")/../lib/types.sh"
#   require_port "$port" port || return 1
#
# Safety: Resource Guard capacity math and the heavy-workload confirmation gate
# both consume values these functions check. A check that passes here is only a
# statement about *form*; it proves a value is a well-formed quantity, never that
# the quantity is safe. Capacity decisions stay in resources.sh.

# @function lab_type_fail
# Emit one standard-shaped rejection to stderr.
# @param $1  Parameter name shown to the operator.
# @param $2  Contract that was not satisfied.
# @param $3  The offending value.
lab_type_fail() {
  local name="${1:-<value>}"
  local contract="${2:-the stated contract}"
  local value="${3-}"
  printf 'validation: %s must be %s (got: %q)\n' "$name" "$contract" "$value" >&2
  return 1
}

# @function is_integer
# True when the value is a whole number, optionally signed.
# @param $1  Value to test.
is_integer() {
  [[ ${1:-} =~ ^-?[0-9]+$ ]]
}

# @function is_unsigned_integer
# True when the value is a whole number with no sign.
#
# Separate from is_integer on purpose: counters read out of telemetry (token
# counts, pids, replica counts) are non-negative, and accepting a leading `-`
# there turns a parse glitch into a negative number rather than a rejection.
# @param $1  Value to test.
is_unsigned_integer() {
  [[ ${1:-} =~ ^[0-9]+$ ]]
}

# @function is_number
# True when the value is an integer or decimal number, optionally signed.
# Generalises the per-script `is_numeric` helpers it replaces.
# @param $1  Value to test.
is_number() {
  [[ ${1:-} =~ ^-?[0-9]+(\.[0-9]+)?$ ]]
}

# @function is_unsigned_number
# True when the value is a decimal number with no sign, such as a MHz readback
# or a Celsius telemetry value.
#
# This is the exact grammar the per-script `is_numeric` helpers had; keep it
# free of a leading `-` so a swap for one of those helpers cannot widen it.
# @param $1  Value to test.
is_unsigned_number() {
  [[ ${1:-} =~ ^[0-9]+(\.[0-9]+)?$ ]]
}

# @function is_boolean
# True when the value is one of the spellings bash scripts accept for a flag.
# @param $1  Value to test.
is_boolean() {
  case "${1:-}" in
    true | false | TRUE | FALSE | True | False | yes | no | 0 | 1) return 0 ;;
    *) return 1 ;;
  esac
}

# @function is_port
# True when the value is a TCP/UDP port number, 1-65535.
# @param $1  Value to test.
is_port() {
  is_unsigned_integer "$1" && ((${1} >= 1 && ${1} <= 65535))
}

# @function is_percent
# True when the value is a whole percentage, 0-100.
# @param $1  Value to test.
is_percent() {
  is_unsigned_integer "$1" && ((${1} <= 100))
}

# @function is_k8s_quantity
# True when the value is a Kubernetes quantity: a plain number, a CPU millicore
# string such as `600m`, or a byte quantity such as `24Gi` / `512M`.
# @param $1  Value to test.
is_k8s_quantity() {
  [[ ${1:-} =~ ^[0-9]+(\.[0-9]+)?(m|Ki|Mi|Gi|Ti|Pi|K|M|G|T)?$ ]]
}

# @function is_k8s_name
# True when the value is a valid Kubernetes object name (DNS-1123 subdomain,
# which is what namespaces, deployments, and jobs all use).
# @param $1  Value to test.
is_k8s_name() {
  [[ ${1:-} =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$ ]] &&
    ((${#1} <= 253))
}

# @function is_absolute_path
# True when the value looks like an absolute filesystem path.
# @param $1  Value to test.
is_absolute_path() {
  [[ ${1:-} == /* ]]
}

# @function is_enum_value
# True when the value equals one of the remaining arguments.
# @param $1  Value to test.
# @param $2.. Accepted values.
is_enum_value() {
  local value="${1-}"
  local candidate
  shift
  for candidate in "$@"; do
    [[ $value == "$candidate" ]] && return 0
  done
  return 1
}

# @function require_nonempty
# Require a non-empty, non-whitespace value.
# @param $1  Value to test.
# @param $2  Parameter name for the diagnostic; defaults to "value".
require_nonempty() {
  local value="${1-}"
  local name="${2:-value}"
  if [[ -z ${value// /} ]]; then
    lab_type_fail "$name" "non-empty" "$value"
    return 1
  fi
  return 0
}

# @function require_integer
# Require a whole number.
# @param $1  Value to test.
# @param $2  Parameter name for the diagnostic; defaults to "value".
require_integer() {
  local value="${1-}"
  local name="${2:-value}"
  if ! is_integer "$value"; then
    lab_type_fail "$name" "an integer" "$value"
    return 1
  fi
  return 0
}

# @function require_positive_integer
# Require a whole number strictly greater than zero.
# @param $1  Value to test.
# @param $2  Parameter name for the diagnostic; defaults to "value".
require_positive_integer() {
  local value="${1-}"
  local name="${2:-value}"
  if ! is_integer "$value" || ((value <= 0)); then
    lab_type_fail "$name" "an integer greater than zero" "$value"
    return 1
  fi
  return 0
}

# @function require_number
# Require an integer or decimal number.
# @param $1  Value to test.
# @param $2  Parameter name for the diagnostic; defaults to "value".
require_number() {
  local value="${1-}"
  local name="${2:-value}"
  if ! is_number "$value"; then
    lab_type_fail "$name" "a number" "$value"
    return 1
  fi
  return 0
}

# @function require_boolean
# Require one of the accepted truthy/falsy spellings.
# @param $1  Value to test.
# @param $2  Parameter name for the diagnostic; defaults to "value".
require_boolean() {
  local value="${1-}"
  local name="${2:-value}"
  if ! is_boolean "$value"; then
    lab_type_fail "$name" "one of true|false|yes|no|0|1" "$value"
    return 1
  fi
  return 0
}

# @function require_port
# Require a port number in 1..65535.
# @param $1  Value to test.
# @param $2  Parameter name for the diagnostic; defaults to "port".
require_port() {
  local value="${1-}"
  local name="${2:-port}"
  if ! is_port "$value"; then
    lab_type_fail "$name" "a port in 1..65535" "$value"
    return 1
  fi
  return 0
}

# @function require_percent
# Require a whole percentage in 0..100.
# @param $1  Value to test.
# @param $2  Parameter name for the diagnostic; defaults to "percent".
require_percent() {
  local value="${1-}"
  local name="${2:-percent}"
  if ! is_percent "$value"; then
    lab_type_fail "$name" "a percentage in 0..100" "$value"
    return 1
  fi
  return 0
}

# @function require_k8s_quantity
# Require a Kubernetes CPU or memory quantity, so a typo such as `24Gig` fails at
# the argument parser rather than inside capacity arithmetic.
# @param $1  Value to test.
# @param $2  Parameter name for the diagnostic; defaults to "quantity".
require_k8s_quantity() {
  local value="${1-}"
  local name="${2:-quantity}"
  if ! is_k8s_quantity "$value"; then
    lab_type_fail "$name" "a Kubernetes quantity such as 600m or 24Gi" "$value"
    return 1
  fi
  return 0
}

# @function require_k8s_name
# Require a valid Kubernetes object name.
# @param $1  Value to test.
# @param $2  Parameter name for the diagnostic; defaults to "name".
require_k8s_name() {
  local value="${1-}"
  local name="${2:-name}"
  if ! is_k8s_name "$value"; then
    lab_type_fail "$name" "a lowercase Kubernetes name" "$value"
    return 1
  fi
  return 0
}

# @function require_absolute_path
# Require an absolute path. Presence is not permission: whitelist enforcement
# stays in the callers that have the whitelist.
# @param $1  Value to test.
# @param $2  Parameter name for the diagnostic; defaults to "path".
require_absolute_path() {
  local value="${1-}"
  local name="${2:-path}"
  if ! is_absolute_path "$value"; then
    lab_type_fail "$name" "an absolute path" "$value"
    return 1
  fi
  return 0
}

# @function require_enum
# Require membership of a closed set passed as the remaining arguments.
# @param $1  Value to test.
# @param $2  Parameter name for the diagnostic.
# @param $3.. Accepted values.
require_enum() {
  local value="${1-}"
  local name="${2:-value}"
  shift 2
  if ! is_enum_value "$value" "$@"; then
    lab_type_fail "$name" "one of: $*" "$value"
    return 1
  fi
  return 0
}

# @function require_args
# Require a minimum argument count, with a usage line when short.
# @param $1  Actual count (usually $#).
# @param $2  Minimum count.
# @param $3  Usage string shown when short.
require_args() {
  local actual="${1-0}"
  local minimum="${2:-1}"
  local usage="${3:-pass the required arguments}"
  if ((actual < minimum)); then
    printf 'usage: %s (got %s argument(s), need %s)\n' "$usage" "$actual" "$minimum" >&2
    return 1
  fi
  return 0
}
