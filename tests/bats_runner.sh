#!/usr/bin/env bash
#
# Hermetic BATS runner for use inside Bazel sh_test.
#
# This script is the entry point for the Bazel test target.
# It locates the hermetic bats binary and the test sources via runfiles,
# computes REPO_ROOT so that the original manage.bats and manage.sh
# continue to work with their existing relative path logic, and then
# invokes bats.
#
# This keeps the original tests/bats/manage.bats and test_helper.bash
# completely unchanged (they continue to work with `make test` too).

set -euo pipefail

# --- Runfiles resolution (works in Bazel sh_test sandboxes) ---
if [[ -n "${TEST_SRCDIR:-}" ]]; then
  RUNFILES="$TEST_SRCDIR"
else
  # Fallback when run directly (rare)
  RUNFILES="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

# In Bzlmod the main repository appears under _main in runfiles.
# External repos appear directly by their name or under external/.
# @function find_file
# Locate a runfiles path by name across Bazel candidate roots.
# @param $1  Relative path to find.
# @returns Echoes absolute path on success; exits 1 otherwise.

find_file() {
  local name="$1"
  local candidates=(
    "$RUNFILES/_main/$name"
    "$RUNFILES/$name"
    "$RUNFILES/external/$name"
    "$RUNFILES/bats_core/$name"
    "$RUNFILES/_main/external/bats_core/$name"
    "$RUNFILES/+_repo_rules+bats_core/$name"
    "$RUNFILES/+_repo_rules+bats_core/bin/bats"
    "$RUNFILES/+_repo_rules+bats_core/$name"
  )
  for c in "${candidates[@]}"; do
    if [[ -e "$c" ]]; then
      echo "$c"
      return 0
    fi
  done
  echo "ERROR: Could not locate $name in runfiles" >&2
  echo "RUNFILES=$RUNFILES" >&2
  ls -l "$RUNFILES" 2>/dev/null | head -30 >&2 || true
  # Also show the bats related tree for debugging
  find "$RUNFILES" -path '*bats*' -type f 2>/dev/null | head -10 >&2 || true
  exit 1
}

# Locate hermetic bats binary (the one from @bats_core)
BATS_BIN="$(find_file +_repo_rules+bats_core/bin/bats 2>/dev/null || find_file bats_core/bin/bats)"

# Locate a root marker to compute REPO_ROOT.
# Prefer something that lives in the main repo root (not inside external bats_core).
# We look for manage.sh or a distinctive k8s file via _main first.
REPO_ROOT_MARKER="$(
  find_file _main/scripts/manage.sh 2>/dev/null || \
  find_file _main/k8s/workloads/kimi-test/kimi-test-job.yaml 2>/dev/null || \
  find_file _main/README.md 2>/dev/null || \
  find_file scripts/manage.sh 2>/dev/null || true
)"

# @function repo_root_from_marker
# Derive repository root from a known marker file path.
# @param $1  Absolute marker file path.

repo_root_from_marker() {
  local marker="$1"
  local dir
  dir="$(dirname "$marker")"
  case "$marker" in
    */scripts/manage.sh)
      (cd "$dir/.." && pwd)
      ;;
    */README.md)
      (cd "$dir" && pwd)
      ;;
    */k8s/workloads/*/*)
      (cd "$dir/../../../.." && pwd)
      ;;
    *)
      (cd "$dir/.." && pwd)
      ;;
  esac
}

if [[ -n "$REPO_ROOT_MARKER" && -f "$REPO_ROOT_MARKER" ]]; then
  REPO_ROOT="$(repo_root_from_marker "$REPO_ROOT_MARKER")"
else
  # Last resort fallback (tests/ -> repo root)
  REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

# Canonicalize for kcov — runfiles symlinks must resolve to physical script paths.
if [[ -f "${REPO_ROOT}/scripts/manage.sh" ]]; then
  _manage_real="$(readlink -f "${REPO_ROOT}/scripts/manage.sh" 2>/dev/null || realpath "${REPO_ROOT}/scripts/manage.sh" 2>/dev/null || echo "${REPO_ROOT}/scripts/manage.sh")"
  REPO_ROOT="$(dirname "$(dirname "$_manage_real")")"
else
  REPO_ROOT="$(cd "$REPO_ROOT" && pwd -P)"
fi

export REPO_ROOT
echo "[bats_runner] REPO_ROOT=$REPO_ROOT" >&2
echo "[bats_runner] BATS_BIN=$BATS_BIN" >&2

# Locate the bats test directory via test_helper.bash (present in every split target).
BATS_HELPER="$(
  find_file _main/tests/bats/test_helper.bash 2>/dev/null || \
  find_file tests/bats/test_helper.bash 2>/dev/null || true
)"
if [[ -z "$BATS_HELPER" || ! -f "$BATS_HELPER" ]]; then
  echo "ERROR: Could not locate tests/bats/test_helper.bash in runfiles" >&2
  exit 1
fi
BATS_TEST_DIR="$(dirname "$BATS_HELPER")"

# Optional args: basenames of .bats files to run (e.g. manage.bats). When omitted,
# runs every *.bats file so `make test` and legacy callers stay unchanged.
BATS_TEST_FILES=()
if [[ $# -gt 0 ]]; then
  for name in "$@"; do
    case "$name" in
      *.bats) BATS_TEST_FILES+=("$BATS_TEST_DIR/$name") ;;
      *) BATS_TEST_FILES+=("$BATS_TEST_DIR/${name}.bats") ;;
    esac
  done
else
  BATS_TEST_FILES=("$BATS_TEST_DIR"/*.bats)
fi

if [[ ! -e "${BATS_TEST_FILES[0]}" ]]; then
  echo "ERROR: No .bats files found under $BATS_TEST_DIR (args: $*)" >&2
  exit 1
fi

echo "[bats_runner] BATS_TEST_DIR=$BATS_TEST_DIR" >&2
echo "[bats_runner] Running ${#BATS_TEST_FILES[@]} test file(s)" >&2

exec "$BATS_BIN" "${BATS_TEST_FILES[@]}"
