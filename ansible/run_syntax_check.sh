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

check_tool ansible-playbook "pip install ansible or apt install ansible"
cd "$ROOT/ansible"
echo "Running ansible syntax check..."
ansible-playbook --syntax-check -i inventory/hosts.ini.example playbooks/*.yml # hardened Phase 7: removed || echo; real check step now fails hard on syntax errors
echo "Ansible syntax check step finished."
