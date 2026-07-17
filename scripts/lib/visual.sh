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
  guard_active_visual "$model" || exit 1

  apply_visual_kustomize "$kdir"
  log "${model} submitted. Monitor: kubectl get pods -n ${NAMESPACE} -l app=${model}"
  log "UI: kubectl -n ${NAMESPACE} port-forward svc/${model} 8188:8188"
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
