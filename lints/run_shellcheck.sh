#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${BUILD_WORKSPACE_DIRECTORY:-}" ]]; then
  ROOT="${BUILD_WORKSPACE_DIRECTORY}"
elif [[ -n "${TEST_SRCDIR:-}" ]]; then
  ROOT="${TEST_SRCDIR}/_main"
else
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
source "$ROOT/scripts/lib/check_tool.sh"

check_tool shellcheck "apt install shellcheck or brew install shellcheck"
cd "$ROOT"

echo "Running shellcheck..."
shellcheck --version
find . -name '*.sh' \
  -not -path './.git/*' \
  -not -path './node_modules/*' \
  -not -path './.next/*' \
  -not -path './dashboard/.next/*' \
  -not -path './site/*' \
  -not -path './bazel-*/*' \
  -not -path './dashboard/node_modules/*' \
  -print0 | xargs -0 shellcheck -x --severity=warning  # hardened: removed || echo; real lint step -- shellcheck warnings will now fail (excludes vendored/generated)
echo "Shell lint step finished."
