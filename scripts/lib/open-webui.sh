#!/usr/bin/env bash
#
# ## Open WebUI stack helpers
#
# Helm deploy helpers; Hermes gateway backend via headless Service + Endpoints.

OPENWEBUI_PORT=${OPENWEBUI_PORT:-32085}

if ! declare -F lab_repo_root >/dev/null 2>&1; then
  # shellcheck source=paths.sh disable=SC1091
  source "$(dirname "${BASH_SOURCE[0]:-${0}}")/paths.sh"
fi

# @function openwebui_policy_path
openwebui_policy_path() {
  echo "$(lab_repo_root)/config/open-webui-policy.yaml"
}

# @function openwebui_policy_json_path
openwebui_policy_json_path() {
  echo "$(lab_repo_root)/config/open-webui-policy.json"
}

# @function _openwebui_load_policy_json
_openwebui_load_policy_json() {
  python3 - "$(openwebui_policy_json_path)" "$(openwebui_policy_path)" <<'PY'
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

# @function openwebui_control_plane_ip
# Resolves spark0 InternalIP for Hermes host-network gateway bridge.
openwebui_control_plane_ip() {
  if [[ -n "${LAB_SPARK0_IP:-}" ]]; then
    echo "${LAB_SPARK0_IP}"
    return 0
  fi
  local ip
  ip=$(kubectl get node spark0 -o jsonpath='{.status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || true)
  if [[ -z "$ip" ]]; then
    ip=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || true)
  fi
  if [[ -z "$ip" ]]; then
    err "Could not resolve control-plane InternalIP (set LAB_SPARK0_IP)"
    return 1
  fi
  echo "$ip"
}

# @function openwebui_hermes_api_key
openwebui_hermes_api_key() {
  local env_file
  env_file="$(hermes_data_dir 2>/dev/null || echo "${REPO_ROOT}/hermes/data")/.env"
  if [[ ! -f "$env_file" ]]; then
    return 1
  fi
  grep -E '^API_SERVER_KEY=' "$env_file" | head -1 | cut -d= -f2- | tr -d '\r'
}

# @function openwebui_ensure_secrets
openwebui_ensure_secrets() {
  require_kubectl
  ensure_dev_namespaces

  local api_key
  api_key=$(openwebui_hermes_api_key || true)
  if [[ -z "$api_key" ]]; then
    err "Hermes API_SERVER_KEY not found — run: ./scripts/manage.sh start-hermes"
    return 1
  fi

  kubectl create secret generic open-webui-secrets -n dev \
    --from-literal=hermes-api-key="${api_key}" \
    --dry-run=client -o yaml | kubectl apply -f -
  log "Synced open-webui-secrets (hermes-api-key) in dev namespace"
}

# @function openwebui_apply_hermes_gateway
openwebui_apply_hermes_gateway() {
  require_kubectl
  local ip port
  ip=$(openwebui_control_plane_ip) || return 1
  port=$(_openwebui_load_policy_json | python3 -c "
import json, sys
policy = json.load(sys.stdin)
print(policy.get('backends', {}).get('hermes_gateway', {}).get('port', 8642))
")

  python3 - "$ip" "$port" <<'PY' | kubectl apply -f -
import sys, yaml
ip, port = sys.argv[1], int(sys.argv[2])
docs = [
    {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {
            "name": "hermes-gateway",
            "namespace": "dev",
            "labels": {"app": "hermes-gateway", "lab.tier": "optional_dev"},
        },
        "spec": {
            "clusterIP": "None",
            "ports": [{"name": "http", "port": port, "targetPort": port, "protocol": "TCP"}],
            "selector": {},
        },
    },
    {
        "apiVersion": "v1",
        "kind": "Endpoints",
        "metadata": {
            "name": "hermes-gateway",
            "namespace": "dev",
            "labels": {"app": "hermes-gateway"},
        },
        "subsets": [
            {
                "addresses": [{"ip": ip}],
                "ports": [{"name": "http", "port": port, "protocol": "TCP"}],
            }
        ],
    },
]
for doc in docs:
    print("---")
    print(yaml.safe_dump(doc, sort_keys=False).rstrip())
PY
  log "Hermes gateway bridge → ${ip}:${port} (dev/hermes-gateway)"
}

# @function openwebui_check_prerequisites
openwebui_check_prerequisites() {
  local stack_id="${1:-open-webui-lab}"
  local hermes_stack
  hermes_stack=$(_openwebui_load_policy_json | python3 -c "
import json, sys
policy = json.load(sys.stdin)
stack = policy.get('stacks', {}).get('${stack_id}', {})
print(stack.get('requires_hermes_stack', policy.get('backends', {}).get('hermes_gateway', {}).get('requires_hermes_stack', 'hermes-lab')))
")

  if ! command -v docker >/dev/null 2>&1; then
    err "docker not found — Hermes must run on the Spark host"
    return 1
  fi

  local container_name
  container_name=$(python3 -c "
from pathlib import Path
try:
    import yaml
    p = yaml.safe_load(Path('$(hermes_policy_path)').read_text()) or {}
except Exception:
    p = {}
print(p.get('container_name', 'hermes'))
" 2>/dev/null || echo "hermes")

  local state
  state=$(docker inspect -f '{{.State.Status}}' "$container_name" 2>/dev/null || echo "missing")
  if [[ "$state" != "running" ]]; then
    err "Hermes container '${container_name}' is not running (state: ${state})"
    err "Start Hermes first: ./scripts/manage.sh start-hermes"
    return 1
  fi

  local api_key reachable
  api_key=$(openwebui_hermes_api_key || true)
  if [[ -z "$api_key" ]]; then
    err "API_SERVER_KEY missing in hermes/data/.env"
    return 1
  fi

  reachable=$(curl -sf -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${api_key}" \
    "http://127.0.0.1:8642/v1/models" 2>/dev/null || echo "000")
  if [[ "$reachable" != "200" ]]; then
    err "Hermes gateway not reachable at http://127.0.0.1:8642/v1/models (HTTP ${reachable})"
    return 1
  fi

  if type hermes_check_prerequisites &>/dev/null; then
    hermes_check_prerequisites "$hermes_stack" >/dev/null 2>&1 || {
      warn "Hermes stack prerequisites may be incomplete for ${hermes_stack}"
      warn "Ensure Nemotron orchestrator and MCP toolkit are running"
    }
  fi

  return 0
}

# @function get_openwebui_catalog_json
get_openwebui_catalog_json() {
  _openwebui_load_policy_json | python3 -c "
import json, sys
policy = json.load(sys.stdin)
print(json.dumps({
    'helm': policy.get('helm', {}),
    'ports': policy.get('ports', {}),
    'sso': policy.get('sso', {}),
    'backends': policy.get('backends', {}),
    'stacks': policy.get('stacks', {}),
}))
"
}

# @function get_openwebui_status_json
get_openwebui_status_json() {
  local policy_json release ns domain host
  policy_json=$(_openwebui_load_policy_json)
  release=$(echo "$policy_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('helm',{}).get('release','open-webui'))")
  ns=$(echo "$policy_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('helm',{}).get('namespace','dev'))")
  local local_d public_d primary https_port
  local_d="$(lab_local_domain 2>/dev/null || echo "${LAB_SSO_DOMAIN:-lab.local}")"
  public_d="$(lab_public_domain 2>/dev/null || true)"
  primary="$(lab_primary_domain 2>/dev/null || echo local)"
  https_port="$(lab_sso_https_port 2>/dev/null || echo 32443)"
  host="${LAB_SSO_HOST:-${DASHBOARD_HOST:-localhost}}"
  sso_host=$(echo "$policy_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('sso',{}).get('host','chat'))")

  python3 - "$release" "$ns" "$local_d" "$public_d" "$primary" "$host" "$sso_host" "$OPENWEBUI_PORT" "$https_port" <<'PY'
import json, subprocess, sys, urllib.request

release, ns, local_d, public_d, primary, host, sso_host, nodeport, https_port = sys.argv[1:9]

def helm_installed():
    try:
        out = subprocess.check_output(["helm", "list", "-n", ns, "-q"], text=True, stderr=subprocess.DEVNULL)
        return release in out.split()
    except Exception:
        return False

def pod_ready():
    try:
        out = subprocess.check_output(
            ["kubectl", "get", "pods", "-n", ns, "-l", f"app.kubernetes.io/instance={release}",
             "-o", "jsonpath={.items[?(@.status.phase=='Running')].metadata.name}"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        return bool(out)
    except Exception:
        return False

def endpoint_ip():
    try:
        return subprocess.check_output(
            ["kubectl", "get", "endpoints", "hermes-gateway", "-n", "dev",
             "-o", "jsonpath={.subsets[0].addresses[0].ip}"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        return ""

def hermes_gateway_ok():
    ip = endpoint_ip()
    if not ip:
        return False, ""
    url = f"http://{ip}:8642/v1/models"
    try:
        with urllib.request.urlopen(url, timeout=3) as resp:
            return resp.status < 400, url
    except Exception:
        return False, url

installed = helm_installed()
ready = pod_ready() if installed else False
state = "stopped"
if installed:
    state = "running" if ready else "starting"

gw_ok, gw_url = hermes_gateway_ok() if installed else (False, "")

status = {
    "release": release,
    "namespace": ns,
    "state": state,
    "helm_installed": installed,
    "pod_ready": ready,
    "urls": {
        "local": f"https://{sso_host}.{local_d}:{https_port}/",
        "public": f"https://{sso_host}.{public_d}/" if public_d else None,
        "sso": (
            f"https://{sso_host}.{public_d}/"
            if primary == "public" and public_d
            else f"https://{sso_host}.{local_d}:{https_port}/"
        ),
        "nodeport": f"http://{host}:{nodeport}",
    },
    "backend": {
        "hermes_gateway": {
            "url": gw_url or "http://hermes-gateway.dev.svc.cluster.local:8642/v1",
            "reachable": gw_ok,
            "endpoint_ip": endpoint_ip(),
        }
    },
    "prerequisites": {
        "hermes_stack": "hermes-lab",
    },
}
print(json.dumps(status))
PY
}

# @function start_openwebui_stack
start_openwebui_stack() {
  local stack_id="${1:-open-webui-lab}"

  warn "=== OPEN WEBUI: ${stack_id} ==="
  if [[ "${LAB_NON_INTERACTIVE:-}" != "1" ]]; then
    echo
    read -r -p "Start Open WebUI stack ${stack_id}? [yes/NO] " response
    if [[ ! "$response" =~ ^[Yy][Ee][Ss]$ ]]; then
      log "Aborted."
      exit 0
    fi
  elif [[ "${LAB_CONFIRM_TOKEN:-}" != "yes" ]]; then
    require_heavy_confirm "${stack_id}" "Open WebUI deploy requires confirmation." || exit 1
  fi

  require_helm
  require_kubectl
  check_cluster_access

  if ! openwebui_check_prerequisites "$stack_id"; then
    exit 1
  fi

  openwebui_ensure_secrets
  openwebui_apply_hermes_gateway

  local policy_json chart_repo chart_name release ns chart_version values_file
  policy_json=$(_openwebui_load_policy_json)
  chart_repo=$(echo "$policy_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('helm',{}).get('repo',''))")
  chart_name=$(echo "$policy_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('helm',{}).get('chart','open-webui'))")
  release=$(echo "$policy_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('helm',{}).get('release','open-webui'))")
  ns=$(echo "$policy_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('helm',{}).get('namespace','dev'))")
  chart_version=$(echo "$policy_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('helm',{}).get('chart_version','') or '')")
  values_file="${REPO_ROOT}/ansible/files/open-webui-values.yaml"

  helm repo add open-webui "${chart_repo}" 2>/dev/null || true
  helm repo update open-webui 2>/dev/null || helm repo update 2>/dev/null || true

  local svc_type="NodePort"
  local extra_args=()
  if [[ -f "$values_file" ]]; then
    extra_args+=(-f "$values_file")
  fi
  if type sso_enabled &>/dev/null && sso_enabled; then
    svc_type="ClusterIP"
  else
    extra_args+=(--set "service.type=NodePort" --set "service.nodePort=${OPENWEBUI_PORT}")
  fi
  extra_args+=(--set "service.type=${svc_type}")

  local version_args=()
  if [[ -n "$chart_version" ]]; then
    version_args+=(--version "$chart_version")
  fi

  log "Installing Open WebUI Helm release ${release} in ${ns}..."
  helm upgrade --install "$release" "open-webui/${chart_name}" \
    --namespace "$ns" \
    "${version_args[@]}" \
    "${extra_args[@]}" \
    --wait --timeout 8m

  log "Open WebUI stack ${stack_id} started."
  if type sso_enabled &>/dev/null && sso_enabled; then
    local sso_host domain
    sso_host=$(echo "$policy_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('sso',{}).get('host','chat'))")
    domain=$(sso_domain 2>/dev/null || echo "${LAB_SSO_DOMAIN:-lab.local}")
    log "Chat UI (SSO): https://${sso_host}.${domain}:32443"
  else
    log "Chat UI: http://<spark0>:${OPENWEBUI_PORT}"
  fi
  log "Backend: Hermes gateway http://hermes-gateway.dev.svc.cluster.local:8642/v1"
}

# @function stop_openwebui_stack
stop_openwebui_stack() {
  require_helm
  local policy_json release ns
  policy_json=$(_openwebui_load_policy_json)
  release=$(echo "$policy_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('helm',{}).get('release','open-webui'))")
  ns=$(echo "$policy_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('helm',{}).get('namespace','dev'))")

  helm uninstall "$release" -n "$ns" --ignore-not-found 2>/dev/null || true
  kubectl delete endpoints hermes-gateway -n dev --ignore-not-found 2>/dev/null || true
  kubectl delete service hermes-gateway -n dev --ignore-not-found 2>/dev/null || true
  log "Open WebUI stack stopped."
}