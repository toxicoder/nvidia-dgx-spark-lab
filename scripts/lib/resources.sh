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
  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/resource_policy.py" "$@"
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
  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/resources_suggest_free_resources.py" "$policy_path" "$check_json"
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