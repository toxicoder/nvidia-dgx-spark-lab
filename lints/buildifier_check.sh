#!/usr/bin/env bash
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

check_tool buildifier "install from https://github.com/bazelbuild/buildtools/releases"
cd "$ROOT"

echo "Running buildifier -mode=check..."
find . -type f \( \
  -name 'BUILD' -o \
  -name 'BUILD.bazel' -o \
  -name 'MODULE.bazel' -o \
  -name 'WORKSPACE' -o \
  -name '*.bzl' -o \
  -name '*.bazel' \
  \) \
  ! -path '*/bazel-*/*' \
  ! -path './site/*' \
  ! -path './.venv*' \
  ! -path './node_modules/*' \
  ! -path './dashboard/.next/*' \
  ! -path './bazel-bin/*' \
  ! -path './bazel-out/*' \
  -print0 | xargs -0 -r buildifier -mode=check
echo "buildifier check passed."
