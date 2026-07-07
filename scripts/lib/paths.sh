#!/usr/bin/env bash
#
# ## kcov-safe path resolution
#
# Helpers for resolving script and repository paths when BASH_SOURCE is unset
# under kcov instrumentation or when scripts run from Bazel runfiles symlinks.
#
# Sourced by manage.sh, validate.sh, utilities, and BATS tests via REPO_ROOT.

# @function lab_script_dir
# Resolve directory of the invoking shell script.
# @param $1 BASH_SOURCE depth (0 = this file, 1 = direct caller).
# @param $2 Fallback path relative to REPO_ROOT (default: scripts).
# @stdout Absolute script directory.
lab_script_dir() {
  local depth="${1:-1}"
  local fallback="${2:-scripts}"
  if [[ -n "${BASH_SOURCE[$depth]:-}" ]]; then
    cd "$(dirname "${BASH_SOURCE[$depth]}")" && pwd
    return 0
  fi
  # Prefer $0 over REPO_ROOT — kcov clears BASH_SOURCE but keeps argv when executing scripts.
  if [[ -n "${0:-}" && -f "${0}" ]]; then
    cd "$(dirname "${0}")" && pwd
    return 0
  fi
  if [[ -n "${REPO_ROOT:-}" ]]; then
    echo "${REPO_ROOT}/${fallback}"
    return 0
  fi
  echo "${PWD}"
}

# @function lab_repo_root_from_lib
# Resolve repo root from a scripts/lib/*.sh caller when REPO_ROOT is unset.
# @stdout Absolute repository root.
lab_repo_root_from_lib() {
  if [[ -n "${REPO_ROOT:-}" ]]; then
    echo "${REPO_ROOT}"
    return 0
  fi
  if [[ -n "${BASH_SOURCE[1]:-}" ]]; then
    cd "$(dirname "${BASH_SOURCE[1]}")/../.." && pwd
    return 0
  fi
  echo "${PWD}"
}

# @function lab_repo_root
# Resolve repository root (REPO_ROOT, BASH_SOURCE, or $0 fallback).
# @stdout Absolute repository root.
lab_repo_root() {
  if [[ -n "${REPO_ROOT:-}" ]]; then
    echo "${REPO_ROOT}"
    return 0
  fi
  lab_repo_root_from_lib
}

# @function lab_canonical_repo_root
# Resolve physical repository root for kcov coverage attribution.
# @param $1  Candidate root (defaults to REPO_ROOT or lab_repo_root).
# @stdout Canonical absolute repository root.
lab_canonical_repo_root() {
  local candidate="${1:-}"
  if [[ -z "$candidate" ]]; then
    candidate="$(lab_repo_root)"
  fi
  if [[ -f "${candidate}/scripts/manage.sh" ]]; then
    local manage_real
    manage_real="$(readlink -f "${candidate}/scripts/manage.sh" 2>/dev/null || realpath "${candidate}/scripts/manage.sh" 2>/dev/null || echo "${candidate}/scripts/manage.sh")"
    dirname "$(dirname "$manage_real")"
    return 0
  fi
  (cd "$candidate" && pwd -P)
}