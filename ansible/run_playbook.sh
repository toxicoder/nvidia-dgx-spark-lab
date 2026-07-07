#!/usr/bin/env bash
#
# Thin Bazel-friendly wrapper for running ansible playbooks.
# This provides `bazel run //ansible:<target>` entry points while still
# allowing full flexibility for real inventories.
#
# Usage (via Bazel - recommended for Bazel-centric workflows):
#   bazel run //ansible:bootstrap
#   bazel run //ansible:bootstrap -- -i ansible/inventory/hosts.ini -l spark0
#
# Direct ansible still works and is fully supported:
#   ansible-playbook -i ansible/inventory/hosts.ini playbooks/bootstrap-cluster.yml
#
# The wrapper defaults to the example inventory for safe "smoke" runs
# (no real cluster changes unless you pass -i).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PLAYBOOK="${1:-}"
if [[ -z "$PLAYBOOK" ]]; then
  echo "Usage: $0 <playbook-name.yml> [extra ansible-playbook args...]"
  echo "Example: bazel run //ansible:bootstrap"
  echo "         bazel run //ansible:bootstrap -- -i inventory/hosts.ini"
  exit 1
fi
shift || true

INVENTORY_DEFAULT="inventory/hosts.ini.example"
ANSIBLE_CFG="ansible.cfg"

# If user did not override inventory on the command line, use the safe example.
# We detect -i / --inventory and let the user win if present.
HAS_INVENTORY=false
for arg in "$@"; do
  if [[ "$arg" == "-i" || "$arg" == "--inventory" || "$arg" == --inventory=* ]]; then
    HAS_INVENTORY=true
    break
  fi
done

INV_ARGS=()
if [[ "$HAS_INVENTORY" != true ]]; then
  INV_ARGS=( -i "$INVENTORY_DEFAULT" )
fi

export ANSIBLE_CONFIG="${ANSIBLE_CONFIG:-$ANSIBLE_CFG}"

echo "[ansible] ANSIBLE_CONFIG=$ANSIBLE_CONFIG"
echo "[ansible] running: ansible-playbook ${INV_ARGS[*]} playbooks/$PLAYBOOK $*"

exec ansible-playbook "${INV_ARGS[@]}" "playbooks/$PLAYBOOK" "$@"
