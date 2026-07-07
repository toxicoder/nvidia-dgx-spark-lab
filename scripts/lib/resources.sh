#!/usr/bin/env bash
#
# ## Resource Guard — capacity math, pre-flight checks, and free-resource suggestions
#
# Loads config/resource-policy.yaml and compares cluster allocatable vs requested
# resources (GPU, CPU, memory) with configured headroom.
#
# Used by manage.sh, cluster-resources.sh, inference-workloads.sh, and dashboard utilities.

# @function resource_policy_path
# Returns absolute path to resource-policy.json (stdlib parse target; YAML is human source).
resource_policy_path() {
  local root="${REPO_ROOT:-}"
  if [[ -z "$root" ]]; then
    if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
      root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
    else
      root="${PWD}"
    fi
  fi
  echo "${root}/config/resource-policy.json"
}

# @function _resource_python
# Runs inline Python with PyYAML-free stdlib-only YAML subset parser via json export.
_resource_python() {
  python3 - "$@" <<'PY'
import json, re, sys
from pathlib import Path

def load_policy(path):
    return json.loads(Path(path).read_text())

def parse_quantity(val, kind):
    if val is None:
        return 0
    s = str(val).strip()
    if not s:
        return 0
    if kind == "gpu":
        return int(float(s))
    if kind == "cpu":
        if s.endswith("m"):
            return int(s[:-1]) / 1000.0
        return float(s)
    if kind == "memory":
        m = re.match(r"^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|K|M|G|T)?$", s)
        if not m:
            return 0
        num = float(m.group(1))
        unit = m.group(2) or ""
        mult = {"Ki": 1024, "Mi": 1024**2, "Gi": 1024**3, "Ti": 1024**4,
                "K": 1000, "M": 1000**2, "G": 1000**3, "T": 1000**4}.get(unit, 1)
        return int(num * mult)
    return 0

def fmt_cpu(cores):
    if cores >= 1 and abs(cores - round(cores)) < 0.01:
        return str(int(round(cores)))
    return f"{cores:.2f}"

def fmt_mem(b):
    if b >= 1024**3:
        return f"{b / 1024**3:.1f}Gi"
    if b >= 1024**2:
        return f"{int(b / 1024**2)}Mi"
    return f"{b}B"

cmd = sys.argv[1]
policy_path = sys.argv[2]

if cmd == "load":
    print(json.dumps(load_policy(policy_path)))
elif cmd == "model_req":
    policy = load_policy(policy_path)
    model = sys.argv[3]
    m = policy.get("models", {}).get(model)
    if not m:
        print(json.dumps({"error": f"unknown model: {model}"}))
        sys.exit(1)
    req = {
        "gpus": int(m.get("gpus", 0)),
        "cpu": parse_quantity(m.get("cpu", 0), "cpu"),
        "memory": parse_quantity(m.get("memory", 0), "memory"),
        "heavy": bool(m.get("heavy", False)),
        "job_name": m.get("job_name", model),
        "stack_with": m.get("stack_with", []),
    }
    for extra in req["stack_with"]:
        em = policy.get("models", {}).get(extra, {})
        req["gpus"] += int(em.get("gpus", 0))
        req["cpu"] += parse_quantity(em.get("cpu", 0), "cpu")
        req["memory"] += parse_quantity(em.get("memory", 0), "memory")
    print(json.dumps(req))
elif cmd == "headroom":
    policy = load_policy(policy_path)
    nodes_json = sys.argv[3]
    nodes = json.loads(nodes_json)
    h = policy.get("headroom", {})
    pct_cpu = float(h.get("cpu_percent", 15)) / 100.0
    pct_mem = float(h.get("memory_percent", 15)) / 100.0
    min_mem = parse_quantity(h.get("memory_min_per_node", "64Gi"), "memory")
    min_cpu = parse_quantity(h.get("cpu_min_per_node", "4"), "cpu")
    total_cpu = 0.0
    total_mem = 0
    for n in nodes:
        alloc = n.get("allocatable", {})
        cpu = parse_quantity(alloc.get("cpu", 0), "cpu")
        mem = parse_quantity(alloc.get("memory", 0), "memory")
        total_cpu += max(min_cpu, cpu * pct_cpu)
        total_mem += max(min_mem, int(mem * pct_mem))
    print(json.dumps({"cpu": total_cpu, "memory": total_mem}))
elif cmd == "stack_req":
    policy = load_policy(policy_path)
    stack_id = sys.argv[3]
    stack = policy.get("stacks", {}).get(stack_id)
    if not stack:
        print(json.dumps({"error": f"unknown stack: {stack_id}"}))
        sys.exit(1)
    req = {"gpus": 0, "cpu": 0.0, "memory": 0, "heavy": bool(stack.get("heavy", False)),
           "stack_with": stack.get("stack_with", []), "min_nodes": stack.get("min_nodes"),
           "max_nodes": stack.get("max_nodes"), "label": stack.get("label", stack_id)}
    for name in stack.get("stack_with", []):
        m = policy.get("models", {}).get(name, {})
        req["gpus"] += int(m.get("gpus", 0))
        req["cpu"] += parse_quantity(m.get("cpu", 0), "cpu")
        req["memory"] += parse_quantity(m.get("memory", 0), "memory")
    print(json.dumps(req))
elif cmd == "check":
    policy = load_policy(policy_path)
    capacity = json.loads(sys.argv[3])
    action = sys.argv[4]
    model = action.split(":", 1)[1] if action.startswith("model:") else None
    stack_id = action.split(":", 1)[1] if action.startswith("stack:") else None
    required = {"gpus": 0, "cpu": 0.0, "memory": 0}
    heavy = False
    node_count = int(capacity.get("node_count", 0) or 0)
    if stack_id:
        stack = policy.get("stacks", {}).get(stack_id)
        if not stack:
            print(json.dumps({"ok": False, "verdict": "unknown_stack", "action": action}))
            sys.exit(1)
        min_n = stack.get("min_nodes")
        max_n = stack.get("max_nodes")
        if min_n is not None and node_count < int(min_n):
            print(json.dumps({"ok": False, "verdict": "insufficient_nodes",
                              "action": action, "heavy": bool(stack.get("heavy", False)),
                              "required": {"nodes": min_n}, "available": {"nodes": node_count},
                              "deficit": {"nodes": int(min_n) - node_count}}))
            sys.exit(1)
        if max_n is not None and node_count > int(max_n):
            print(json.dumps({"ok": False, "verdict": "too_many_nodes",
                              "action": action, "heavy": bool(stack.get("heavy", False)),
                              "required": {"nodes": max_n}, "available": {"nodes": node_count},
                              "deficit": {}}))
            sys.exit(1)
        heavy = bool(stack.get("heavy", False))
        for name in stack.get("stack_with", []):
            m = policy.get("models", {}).get(name, {})
            required["gpus"] += int(m.get("gpus", 0))
            required["cpu"] += parse_quantity(m.get("cpu", 0), "cpu")
            required["memory"] += parse_quantity(m.get("memory", 0), "memory")
    elif model:
        m = policy.get("models", {}).get(model)
        if not m:
            print(json.dumps({"ok": False, "verdict": "unknown_model", "action": action}))
            sys.exit(1)
        required["gpus"] = int(m.get("gpus", 0))
        required["cpu"] = parse_quantity(m.get("cpu", 0), "cpu")
        required["memory"] = parse_quantity(m.get("memory", 0), "memory")
        heavy = bool(m.get("heavy", False))
        for extra in m.get("stack_with", []):
            em = policy.get("models", {}).get(extra, {})
            required["gpus"] += int(em.get("gpus", 0))
            required["cpu"] += parse_quantity(em.get("cpu", 0), "cpu")
            required["memory"] += parse_quantity(em.get("memory", 0), "memory")
    elif action.startswith("dev:"):
        svc = action.split(":", 1)[1]
        s = policy.get("tiers", {}).get("optional_dev", {}).get("services", {}).get(svc, {})
        required["cpu"] = parse_quantity(s.get("cpu", 0), "cpu")
        required["memory"] = parse_quantity(s.get("memory", 0), "memory")
    avail = capacity.get("available", {})
    avail_gpus = int(avail.get("gpus", 0) or 0)
    avail_cpu = parse_quantity(avail.get("cpu", 0), "cpu")
    avail_mem = parse_quantity(avail.get("memory", 0), "memory")
    deficit = {}
    ok = True
    verdict = "ok"
    if required["gpus"] > avail_gpus:
        ok = False
        verdict = "insufficient_gpu"
        deficit["gpus"] = required["gpus"] - avail_gpus
    if required["cpu"] > avail_cpu:
        ok = False
        verdict = "insufficient_cpu" if verdict == "ok" else verdict + "_cpu"
        deficit["cpu"] = round(required["cpu"] - avail_cpu, 2)
    if required["memory"] > avail_mem:
        ok = False
        verdict = "insufficient_memory" if verdict == "ok" else verdict + "_memory"
        deficit["memory"] = required["memory"] - avail_mem
    out = {
        "ok": ok,
        "verdict": verdict if ok else verdict,
        "action": action,
        "heavy": heavy,
        "required": {
            "gpus": required["gpus"],
            "cpu": fmt_cpu(required["cpu"]),
            "memory": fmt_mem(required["memory"]),
        },
        "available": {
            "gpus": avail_gpus,
            "cpu": fmt_cpu(avail_cpu),
            "memory": fmt_mem(avail_mem),
        },
        "deficit": {
            k: (v if k != "memory" else fmt_mem(v)) for k, v in deficit.items()
        },
    }
    print(json.dumps(out))
    sys.exit(0 if ok else 1)
PY
}

# @function _kubectl_nodes_json
# Returns simplified per-node allocatable JSON array.
_kubectl_nodes_json() {
  if [[ -n "${LAB_MOCK_NODES_JSON:-}" ]]; then
    echo "$LAB_MOCK_NODES_JSON"
    return 0
  fi
  kubectl get nodes -o json 2>/dev/null | jq -c '
    [.items[] | {
      name: .metadata.name,
      allocatable: {
        cpu: (.status.allocatable.cpu // "0"),
        memory: (.status.allocatable.memory // "0"),
        gpu: (.status.allocatable["nvidia.com/gpu"] // "0")
      }
    }]
  ' 2>/dev/null || echo "[]"
}

# @function _kubectl_pod_requests_json
# Sums Running/Pending pod container requests cluster-wide.
_kubectl_pod_requests_json() {
  if [[ -n "${LAB_MOCK_PODS_JSON:-}" ]]; then
    echo "$LAB_MOCK_PODS_JSON"
    return 0
  fi
  kubectl get pods -A -o json 2>/dev/null | jq -c '
    [.items[]
     | select(.status.phase == "Running" or .status.phase == "Pending")
     | .spec.containers[]?
     | {
         gpu: (.resources.requests["nvidia.com/gpu"] // "0"),
         cpu: (.resources.requests.cpu // "0"),
         memory: (.resources.requests.memory // "0")
       }]
  ' 2>/dev/null || echo "[]"
}

# @function get_cluster_capacity_json
# Emits JSON with allocatable, requested, headroom, available (after headroom).
get_cluster_capacity_json() {
  local policy_path nodes_json pods_json
  policy_path=$(resource_policy_path)

  if ! command -v jq &>/dev/null; then
    echo '{"error":"jq required"}'
    return 1
  fi

  nodes_json=$(_kubectl_nodes_json)
  pods_json=$(_kubectl_pod_requests_json)

  local base_json headroom_json
  base_json=$(jq -n --argjson nodes "$nodes_json" --argjson pods "$pods_json" '
    def parse_cpu($s):
      if ($s | endswith("m")) then (($s | rtrimstr("m") | tonumber) / 1000)
      else ($s | tonumber) end;
    def parse_mem($s):
      if ($s | type) == "number" then $s
      elif ($s | test("Gi$")) then (($s | rtrimstr("Gi") | tonumber) * 1073741824)
      elif ($s | test("Mi$")) then (($s | rtrimstr("Mi") | tonumber) * 1048576)
      elif ($s | test("Ki$")) then (($s | rtrimstr("Ki") | tonumber) * 1024)
      else ($s | tonumber) end;

    ($nodes | length) as $node_count |
    {
      node_count: $node_count,
      allocatable: {
        gpus: ([$nodes[].allocatable.gpu | tonumber] | add // 0),
        cpu: ([$nodes[].allocatable.cpu | parse_cpu(.)] | add // 0),
        memory: ([$nodes[].allocatable.memory | parse_mem(.)] | add // 0)
      },
      requested: {
        gpus: ([$pods[].gpu | tonumber] | add // 0),
        cpu: ([$pods[].cpu | parse_cpu(.)] | add // 0),
        memory: ([$pods[].memory | parse_mem(.)] | add // 0)
      }
    }
  ')
  headroom_json=$(_resource_python headroom "$policy_path" "$nodes_json" 2>/dev/null || echo '{"cpu":4,"memory":67108864}')
  echo "$base_json" | jq --argjson headroom "$headroom_json" '
      .headroom = {
        cpu: $headroom.cpu,
        memory: $headroom.memory
      }
      | .free = {
          gpus: (.allocatable.gpus - .requested.gpus),
          cpu: (.allocatable.cpu - .requested.cpu),
          memory: (.allocatable.memory - .requested.memory)
        }
      | .available = {
          gpus: ((.allocatable.gpus - .requested.gpus) | if . < 0 then 0 else . end),
          cpu: ((.allocatable.cpu - .requested.cpu - .headroom.cpu) | if . < 0 then 0 else . end),
          memory: ((.allocatable.memory - .requested.memory - .headroom.memory) | if . < 0 then 0 else . end)
        }
      | .utilization = {
          gpu_pct: (if .allocatable.gpus > 0 then ((.requested.gpus / .allocatable.gpus) * 100) else 0 end),
          cpu_pct: (if .allocatable.cpu > 0 then ((.requested.cpu / .allocatable.cpu) * 100) else 0 end),
          memory_pct: (if .allocatable.memory > 0 then ((.requested.memory / .allocatable.memory) * 100) else 0 end)
        }
      | def fmt_mem($b):
          if ($b >= 1073741824) then ((($b / 1073741824) * 10 | floor) / 10 | tostring) + "Gi"
          elif ($b >= 1048576) then ((($b / 1048576) | floor | tostring) + "Mi")
          else ($b | tostring) end;
        def fmt_cpu($c):
          if ($c >= 1) then (($c * 10 | floor) / 10 | tostring)
          else ($c | tostring) end;
        .allocatable.memory = fmt_mem(.allocatable.memory)
        | .requested.memory = fmt_mem(.requested.memory)
        | .free.memory = fmt_mem(.free.memory)
        | .available.memory = fmt_mem(.available.memory)
        | .allocatable.cpu = fmt_cpu(.allocatable.cpu)
        | .requested.cpu = fmt_cpu(.requested.cpu)
        | .free.cpu = fmt_cpu(.free.cpu)
        | .available.cpu = fmt_cpu(.available.cpu)
    '
}

# @function check_capacity
# Args: action (model:kimi, dev:coder, etc.). Prints JSON; exit 0 if ok.
check_capacity() {
  local action="${1:-}"
  local policy_path capacity_json
  if [[ -z "$action" ]]; then
    err "Usage: check_capacity <action>   e.g. model:kimi-test, dev:coder"
    return 1
  fi
  policy_path=$(resource_policy_path)
  capacity_json=$(get_cluster_capacity_json) || return 1
  _resource_python check "$policy_path" "$capacity_json" "$action" 2>/dev/null
}

# @function _is_helm_release_running
_is_helm_release_running() {
  local ns="$1" release="$2"
  helm list -n "$ns" -q 2>/dev/null | grep -qx "$release"
}

# @function _is_job_active
_is_job_active() {
  local job="$1"
  local ns="${NAMESPACE:-ai-inference}"
  if ! kubectl get job "$job" -n "$ns" >/dev/null 2>&1; then
    return 1
  fi
  local active
  active=$(kubectl get job "$job" -n "$ns" -o jsonpath='{.status.active}' 2>/dev/null || echo "0")
  [[ -n "$active" && "$active" -gt 0 ]]
}

# @function suggest_free_resources
# Args: action. Prints JSON array of suggestions applicable to clearing deficit.
suggest_free_resources() {
  local action="${1:-}"
  local policy_path check_json
  policy_path=$(resource_policy_path)

  check_json=$(check_capacity "$action" 2>/dev/null || true)
  if echo "$check_json" | jq -e '.ok == true' >/dev/null 2>&1; then
    echo '[]'
    return 0
  fi

  # Build suggestions from policy free_actions + live cluster state.
  python3 - "$policy_path" "$check_json" <<'PY' 2>/dev/null || echo '[]'
import json, subprocess, sys
from pathlib import Path

policy = json.loads(Path(sys.argv[1]).read_text())
check = json.loads(sys.argv[2])
actions = policy.get("free_actions", [])
out = []

def helm_running(ns, rel):
    try:
        r = subprocess.run(["helm", "list", "-n", ns, "-q"], capture_output=True, text=True, timeout=5)
        return rel in (r.stdout or "").splitlines()
    except Exception:
        return False

def job_active(job, ns="ai-inference"):
    try:
        r = subprocess.run(
            ["kubectl", "get", "job", job, "-n", ns, "-o", "jsonpath={.status.active}"],
            capture_output=True, text=True, timeout=5,
        )
        return bool(r.stdout.strip()) and int(r.stdout.strip() or 0) > 0
    except Exception:
        return False

for item in actions:
    aid = item.get("id", "")
    act = item.get("action", "")
    entry = {
        "id": aid,
        "label": item.get("label", aid),
        "action": act,
        "reversible": item.get("reversible", True),
        "impact": item.get("impact", ""),
        "applicable": False,
        "frees": {},
    }
    if act == "dev:coder":
        if helm_running("coder", "coder"):
            entry["applicable"] = True
            entry["frees"] = {"cpu": "2", "memory": "4Gi", "gpus": 0}
    elif act == "dev:kasm":
        if helm_running("kasm", "kasm"):
            entry["applicable"] = True
            entry["frees"] = {"cpu": "2", "memory": "4Gi", "gpus": 0}
    elif act.startswith("stop-job:"):
        jobs = act.split(":", 1)[1].split(",")
        active = [j for j in jobs if job_active(j.strip())]
        if active:
            entry["applicable"] = True
            entry["frees"] = {"gpus": 4 * len(active) if "ray" in act else 2, "memory": "16Gi", "gpus_note": "approx"}
    elif act == "stop-inference":
        entry["applicable"] = True
        entry["frees"] = {"gpus": "all", "memory": "all", "cpu": "all"}
    if entry["applicable"]:
        out.append(entry)

print(json.dumps(out))
PY
}

# @function _confirm_interactive
_confirm_interactive() {
  local prompt="$1"
  local expected="${2:-yes}"
  if [[ "${LAB_NON_INTERACTIVE:-}" == "1" ]]; then
    [[ "${LAB_CONFIRM_TOKEN:-}" == "$expected" ]]
    return $?
  fi
  local response
  read -r -p "$prompt " response
  [[ "$response" == "$expected" ]]
}

# @function enforce_capacity
# Args: action [--force]. Blocks start when capacity insufficient.
enforce_capacity() {
  local action="${1:-}"
  local force="${2:-}"
  local check_json ok verdict

  if [[ "$force" == "--force" ]]; then
    warn "Capacity check bypassed via --force for action: $action"
    return 0
  fi

  check_json=$(check_capacity "$action" 2>/dev/null) || true
  ok=$(echo "$check_json" | jq -r '.ok // false' 2>/dev/null)
  verdict=$(echo "$check_json" | jq -r '.verdict // unknown' 2>/dev/null)

  if [[ "$ok" == "true" ]]; then
    return 0
  fi

  warn "Insufficient resources for $action (verdict: $verdict)"
  echo "$check_json" | jq '.' 2>/dev/null || echo "$check_json"
  echo
  log "Suggestions to free resources:"
  suggest_free_resources "$action" | jq -r '.[] | "  - \(.label): \(.impact)"' 2>/dev/null || true
  echo

  if [[ "${LAB_NON_INTERACTIVE:-}" == "1" ]]; then
    err "Capacity check failed in non-interactive mode. Free resources or pass --force."
    return 1
  fi

  read -r -p "Continue anyway (may cause SSH lag or Pending pods)? [y/N] " cont
  if [[ ! "$cont" =~ ^[Yy]$ ]]; then
    log "Aborted due to insufficient capacity."
    return 1
  fi
  return 0
}

# @function print_resources_status
# Human-readable capacity report for manage.sh resources command.
print_resources_status() {
  local json
  json=$(get_cluster_capacity_json) || {
    err "Failed to collect cluster capacity"
    return 1
  }
  log "=== Cluster Resource Capacity ==="
  echo "$json" | jq -r '
    "Nodes: \(.node_count)",
    "",
    "Allocatable:",
    "  GPUs:    \(.allocatable.gpus)",
    "  CPU:     \(.allocatable.cpu | tostring) cores",
    "  Memory:  \(.allocatable.memory / 1073741824 | floor)Gi (raw)",
    "",
    "Requested (Running/Pending pods):",
    "  GPUs:    \(.requested.gpus)",
    "  CPU:     \(.requested.cpu | tostring) cores",
    "  Memory:  \(.requested.memory / 1073741824 | floor)Gi (raw)",
    "",
    "Reserved headroom (policy):",
    "  CPU:     \(.headroom.cpu) cores",
    "  Memory:  \(.headroom.memory / 1073741824 | floor)Gi (raw)",
    "",
    "Available (after requests + headroom):",
    "  GPUs:    \(.available.gpus)",
    "  CPU:     \(.available.cpu | tostring) cores",
    "  Memory:  \(.available.memory / 1073741824 | floor)Gi (raw)",
    "",
    "Utilization:",
    "  GPU:     \(.utilization.gpu_pct | floor)%",
    "  CPU:     \(.utilization.cpu_pct | floor)%",
    "  Memory:  \(.utilization.memory_pct | floor)%"
  '
}

# @function require_heavy_confirm
# Interactive or LAB_CONFIRM_TOKEN=yes for heavy models.
require_heavy_confirm() {
  local model="$1"
  local msg="${2:-Heavy workload requires confirmation.}"
  if [[ "${LAB_NON_INTERACTIVE:-}" == "1" ]]; then
    if [[ "${LAB_CONFIRM_TOKEN:-}" != "yes" ]]; then
      err "Heavy model $model requires LAB_CONFIRM_TOKEN=yes in non-interactive mode."
      return 1
    fi
    return 0
  fi
  warn "$msg"
  _confirm_interactive "Type 'yes' to confirm: " "yes"
}

# @function guard_active_job
# Returns 0 if job is not active (safe to start). Returns 1 if still active (caller should abort).
guard_active_job() {
  local job="$1"
  if _is_job_active "$job"; then
    warn "Job '$job' is still active. Stop it first: ./scripts/manage.sh stop"
    return 1
  fi
  return 0
}