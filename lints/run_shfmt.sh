#!/usr/bin/env bash
# ## Shell format gate (shfmt) — the Bazel twin of the `shfmt` pre-commit hook.
#
# Checks indentation and switch formatting without rewriting files. Fix them with
# `bazelisk run //:fix`, which shells out to shfmt -w.
#
# Usage: bazelisk test //lints:shfmt
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n ${BUILD_WORKSPACE_DIRECTORY:-} ]]; then
  ROOT="${BUILD_WORKSPACE_DIRECTORY}"
elif [[ -n ${TEST_SRCDIR:-} ]]; then
  ROOT="${TEST_SRCDIR}/_main"
else
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
source "$ROOT/scripts/lib/check_tool.sh"

check_tool shfmt "see scripts/ci/install-lint-tools.sh or .devcontainer/tool-versions.env"

# Runfiles only materialise declared data deps, which would silently lint a
# slice of the tree. Re-root on the physical workspace through a source symlink
# so this gate always covers every shell source, as //:fix does.
MANAGE_SH="${ROOT}/scripts/manage.sh"
if [[ -L ${MANAGE_SH} ]]; then
  ROOT="$(dirname "$(dirname "$(readlink -f "${MANAGE_SH}")")")"
fi
cd "$ROOT"

echo "Running shfmt..."
shfmt --version

# Same flags as the pre-commit hook: diff, simplify, 2-space indent,
# switch-case indentation. Flags must stay in sync with .pre-commit-config.yaml.
mapfile -d '' files < <(
  find . -name '*.sh' \
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

if [[ ${#files[@]} -eq 0 ]]; then
  echo "shfmt: no shell sources found" >&2
  exit 1
fi

shfmt -d -s -i 2 -ci -- "${files[@]}"
echo "Shell format step finished (${#files[@]} files)."
