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

check_tool ansible-lint "pip install ansible-lint"
cd "$ROOT/ansible"
echo "Running ansible-lint..."
ansible-lint -c "$ROOT/.ansible-lint" . # hardened Phase 7: removed || echo; real lint/check now fails hard (no masking)
echo "Ansible lint step finished."
