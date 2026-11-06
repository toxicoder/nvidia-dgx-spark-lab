#!/usr/bin/env bash
# ## Python strict typing gate (mypy) — the Bazel twin of the mypy pre-commit hook.
#
# Runs mypy with the repository `mypy.ini` over every Python source, so a missing
# annotation or an explicit `Any` fails the build instead of being reviewed by eye.
# Fix formatting with `bazelisk run //:fix`; there is no autofix for annotations.
#
# Usage: bazelisk test //lints:mypy
#
# Safety: this gate is the only automated check on the Resource Guard policy
# readers under `scripts/lib/py/`, so it must never be able to pass while having
# inspected zero files. An earlier revision resolved the repo root from runfiles
# and shelled out to `git ls-files`, which returns nothing inside the Bazel
# sandbox; the gate printed "no tracked Python files" and exited 0 for its whole
# life. The root now re-roots on a real source symlink (as //lints:shfmt does)
# and an empty file list is a hard failure.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n ${BUILD_WORKSPACE_DIRECTORY:-} ]]; then
  ROOT="${BUILD_WORKSPACE_DIRECTORY}"
elif [[ -n ${TEST_SRCDIR:-} ]]; then
  ROOT="${TEST_SRCDIR}/_main"
else
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
# shellcheck source=../scripts/lib/check_tool.sh
source "$ROOT/scripts/lib/check_tool.sh"

check_tool python3 "install Python 3"
check_tool mypy "pip install mypy or add to devcontainer"

# Runfiles only materialise declared data deps, which would silently type-check a
# slice of the tree. Re-root on the physical workspace through a source symlink so
# this gate always covers every Python source, as //lints:shfmt does.
FIX_SH="${ROOT}/fix.sh"
if [[ -L ${FIX_SH} ]]; then
  ROOT="$(dirname "$(readlink -f "${FIX_SH}")")"
fi
cd "$ROOT"

# Enumerate with find rather than git: the sandbox has no repository, and a git
# failure must not be able to look like a clean type-check.
mapfile -d '' PY_FILES < <(
  find . -name '*.py' \
    -not -path './.git/*' \
    -not -path './node_modules/*' \
    -not -path './.next/*' \
    -not -path './dashboard/.next/*' \
    -not -path './site/*' \
    -not -path './.venv*' \
    -not -path './bazel-*/*' \
    -not -path './dashboard/node_modules/*' \
    -not -path './docs-site/node_modules/*' \
    -print0
)

if [[ ${#PY_FILES[@]} -eq 0 ]]; then
  echo "mypy: no Python files found from ${ROOT}" >&2
  exit 1
fi

echo "Running mypy on ${#PY_FILES[@]} file(s)..."
# Invoke the same console script check_tool resolved above. `python3 -m mypy` is a
# different interpreter and can lack the mypy module even when mypy is on PATH.
mypy --config-file mypy.ini -- "${PY_FILES[@]}"
echo "mypy: all checks passed (${#PY_FILES[@]} files)."
