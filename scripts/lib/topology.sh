#!/usr/bin/env bash
#
# ## Lab topology helpers
#
# Thin wrappers around scripts/lib/py/lab_topology.py: validate the declarative
# lab topology (ansible/inventory/lab.yaml), emit flat facts, and render the
# generated Ansible artifacts (hosts.ini, fabric group vars, netplan,
# cloud-init user-data). The topology file is the single source of truth —
# `manage.sh setup` (discovery wizard) rewrites it, rendering follows.

if ! declare -F lab_repo_root >/dev/null 2>&1; then
  # shellcheck source=paths.sh disable=SC1091
  source "$(dirname "${BASH_SOURCE[0]:-${0}}")/paths.sh"
fi

# Directory of this file, resolved once at source time (BASH_SOURCE is
# caller-relative inside functions, so it must not be read there).
_TOPOLOGY_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-${0}}")" && pwd)"

# @function lab_topology_path
# Absolute path of the declarative lab topology file.
# Honors LAB_TOPOLOGY_FILE for tests and alternate lab checkouts.
lab_topology_path() {
  echo "${LAB_TOPOLOGY_FILE:-$(lab_repo_root)/ansible/inventory/lab.yaml}"
}

# @function _lab_topology_py
# Run the Python topology module with the given subcommand/args.
# The module path is resolved next to this file (not via lab_repo_root) so a
# REPO_ROOT/LAB_TOPOLOGY_FILE override still finds the engine in the real repo.
_lab_topology_py() {
  python3 "${_TOPOLOGY_LIB_DIR}/py/lab_topology.py" "$@"
}

# @function topology_wizard_vars
# Emit key=value pre-fill defaults for the setup wizard from the given lab file.
# Usage: topology_wizard_vars [lab_file]
topology_wizard_vars() {
  _lab_topology_py wizard-vars "${1:-$(lab_topology_path)}"
}

# @function topology_validate
# Validate the lab topology; non-zero exit with readable errors on failure.
topology_validate() {
  _lab_topology_py validate "$(lab_topology_path)"
}

# @function topology_facts
# Emit key=value facts (fabric, node_count, orchestrator, switch_host, ...).
topology_facts() {
  _lab_topology_py facts "$(lab_topology_path)"
}

# @function topology_render
# Usage: topology_render [out_root]
# Render generated artifacts under out_root/ansible (default: repo root).
topology_render() {
  local out_root="${1:-$(lab_repo_root)}"
  _lab_topology_py render "$(lab_topology_path)" --out "$out_root"
}

# @function topology_check
# Validate the topology and, when kubectl + cluster access exist, compare the
# declared nodes against live K3s nodes (read-only drift report).
topology_check() {
  local facts_line
  facts_line="$(_lab_topology_py facts "$(lab_topology_path)")" || return 1
  echo "$facts_line"
  if type kubectl >/dev/null 2>&1 && kubectl cluster-info >/dev/null 2>&1; then
    local live declared missing extra
    live="$(kubectl get nodes -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || true)"
    declared="$(echo "$facts_line" | awk -F= '$1 == "nodes" {print $2}')"
    IFS=',' read -r -a declared_nodes <<<"$declared"
    missing=""
    for node in "${declared_nodes[@]}"; do
      if [[ " $live " != *" $node " ]]; then
        missing="$missing $node"
      fi
    done
    extra=""
    IFS=' ' read -r -a live_nodes <<<"$live"
    for node in "${live_nodes[@]}"; do
      if [[ " $declared " != *" $node " ]]; then
        extra="$extra $node"
      fi
    done
    if [[ -n $missing ]]; then
      echo "topology drift: declared but not live:${missing}" >&2
    fi
    if [[ -n $extra ]]; then
      echo "topology drift: live but not declared:${extra}" >&2
    fi
    if [[ -z $missing && -z $extra ]]; then
      echo "topology drift: none (declared matches live nodes)"
    fi
  else
    echo "topology check: no kubectl cluster access — declared topology only"
  fi
}
