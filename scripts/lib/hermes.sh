#!/usr/bin/env bash
#
# ## Hermes Agent helpers
#
# Docker deploy helpers for Spark host integration and policy gates.

# Resolve repo root at source time (walk tree when BASH_SOURCE is unavailable).
# @function _hermes_discover_repo_root
# Walk parent directories to find repo root via hermes-policy.yaml.
# @returns 0 and prints path when found; 1 otherwise.

_hermes_discover_repo_root() {
  local dir="${REPO_ROOT:-${PWD}}"
  while [[ -n "$dir" && "$dir" != "/" ]]; do
    if [[ -f "${dir}/hermes/config/hermes-policy.yaml" ]]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
  _HERMES_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  _HERMES_REPO_ROOT_DEFAULT="$(cd "${_HERMES_LIB_DIR}/../.." && pwd)"
else
  _HERMES_REPO_ROOT_DEFAULT="$(_hermes_discover_repo_root || echo "${PWD}")"
  _HERMES_LIB_DIR="${_HERMES_REPO_ROOT_DEFAULT}/scripts/lib"
fi

# @function _hermes_repo_root
_hermes_repo_root() {
  if [[ -n "${REPO_ROOT:-}" ]]; then
    echo "${REPO_ROOT}"
  else
    echo "${_HERMES_REPO_ROOT_DEFAULT}"
  fi
}

# @function hermes_policy_path
hermes_policy_path() {
  echo "$(_hermes_repo_root)/hermes/config/hermes-policy.yaml"
}

# @function hermes_policy_json_path
hermes_policy_json_path() {
  echo "$(_hermes_repo_root)/hermes/config/hermes-policy.json"
}

# @function hermes_data_dir
hermes_data_dir() {
  echo "$(_hermes_repo_root)/hermes/data"
}

# @function hermes_compose_file
hermes_compose_file() {
  echo "$(_hermes_repo_root)/hermes/docker-compose.yaml"
}

# @function hermes_port_forward_pid_file
hermes_port_forward_pid_file() {
  echo "$(hermes_data_dir)/.port-forward.pid"
}

# @function _hermes_load_policy_json
_hermes_load_policy_json() {
  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/hermes_hermes_load_policy_json.py" "$(hermes_policy_json_path)" "$(hermes_policy_path)"
}

# @function hermes_ensure_data_dir
hermes_ensure_data_dir() {
  local data_dir root
  data_dir=$(hermes_data_dir)
  root="$(_hermes_repo_root)"
  mkdir -p "${data_dir}"

  if [[ ! -f "${data_dir}/config.yaml" ]]; then
    cp "${root}/hermes/config/config.yaml.example" "${data_dir}/config.yaml"
    log "Seeded ${data_dir}/config.yaml"
  fi

  if [[ ! -f "${data_dir}/.env" ]]; then
    cp "${root}/hermes/config/env.example" "${data_dir}/.env"
    log "Seeded ${data_dir}/.env — review credentials before production use."
  fi

  if [[ ! -f "${data_dir}/SOUL.md" ]]; then
    cp "${root}/hermes/config/SOUL.md.example" "${data_dir}/SOUL.md"
    log "Seeded ${data_dir}/SOUL.md"
  fi

  # Generate missing secrets in .env
  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/hermes_hermes_ensure_data_dir.py" "${data_dir}/.env"
}

# @function hermes_render_config
# Optional second arg: output config path (defaults to hermes/data/config.yaml).
# Optional third arg: url_mode override (host_localhost | in_cluster).
hermes_render_config() {
  local stack_id="$1"
  local config_path="${2:-$(hermes_data_dir)/config.yaml}"
  local url_mode_override="${3:-}"
  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/hermes_hermes_render_config.py" "$(hermes_policy_path)" "$config_path" "$stack_id" "$url_mode_override"
}

# @function hermes_check_prerequisites
hermes_check_prerequisites() {
  local stack_id="$1"
  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/hermes_hermes_check_prerequisites.py" "$(hermes_policy_path)" "$stack_id"
}

# @function hermes_stop_port_forward
hermes_stop_port_forward() {
  local pid_file pid
  pid_file=$(hermes_port_forward_pid_file)
  if [[ -f "$pid_file" ]]; then
    pid=$(cat "$pid_file" 2>/dev/null || true)
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      log "Stopped inference port-forward (pid ${pid})"
    fi
    rm -f "$pid_file"
  fi
  # Clean stale kubectl port-forward on inference port
  pkill -f "kubectl port-forward.*127.0.0.1:8000:8000" 2>/dev/null || true
}

# @function hermes_start_port_forward
hermes_start_port_forward() {
  local stack_id="$1"
  local svc ns pid_file

  hermes_stop_port_forward

  read -r svc ns < <(python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/hermes_hermes_start_port_forward.py" "$(hermes_policy_path)" "$stack_id")

  if [[ -z "$svc" ]]; then
    err "No inference service configured for stack ${stack_id}"
    return 1
  fi

  pid_file=$(hermes_port_forward_pid_file)
  log "Port-forward ${ns}/svc/${svc} → 127.0.0.1:8000"
  kubectl port-forward -n "$ns" "svc/${svc}" 127.0.0.1:8000:8000 >/dev/null 2>&1 &
  echo $! >"$pid_file"
  sleep 2

  if ! kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    err "Port-forward failed to start for svc/${svc}"
    rm -f "$pid_file"
    return 1
  fi
}

# @function get_hermes_catalog_json
get_hermes_catalog_json() {
  _hermes_load_policy_json | python3 -c "
import json, sys
policy = json.load(sys.stdin)
print(json.dumps({
    'ports': policy.get('ports', {}),
    'inference_presets': policy.get('inference_presets', {}),
    'mcp_servers': policy.get('mcp_servers', {}),
    'stacks': policy.get('stacks', {}),
}))
"
}

# @function get_hermes_status_json
get_hermes_status_json() {
  local data_dir compose_file container_name
  data_dir=$(hermes_data_dir)
  compose_file=$(hermes_compose_file)
  container_name=$(python3 -c "
import json, sys
from pathlib import Path
try:
    import yaml
    p = yaml.safe_load(Path('$(hermes_policy_path)').read_text()) or {}
except Exception:
    p = {}
print(p.get('container_name', 'hermes'))
")

  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/hermes_get_hermes_status_json.py" "$data_dir" "$compose_file" "$container_name" "$(hermes_port_forward_pid_file)"
}

# @function start_hermes_stack
start_hermes_stack() {
  local stack_id="$1"
  local policy_path data_dir compose_file

  policy_path=$(hermes_policy_path)
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
    err "Unknown Hermes stack: ${stack_id}"
    exit 1
  fi

  warn "=== HERMES AGENT: ${stack_id} ==="
  if [[ "${LAB_NON_INTERACTIVE:-}" != "1" ]]; then
    echo
    read -r -p "Start Hermes stack ${stack_id}? [yes/NO] " response
    if [[ ! "$response" =~ ^[Yy][Ee][Ss]$ ]]; then
      log "Aborted."
      exit 0
    fi
  elif [[ "${LAB_CONFIRM_TOKEN:-}" != "yes" ]]; then
    require_heavy_confirm "${stack_id}" "Hermes stack deploy requires confirmation." || exit 1
  fi

  if ! command -v docker >/dev/null 2>&1; then
    err "docker not found — install Docker Engine on the Spark node"
    exit 1
  fi

  hermes_ensure_data_dir
  hermes_render_config "$stack_id"

  if ! hermes_check_prerequisites "$stack_id"; then
    local prereq_json
    prereq_json=$(python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/hermes_prereq_details.py" "$(hermes_policy_path)" "$stack_id" || true)
    err "Prerequisites not met for ${stack_id}"
    echo "$prereq_json" | python3 -m json.tool 2>/dev/null || echo "$prereq_json"
    err "Start required stacks first, e.g.:"
    err "  nemotron-stack start $(echo "$prereq_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('requires_nemotron_stack',''))" 2>/dev/null || echo 'nemotron-agentic-spark-1')"
    err "  mcp-stack start $(echo "$prereq_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('requires_mcp_stack',''))" 2>/dev/null || echo 'mcp-agent-toolkit')"
    exit 1
  fi

  hermes_start_port_forward "$stack_id"

  data_dir=$(hermes_data_dir)
  compose_file=$(hermes_compose_file)
  export HERMES_DATA_DIR="${data_dir}"

  log "Starting Hermes container (host network)..."
  docker compose -f "${compose_file}" up -d

  log "Hermes stack ${stack_id} started."
  log "Dashboard: http://<node-ip>:9119  Gateway API: http://<node-ip>:8642/v1"
  log "Status: hermes-stack status"
}

# @function stop_hermes_stack
stop_hermes_stack() {
  local compose_file
  compose_file=$(hermes_compose_file)
  export HERMES_DATA_DIR
  HERMES_DATA_DIR="$(hermes_data_dir)"

  docker compose -f "${compose_file}" down --remove-orphans 2>/dev/null || true
  hermes_stop_port_forward
  log "Hermes stack stopped."
}
