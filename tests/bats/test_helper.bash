# test_helper.bash
# Shared setup for BATS tests in nvidia-dgx-spark-lab

# Make sure we have a clean environment
if [[ -z "${BATS_TEST_DIRNAME:-}" ]]; then
  if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
    BATS_TEST_DIRNAME="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  elif [[ -n "${0:-}" && -f "${0}" ]]; then
    BATS_TEST_DIRNAME="$(cd "$(dirname "${0}")" && pwd)"
  else
    BATS_TEST_DIRNAME="${PWD}"
  fi
  export BATS_TEST_DIRNAME
fi

# @function bats_canonical_repo_root
# Resolve physical repository root for kcov coverage attribution.
# @param $1  Relative path from BATS_TEST_DIRNAME (default: ../..).
# @stdout Canonical absolute repository root.
bats_canonical_repo_root() {
  local rel="${1:-../..}"
  local candidate
  candidate="$(cd "${BATS_TEST_DIRNAME}/${rel}" && pwd)"
  if [[ -f "${candidate}/scripts/manage.sh" ]]; then
    local manage_real
    manage_real="$(readlink -f "${candidate}/scripts/manage.sh" 2>/dev/null || realpath "${candidate}/scripts/manage.sh" 2>/dev/null || echo "${candidate}/scripts/manage.sh")"
    dirname "$(dirname "$manage_real")"
    return 0
  fi
  (cd "$candidate" && pwd -P)
}

# Common function to print debug info on failure (BATS will capture)
debug_log() {
  echo "DEBUG: $*" >&3
}