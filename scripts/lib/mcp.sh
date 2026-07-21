#!/usr/bin/env bash
#
# ## MCP agent toolkit helpers
#
# Deploy helpers for agent-tools namespace workloads and policy gates.

if ! declare -F lab_repo_root >/dev/null 2>&1; then
  # shellcheck source=paths.sh disable=SC1091
  source "$(dirname "${BASH_SOURCE[0]:-${0}}")/paths.sh"
fi

# @function mcp_policy_path
mcp_policy_path() {
  echo "$(lab_repo_root)/mcp/config/mcp-policy.yaml"
}

# @function mcp_policy_json_path
mcp_policy_json_path() {
  echo "$(lab_repo_root)/mcp/config/mcp-policy.json"
}

# @function _mcp_load_policy_json
_mcp_load_policy_json() {
  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/mcp_mcp_load_policy_json.py" "$(mcp_policy_json_path)" "$(mcp_policy_path)"
}

# @function mcp_namespace
mcp_namespace() {
  echo "agent-tools"
}

# @function ensure_mcp_namespace
ensure_mcp_namespace() {
  kubectl apply -k "${REPO_ROOT}/mcp/k8s/base"
}

# @function _mcp_stack_startup_order
_mcp_stack_startup_order() {
  local stack_id="$1"
  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/mcp_mcp_stack_startup_order.py" "$(mcp_policy_path)" "$stack_id"
}

# @function _mcp_component_kustomize
_mcp_component_kustomize() {
  local component="$1"
  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/mcp_mcp_component_kustomize.py" "$(mcp_policy_path)" "$component"
}

# @function start_mcp_component
start_mcp_component() {
  local component="$1"
  local kust
  kust=$(_mcp_component_kustomize "$component")
  if [[ -z $kust ]]; then
    err "Unknown MCP component: ${component}"
    return 1
  fi
  log "Applying ${component} from ${kust}..."
  kubectl apply -k "${REPO_ROOT}/${kust}"
}

# @function stop_mcp_component
stop_mcp_component() {
  local component="$1"
  local kust
  kust=$(_mcp_component_kustomize "$component")
  if [[ -z $kust ]]; then
    err "Unknown MCP component: ${component}"
    return 1
  fi
  log "Deleting ${component} from ${kust}..."
  kubectl delete -k "${REPO_ROOT}/${kust}" --ignore-not-found=true --wait=false
}

# @function get_mcp_catalog_json
get_mcp_catalog_json() {
  _mcp_load_policy_json | python3 -c "
import json, sys
policy = json.load(sys.stdin)
print(json.dumps({
    'namespace': policy.get('namespace', 'agent-tools'),
    'nodeports': policy.get('nodeports', {}),
    'context7': policy.get('context7', {}),
    'components': policy.get('components', {}),
    'stacks': policy.get('stacks', {}),
}))
"
}

# @function get_mcp_stack_status_json
get_mcp_stack_status_json() {
  local ns
  ns=$(mcp_namespace)
  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/mcp_get_mcp_stack_status_json.py" "$ns" "$(mcp_policy_path)"
}

# @function start_mcp_stack
start_mcp_stack() {
  local stack_id="$1"
  local policy_path order component

  policy_path=$(mcp_policy_path)
  if ! python3 -c "
import sys
from pathlib import Path
try:
    import yaml
    p = yaml.safe_load(Path('${policy_path}').read_text()) or {}
except Exception:
    p = {}
sys.exit(0 if '${stack_id}' in p.get('stacks', {}) else 1)
"; then
    err "Unknown MCP stack: ${stack_id}"
    exit 1
  fi

  warn "=== MCP AGENT TOOLKIT: ${stack_id} ==="
  if [[ ${LAB_NON_INTERACTIVE:-} != "1" ]]; then
    echo
    read -r -p "Start MCP stack ${stack_id}? [yes/NO] " response
    if [[ ! $response =~ ^[Yy][Ee][Ss]$ ]]; then
      log "Aborted."
      exit 0
    fi
  else
    local is_heavy
    is_heavy=$(python3 -c "
from pathlib import Path
try:
    import yaml
    p = yaml.safe_load(Path('${policy_path}').read_text()) or {}
except Exception:
    p = {}
print('true' if p.get('stacks', {}).get('${stack_id}', {}).get('heavy') else 'false')
")
    if [[ $is_heavy == "true" ]]; then
      require_heavy_confirm "${stack_id}" "Heavy MCP stack requires confirmation." || exit 1
    elif [[ ${LAB_CONFIRM_TOKEN:-} != "yes" ]]; then
      require_heavy_confirm "${stack_id}" "MCP stack deploy requires confirmation." || exit 1
    fi
  fi

  ensure_mcp_namespace

  if ! kubectl get secret mcp-secrets -n "$(mcp_namespace)" &>/dev/null; then
    warn "Secret mcp-secrets not found — create from mcp/config/secrets.example.env before production use."
  fi

  order=$(_mcp_stack_startup_order "$stack_id")
  while IFS= read -r component; do
    [[ -z $component ]] && continue
    start_mcp_component "$component"
    sleep 3
  done <<<"$order"

  log "MCP stack ${stack_id} submitted. NodePorts: see mcp/config/mcp-policy.yaml"
  log "kubectl get svc -n $(mcp_namespace) | grep -E 'mcp-|context7'"
}

# @function stop_mcp_stack
stop_mcp_stack() {
  local target="${1:-all}"
  local policy_path

  policy_path=$(mcp_policy_path)

  if [[ $target == "all" ]]; then
    python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/mcp_stop_mcp_stack.py" "$policy_path"
  else
    _mcp_stack_startup_order "$target" | tail -r
  fi | while IFS= read -r component; do
    [[ -z $component ]] && continue
    stop_mcp_component "$component" || true
  done
  log "MCP stack stop complete for ${target}"
}
