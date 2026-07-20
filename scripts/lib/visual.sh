#!/usr/bin/env bash
# ## Visual generative AI (ComfyUI / FLUX / LTX) helpers
#
# Lifecycle for DGX Spark visual workloads: comfy-base, flux-*, ltx-*, flux-to-ltx.
# Heavy GPU + unified-memory consumers — manual start only, capacity-gated.
#
# Safety:
#   - One visual Deployment at a time (label workload=visual)
#   - enforce_capacity before apply
#   - Heavy confirmation for GPU visual starts
#   - Never auto-starts on reboot

# @function get_visual_kustomize_dir
# Returns relative kustomize path for a visual model id, or empty if unknown.
get_visual_kustomize_dir() {
  case "$1" in
    comfy-base) echo "k8s/workloads/comfy-base" ;;
    flux-fast) echo "k8s/workloads/comfy-visual/flux/fast" ;;
    flux-quality) echo "k8s/workloads/comfy-visual/flux/quality" ;;
    ltx-balanced) echo "k8s/workloads/comfy-visual/ltx/balanced" ;;
    ltx-quality) echo "k8s/workloads/comfy-visual/ltx/quality" ;;
    flux-to-ltx) echo "k8s/workloads/comfy-visual/flux-to-ltx" ;;
    *) echo "" ;;
  esac
}

# @function guard_active_visual
# Fail if another visual Deployment is already present (exclusive GPU policy).
# @param $1  Model id being started (allowed if it is the only match).
guard_active_visual() {
  local want="${1:-}"
  local names
  names=$(kubectl get deploy -n "${NAMESPACE}" -l workload=visual \
    -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null || true)
  if [[ -z "${names//[$'\n']/}" ]]; then
    return 0
  fi
  local other=""
  while IFS= read -r n; do
    [[ -z "$n" ]] && continue
    if [[ "$n" != "$want" ]]; then
      other="${other}${n} "
    fi
  done <<< "$names"
  if [[ -n "${other// /}" ]]; then
    err "Another visual workload is active: ${other}"
    err "Stop it first: ./scripts/manage.sh stop-visual  (or stop-comfy-base)"
    return 1
  fi
  return 0
}

# @function apply_visual_kustomize
# Apply a visual kustomize directory under REPO_ROOT.
# @param $1  Relative directory path
apply_visual_kustomize() {
  local rel="$1"
  local path="${REPO_ROOT}/${rel}"
  if [[ ! -d "$path" ]]; then
    err "Visual workload path missing: ${rel}"
    exit 1
  fi
  ensure_namespace
  log "Applying visual kustomize: ${rel}"
  kubectl apply -k "${path}" -n "${NAMESPACE}"
}

# @function check_visual_unified_memory
# Pre-flight: warn/fail if cluster allocatable memory looks too low for model request.
# Uses resource-policy request memory; fails only when allocatable < request (strict).
# @param $1  Model id
check_visual_unified_memory() {
  local model="$1"
  local policy_path req_mem alloc_sum
  policy_path=$(resource_policy_path 2>/dev/null || echo "${REPO_ROOT}/config/resource-policy.json")
  req_mem=$(python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/visual_check_visual_unified_memory.py" "$policy_path" "$model" 2>/dev/null || echo "")
  if [[ -z "$req_mem" ]]; then
    warn "No policy memory for ${model}; skipping unified-memory preflight"
    return 0
  fi
  # Sum allocatable memory across nodes (Ki from kubectl).
  alloc_sum=$(kubectl get nodes -o json 2>/dev/null | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    print(0)
    raise SystemExit
total = 0
for n in data.get("items", []):
    mem = n.get("status", {}).get("allocatable", {}).get("memory", "0")
    if mem.endswith("Ki"):
        total += int(mem[:-2]) * 1024
    elif mem.endswith("Mi"):
        total += int(mem[:-2]) * 1024**2
    elif mem.endswith("Gi"):
        total += int(mem[:-2]) * 1024**3
    else:
        try:
            total += int(mem)
        except Exception:
            pass
print(total)
' 2>/dev/null || echo 0)
  if [[ "${alloc_sum}" == "0" || -z "${alloc_sum}" ]]; then
    warn "Could not read node allocatable memory; continuing (capacity gate still applies)"
    return 0
  fi
  local need_bytes
  need_bytes=$(python3 -c "
m='${req_mem}'
if m.endswith('Gi'):
    print(int(float(m[:-2])*1024**3))
elif m.endswith('Mi'):
    print(int(float(m[:-2])*1024**2))
else:
    print(0)
")
  if [[ "${need_bytes}" -gt 0 && "${alloc_sum}" -lt "${need_bytes}" ]]; then
    err "Unified-memory preflight failed: need ~${req_mem} but cluster allocatable is lower"
    err "Stop other GPU/memory heavy workloads and retry."
    return 1
  fi
  log "Unified-memory preflight OK for ${model} (request ${req_mem})"
  return 0
}

# @function check_visual_weights_hint
# Non-fatal warn if common Comfy model dirs look empty.
check_visual_weights_hint() {
  local models_dir="${MODELS_DIR:-/mnt/models}"
  if [[ ! -d "${models_dir}/comfy" ]]; then
    warn "Models dir ${models_dir}/comfy not found on this host (downloads may be on Spark nodes only)."
    warn "On the Spark node: bazelisk run //scripts:run-utility -- download-flux status"
    return 0
  fi
  return 0
}

# @function start_visual_workload
# Generic visual starter: confirm (if heavy) + capacity + exclusivity + apply -k.
# @param $1  Model id (policy key)
# @param $2  Optional human label
start_visual_workload() {
  local model="$1"
  local label="${2:-$model}"
  local kdir force_flag="${3:-}"

  kdir=$(get_visual_kustomize_dir "$model")
  if [[ -z "$kdir" ]]; then
    err "Unknown visual model: $model"
    exit 1
  fi

  warn "=== VISUAL WORKLOAD: ${label} ==="
  warn "ComfyUI on DGX Spark (1 GPU, large unified memory). Exclusive with other visual pods."
  warn "Cold start may take 10–30+ minutes on first PVC install."

  if [[ "${LAB_NON_INTERACTIVE:-}" != "1" ]]; then
    echo
    read -r -p "Start visual workload ${label}? [yes/NO] " response
    if [[ ! "$response" =~ ^[Yy][Ee][Ss]$ ]]; then
      log "Aborted by user."
      exit 0
    fi
  else
    require_heavy_confirm "$model" "Visual workload requires confirmation." || exit 1
  fi

  if [[ "$force_flag" != "--force" ]]; then
    enforce_capacity "model:${model}" || exit 1
  fi
  check_visual_unified_memory "$model" || exit 1
  check_visual_weights_hint || true
  guard_active_visual "$model" || exit 1

  apply_visual_kustomize "$kdir"
  log "${model} submitted. Monitor: kubectl get pods -n ${NAMESPACE} -l app=${model}"
  log "UI: kubectl -n ${NAMESPACE} port-forward svc/${model} 8188:8188"
}

# @function start_flux_fast
# @command start-flux-fast
start_flux_fast() {
  start_visual_workload "flux-fast" "FLUX.2 Klein 9B NVFP4 + Nunchaku (fast)"
}

# @function start_flux_quality
# @command start-flux-quality
start_flux_quality() {
  start_visual_workload "flux-quality" "FLUX.2 Dev FP8 (quality)"
}

# @function start_ltx_balanced
# @command start-ltx-balanced
start_ltx_balanced() {
  start_visual_workload "ltx-balanced" "LTX-2.3 distilled FP8 (balanced video)"
}

# @function start_ltx_quality
# @command start-ltx-quality
start_ltx_quality() {
  start_visual_workload "ltx-quality" "LTX-2.3 BF16 distilled (quality video)"
}

# @function start_flux_to_ltx
# @command start-flux-to-ltx
start_flux_to_ltx() {
  start_visual_workload "flux-to-ltx" "Flux→LTX T2I→I2V+audio pipeline (90Gi)"
}

# @function start_comfy_base
# Start the shared ComfyUI base runtime.
# @command start-comfy-base
start_comfy_base() {
  start_visual_workload "comfy-base" "ComfyUI base (Spark patches)"
}

# @function stop_comfy_base
# Stop comfy-base Deployment (keeps PVC).
# @command stop-comfy-base
stop_comfy_base() {
  log "Stopping comfy-base deployment..."
  kubectl delete deployment comfy-base -n "${NAMESPACE}" --ignore-not-found=true --grace-period=30 || true
  # Service can remain; recreate is cheap. Keep PVC for state.
  log "comfy-base stopped (PVC comfy-state retained)."
}

# @function stop_visual
# Stop all Deployments labeled workload=visual.
# @command stop-visual
stop_visual() {
  log "Stopping all visual workloads (label workload=visual)..."
  local names
  names=$(kubectl get deploy -n "${NAMESPACE}" -l workload=visual \
    -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null || true)
  if [[ -z "${names//[$'\n']/}" ]]; then
    log "No visual Deployments found."
    return 0
  fi
  while IFS= read -r n; do
    [[ -z "$n" ]] && continue
    kubectl delete deployment "$n" -n "${NAMESPACE}" --ignore-not-found=true --grace-period=30 || true
  done <<< "$names"
  # Common visual services (best-effort).
  kubectl delete svc -n "${NAMESPACE}" -l workload=visual --ignore-not-found=true || true
  log "Visual workloads stopped (PVCs retained)."
}

# @function status_visual
# Print visual Deployments / pods / services.
# @command status-visual
status_visual() {
  log "Visual workloads in namespace ${NAMESPACE}:"
  kubectl get deploy,pods,svc -n "${NAMESPACE}" -l workload=visual -o wide 2>/dev/null || \
    kubectl get deploy,pods,svc -n "${NAMESPACE}" 2>/dev/null | grep -E 'comfy|flux|ltx|NAME' || true
}
