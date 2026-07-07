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
  python3 - "$(hermes_policy_json_path)" "$(hermes_policy_path)" <<'PY'
import json, sys
from pathlib import Path

def load_policy(json_path, yaml_path):
    jp = Path(json_path)
    if jp.is_file():
        return json.loads(jp.read_text())
    yp = Path(yaml_path)
    if not yp.is_file():
        return {}
    try:
        import yaml
        return yaml.safe_load(yp.read_text()) or {}
    except Exception:
        return {}

print(json.dumps(load_policy(sys.argv[1], sys.argv[2])))
PY
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
  python3 - "${data_dir}/.env" <<'PY'
import re, subprocess, sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()
changed = False

def ensure_key(name):
    global changed
    m = re.search(rf'^{re.escape(name)}=(.*)$', text, re.M)
    if not m or not m.group(1).strip():
        val = subprocess.check_output(["openssl", "rand", "-hex", "32"], text=True).strip()
        if m:
            text_new = re.sub(rf'^{re.escape(name)}=.*$', f'{name}={val}', text, count=1, flags=re.M)
        else:
            text_new = text.rstrip() + f'\n{name}={val}\n'
        return text_new, True
    return text, False

for key in ("API_SERVER_KEY", "HERMES_DASHBOARD_BASIC_AUTH_SECRET"):
    text, c = ensure_key(key)
    changed = changed or c

if changed:
    path.write_text(text)
PY
}

# @function hermes_render_config
# Optional second arg: output config path (defaults to hermes/data/config.yaml).
# Optional third arg: url_mode override (host_localhost | in_cluster).
hermes_render_config() {
  local stack_id="$1"
  local config_path="${2:-$(hermes_data_dir)/config.yaml}"
  local url_mode_override="${3:-}"
  python3 - "$(hermes_policy_path)" "$config_path" "$stack_id" "$url_mode_override" <<'PY'
import sys
from pathlib import Path

def load_yaml(path):
    try:
        import yaml
        return yaml.safe_load(Path(path).read_text()) or {}
    except Exception:
        return {}

policy = load_yaml(sys.argv[1])
config_path = Path(sys.argv[2])
stack_id = sys.argv[3]
url_mode_override = sys.argv[4] if len(sys.argv) > 4 else ""

stack = policy.get("stacks", {}).get(stack_id, {})
if not stack:
    raise SystemExit(f"Unknown Hermes stack: {stack_id}")

preset_key = stack.get("inference_preset", "")
preset = policy.get("inference_presets", {}).get(preset_key, {})
mcp_names = stack.get("mcp_servers", [])

url_mode = url_mode_override or stack.get("mcp_url_mode", "host_localhost")
mode_defs = policy.get("url_modes", {}).get(url_mode, {})
mcp_defs = mode_defs.get("mcp_servers") or policy.get("mcp_servers", {})

cfg = load_yaml(str(config_path))
if not cfg:
    cfg = {}

model = cfg.setdefault("model", {})
model["provider"] = "custom"
model["default"] = preset.get("model", "")
model["api_key"] = "none"
if preset.get("context_length"):
    model["context_length"] = preset["context_length"]

inference_port = policy.get("ports", {}).get("inference_local", 8000)
inference_tpl = mode_defs.get(
    "inference_base_url_template",
    "http://127.0.0.1:{port}/v1",
)
if url_mode == "in_cluster":
    svc = preset.get("service", "")
    ns = preset.get("namespace", "ai-inference")
    model["base_url"] = inference_tpl.format(service=svc, namespace=ns, port=8000)
else:
    model["base_url"] = inference_tpl.format(port=inference_port)

mcp_servers = {}
for name in mcp_names:
    entry = mcp_defs.get(name, {})
    if not entry.get("url"):
        continue
    mcp_servers[name] = {
        "url": entry["url"],
        "tools": {"prompts": False, "resources": False},
    }
cfg["mcp_servers"] = mcp_servers

try:
    import yaml
    config_path.write_text(yaml.safe_dump(cfg, sort_keys=False, default_flow_style=False))
except Exception as exc:
    raise SystemExit(f"Failed to write config.yaml: {exc}") from exc
PY
}

# @function hermes_check_prerequisites
hermes_check_prerequisites() {
  local stack_id="$1"
  python3 - "$(hermes_policy_path)" "$stack_id" <<'PY'
import json, subprocess, sys
from pathlib import Path

def load_yaml(path):
    try:
        import yaml
        return yaml.safe_load(Path(path).read_text()) or {}
    except Exception:
        return {}

policy = load_yaml(sys.argv[1])
stack_id = sys.argv[2]
stack = policy.get("stacks", {}).get(stack_id, {})
if not stack:
    print(json.dumps({"ok": False, "error": f"unknown stack: {stack_id}"}))
    sys.exit(1)

errors = []
preset_key = stack.get("inference_preset", "")
preset = policy.get("inference_presets", {}).get(preset_key, {})
svc = preset.get("service", "")
ns = preset.get("namespace", "ai-inference")

if svc:
    try:
        out = subprocess.check_output(
            ["kubectl", "get", "pods", "-n", ns, "-l", f"app={svc}",
             "-o", "jsonpath={.items[?(@.status.phase=='Running')].metadata.name}"],
            text=True,
        ).strip()
        if not out:
            errors.append(f"Inference service {svc} has no Running pods in {ns}")
    except subprocess.CalledProcessError as exc:
        errors.append(f"Failed to check inference pods for {svc}: {exc}")

mcp_ns = "agent-tools"
mcp_defs = policy.get("mcp_servers", {})
for name in stack.get("mcp_servers", []):
    dep = mcp_defs.get(name, {}).get("k8s_deployment", "")
    if not dep:
        continue
    try:
        ready = subprocess.check_output(
            ["kubectl", "get", "deployment", dep, "-n", mcp_ns,
             "-o", "jsonpath={.status.readyReplicas}"],
            text=True,
        ).strip()
        if not ready or ready == "0":
            errors.append(f"MCP deployment {dep} not ready in {mcp_ns}")
    except subprocess.CalledProcessError:
        errors.append(f"MCP deployment {dep} not found in {mcp_ns}")

print(json.dumps({"ok": len(errors) == 0, "errors": errors, "inference_service": svc, "namespace": ns}))
if errors:
    sys.exit(1)
PY
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

  read -r svc ns < <(python3 - "$(hermes_policy_path)" "$stack_id" <<'PY'
import sys
from pathlib import Path

def load_yaml(path):
    try:
        import yaml
        return yaml.safe_load(Path(path).read_text()) or {}
    except Exception:
        return {}

policy = load_yaml(sys.argv[1])
stack = policy.get("stacks", {}).get(sys.argv[2], {})
preset = policy.get("inference_presets", {}).get(stack.get("inference_preset", ""), {})
print(preset.get("service", ""), preset.get("namespace", "ai-inference"))
PY
)

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

  python3 - "$data_dir" "$compose_file" "$container_name" "$(hermes_port_forward_pid_file)" <<'PY'
import json, subprocess, sys, urllib.request
from pathlib import Path

data_dir, compose_file, container_name, pf_pid_file = sys.argv[1:5]

def curl_ok(url, headers=None):
    try:
        req = urllib.request.Request(url, headers=headers or {})
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status < 400
    except Exception:
        return False

def docker_state():
    try:
        out = subprocess.check_output(
            ["docker", "inspect", "-f", "{{.State.Status}}", container_name],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        return out
    except Exception:
        return "missing"

pf_pid = None
pf_alive = False
if Path(pf_pid_file).is_file():
    try:
        pf_pid = int(Path(pf_pid_file).read_text().strip())
        pf_alive = Path(f"/proc/{pf_pid}").exists()
    except Exception:
        pf_alive = False

api_key = ""
env_path = Path(data_dir) / ".env"
if env_path.is_file():
    for line in env_path.read_text().splitlines():
        if line.startswith("API_SERVER_KEY="):
            api_key = line.split("=", 1)[1].strip()
            break

status = {
    "container": container_name,
    "container_state": docker_state(),
    "data_dir": data_dir,
    "port_forward": {"pid": pf_pid, "alive": pf_alive},
    "inference": {
        "url": "http://127.0.0.1:8000/v1/models",
        "reachable": curl_ok("http://127.0.0.1:8000/v1/models"),
    },
    "mcp_searxng": {
        "url": "http://127.0.0.1:32100/sse",
        "reachable": curl_ok("http://127.0.0.1:32100/sse"),
    },
    "gateway_api": {
        "url": "http://127.0.0.1:8642/v1/models",
        "reachable": curl_ok(
            "http://127.0.0.1:8642/v1/models",
            {"Authorization": f"Bearer {api_key}"} if api_key else {},
        ),
    },
    "dashboard": {
        "url": "http://127.0.0.1:9119/",
        "reachable": curl_ok("http://127.0.0.1:9119/"),
    },
}
print(json.dumps(status))
PY
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
    prereq_json=$(python3 - "$(hermes_policy_path)" "$stack_id" <<'PY' || true
import json, subprocess, sys
from pathlib import Path

def load_yaml(path):
    try:
        import yaml
        return yaml.safe_load(Path(path).read_text()) or {}
    except Exception:
        return {}

policy = load_yaml(sys.argv[1])
stack = policy.get("stacks", {}).get(sys.argv[2], {})
print(json.dumps({
    "requires_nemotron_stack": stack.get("requires_nemotron_stack"),
    "requires_mcp_stack": stack.get("requires_mcp_stack"),
}))
PY
)
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
