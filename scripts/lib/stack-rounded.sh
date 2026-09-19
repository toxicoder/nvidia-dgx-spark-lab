#!/usr/bin/env bash
# ## 3-node rounded stack (Mode A mixed fleet vs Mode B GLM vs Mode C DeepSeek-V4.1-Flash)
#
# LiteLLM aliases, Mode A/B/C mutual exclusion, and per-fabric interconnect doctor.
# Heavy Jobs stay manual-start. LiteLLM is a management Deployment.

# @function rounded_mode_a_jobs
# Prints Mode A inference Job names (one per line). Used by mutual exclusion.
rounded_mode_a_jobs() {
  printf '%s\n' \
    qwen3.6-35b-a3b-nvfp4 \
    qwen3.8-flash-next-nvfp4 \
    medgemma-27b \
    qwen3.6-27b-nvfp4 \
    medgemma-4b
}

# @function rounded_mode_b_jobs
# Prints Mode B inference Job names (one per line).
rounded_mode_b_jobs() {
  printf '%s\n' \
    glm-5.3-flash \
    glm-5.3-flash-worker-1 \
    glm-5.3-flash-worker-2
}

# @function rounded_mode_c_jobs
# Prints Mode C inference Job names (one per line).
rounded_mode_c_jobs() {
  printf '%s\n' \
    deepseek-v4.1-flash \
    deepseek-v4.1-flash-worker-1 \
    deepseek-v4.1-flash-worker-2
}

# @function _rounded_active_from_list
# Echoes the first active Job name from a newline-separated list, or empty.
_rounded_active_from_list() {
  local job
  while IFS= read -r job; do
    [[ -z $job ]] && continue
    if _is_job_active "$job"; then
      echo "$job"
      return 0
    fi
  done
  return 0
}

# @function guard_rounded_mode_b_idle
# Fail if any Mode B (frontier) Job is active.
guard_rounded_mode_b_idle() {
  local active
  active=$(_rounded_active_from_list <<<"$(rounded_mode_b_jobs)")
  if [[ -n $active ]]; then
    err "Mode B frontier Job '$active' is active. Stop it first: ./scripts/manage.sh stop-glm53-flash"
    return 1
  fi
  return 0
}

# @function guard_rounded_mode_a_idle
# Fail if any Mode A (rounded daily) Job is active.
guard_rounded_mode_a_idle() {
  local active
  active=$(_rounded_active_from_list <<<"$(rounded_mode_a_jobs)")
  if [[ -n $active ]]; then
    err "Mode A rounded Job '$active' is active. Stop it first: ./scripts/manage.sh stop-stack-rounded"
    return 1
  fi
  return 0
}

# @function guard_rounded_mode_c_idle
# Fail if any Mode C (DeepSeek-V4.1-Flash) Job is active.
guard_rounded_mode_c_idle() {
  local active
  active=$(_rounded_active_from_list <<<"$(rounded_mode_c_jobs)")
  if [[ -n $active ]]; then
    err "Mode C DeepSeek-V4.1-Flash Job '$active' is active. Stop it first: ./scripts/manage.sh stop-dsv41-flash"
    return 1
  fi
  return 0
}

# @function lab_mgmt_ifname
# Management / NCCL OOB interface. Default enP7s7; override LAB_MGMT_IFNAME.
# Does not hard-fail if the live name differs — callers warn via doctor_fabric.
lab_mgmt_ifname() {
  echo "${LAB_MGMT_IFNAME:-enP7s7}"
}

# @function doctor_fabric
# Warn if the lab.yaml fabric looks unavailable. Does not hard-fail on iface names.
# @command doctor-fabric
doctor_fabric() {
  local n nodes mgmt fabric node_count facts lab_file min_n max_n
  mgmt=$(lab_mgmt_ifname)
  fabric=""
  node_count=""
  if declare -F topology_facts >/dev/null 2>&1 && declare -F lab_topology_path >/dev/null 2>&1; then
    lab_file="$(lab_topology_path)"
    if [[ -f $lab_file ]]; then
      facts="$(topology_facts 2>/dev/null || true)"
      fabric=$(printf '%s\n' "$facts" | awk -F= '$1 == "fabric" { print $2; exit }')
      node_count=$(printf '%s\n' "$facts" | awk -F= '$1 == "node_count" { print $2; exit }')
    fi
  fi
  fabric="${fabric:-unknown}"

  log "=== Fabric doctor (${fabric}) ==="
  case "$fabric" in
    none)
      warn "1-node lab: no inter-node NCCL. Ignore highspeed inventory. Local SHM/P2P only."
      ;;
    pair)
      warn "2-node pair: one 200 Gb/s QSFP cable. Pair NCCL is enp1s0f0np0,enp1s0f1np1 + mlx5_0,mlx5_1 (confirm ibdev2netdev)."
      warn "Each QSFP cage can appear as two netdevs; one cable brings one cage up."
      ;;
    ring)
      warn "Cabling: Node1 Port0→Node2 Port1; Node2 Port0→Node3 Port1; Node3 Port0→Node1 Port1."
      warn "Triangle mesh at 200 Gb/s per pair. Not NVLink. Not the 2-node pair NCCL vars."
      log "NCCL OOB/Gloo on mgmt iface '${mgmt}' (override LAB_MGMT_IFNAME)."
      log "NCCL_IB_HCA default: rocep1s0f0,roceP2p1s0f0,rocep1s0f1,roceP2p1s0f1 (override LAB_NCCL_IB_HCA)."
      ;;
    switch)
      warn "4/5-node CRS804 switch: one RoCE link per node (generated netplan 192.168.110–114, MTU 9000)."
      warn "NCCL_SOCKET_IFNAME stays the management NIC ('${mgmt}'); payload on a single RoCE HCA. Not the pair env."
      ;;
    *)
      warn "lab.yaml fabric is '${fabric}'. See docs/concepts/interconnect-nccl.mdx."
      ;;
  esac
  log "Confirm live names with ibdev2netdev on every node. MTU 9000 on CX-7."
  log "Optional livelock fallback (not default): NCCL_NET_GDR_LEVEL=0"

  nodes=$(kubectl get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ' || echo 0)
  n=${nodes:-0}
  min_n=1
  max_n=5
  case "$fabric" in
    none)
      min_n=1
      max_n=1
      ;;
    pair)
      min_n=2
      max_n=2
      ;;
    ring)
      min_n=3
      max_n=3
      ;;
    switch)
      min_n=4
      max_n=5
      ;;
  esac
  if [[ $n -lt $min_n ]]; then
    warn "Only ${n} Kubernetes node(s) visible; fabric ${fabric} expects ${min_n}-${max_n}${node_count:+ (lab.yaml node_count=${node_count})}."
    return 1
  fi
  log "Kubernetes nodes: ${n} (ok for fabric ${fabric})."
  warn "This doctor cannot run ibdev2netdev inside the cluster. If NCCL hangs, check polarity and that OOB is on 10GbE not QSFP."
  return 0
}

# @function _rounded_node_count
_rounded_node_count() {
  kubectl get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ' || echo 0
}

# @function _require_three_nodes
# Require ≥3 nodes for rounded / Mode B / Mode C starts.
_require_three_nodes() {
  local n
  n=$(_rounded_node_count)
  if [[ ${n:-0} -ge 3 ]]; then
    return 0
  fi
  if [[ ${LAB_NON_INTERACTIVE:-} == "1" ]]; then
    err "Need ≥3 Kubernetes nodes for this stack (got ${n:-0})."
    return 1
  fi
  warn "Only ${n:-0} node(s) detected; 3-node stack expected."
  read -r -p "Continue anyway? [y/N] " cont
  if [[ ! $cont =~ ^[Yy]$ ]]; then
    log "Aborted."
    exit 0
  fi
}

# @function litellm_overlay_for_backend
# Prints the kustomize path for a LiteLLM backend id.
# @param $1  Backend id (rounded | qwen3.8-27b-nvfp4 | qwen3.8-flash-next-nvfp4 | glm-5.3-flash | deepseek-v4.1-flash).
litellm_overlay_for_backend() {
  case "$1" in
    rounded | "") echo "${REPO_ROOT}/k8s/workloads/litellm" ;;
    qwen3.8-27b-nvfp4) echo "${REPO_ROOT}/k8s/overlays/litellm-qwen38-27b" ;;
    qwen3.8-flash-next-nvfp4) echo "${REPO_ROOT}/k8s/overlays/litellm-qwen38-flash-next" ;;
    glm-5.3-flash) echo "${REPO_ROOT}/k8s/overlays/litellm-glm53-flash" ;;
    deepseek-v4.1-flash) echo "${REPO_ROOT}/k8s/overlays/litellm-dsv41-flash" ;;
    *) echo "" ;;
  esac
}

# @function args_have_with_litellm
# Returns 0 if --with-litellm is among the given args.
args_have_with_litellm() {
  local arg
  for arg in "$@"; do
    if [[ $arg == --with-litellm ]]; then
      return 0
    fi
  done
  return 1
}

# @function maybe_attach_litellm
# Start LiteLLM with the given backend profile when --with-litellm is present.
# @param $1  Backend id. Remaining args are scanned for --with-litellm.
maybe_attach_litellm() {
  local backend="$1"
  shift
  if args_have_with_litellm "$@"; then
    start_litellm --backend "$backend"
  fi
}

# @function start_litellm
# Apply LiteLLM kustomize (management Deployment). Always is OK; no GPU.
# Optional --backend selects a single-stack profile overlay; default is rounded.
# @command start-litellm
start_litellm() {
  local backend="rounded"
  local force_flag=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --backend)
        backend="${2:-}"
        if [[ -z $backend ]]; then
          err "start-litellm --backend requires an id (rounded | qwen3.8-27b-nvfp4 | qwen3.8-flash-next-nvfp4 | glm-5.3-flash | deepseek-v4.1-flash)."
          return 1
        fi
        shift 2
        ;;
      --force)
        force_flag="--force"
        shift
        ;;
      --with-litellm)
        shift
        ;;
      *)
        err "Unknown LiteLLM backend: $1. Use rounded | qwen3.8-27b-nvfp4 | qwen3.8-flash-next-nvfp4 | glm-5.3-flash | deepseek-v4.1-flash"
        return 1
        ;;
    esac
  done

  local path
  path=$(litellm_overlay_for_backend "$backend")
  if [[ -z $path ]]; then
    err "Unknown LiteLLM backend: ${backend}. Use rounded | qwen3.8-27b-nvfp4 | qwen3.8-flash-next-nvfp4 | glm-5.3-flash | deepseek-v4.1-flash"
    return 1
  fi

  log "Starting LiteLLM proxy (management, LAN only, backend=${backend})..."
  ensure_namespace
  if [[ $force_flag != "--force" ]]; then
    enforce_capacity "model:litellm" || exit 1
  fi
  # Profiles live under k8s/workloads/litellm/files/; overlays must load them.
  kubectl apply -k "$path" --load-restrictor=LoadRestrictionsNone -n "${NAMESPACE}"
  kubectl rollout restart deployment/litellm -n "${NAMESPACE}" 2>/dev/null || true
  log "LiteLLM submitted (${backend}). ClusterIP: http://litellm.${NAMESPACE}.svc.cluster.local:4000/v1"
  log "LAN NodePort: 32040 on spark0. lab-auto points at this backend. Backends may 503; the proxy must stay up."
}

# @function stop_litellm
# @command stop-litellm
stop_litellm() {
  log "Stopping LiteLLM..."
  kubectl delete deployment litellm -n "${NAMESPACE}" --ignore-not-found=true --grace-period=30 || true
  kubectl delete svc litellm -n "${NAMESPACE}" --ignore-not-found=true || true
  log "LiteLLM stopped (ConfigMap retained until namespace delete)."
}

# @function start_qwen38_27b
# Exclusive 1-node Qwen3.8-27B NVFP4. Optional --with-litellm attaches the matching profile.
# @command start-qwen38-27b
start_qwen38_27b() {
  warn "=== QWEN 3.8 27B NVFP4 (dense, exclusive, 1-node) ==="
  warn "unsloth/Qwen3.8-27B-NVFP4 · MTP 3 · CUTE_DSL_ARCH=sm_121a · util 0.72 · ~48 Gi"
  warn "Refuses Mode B GLM-5.3-Flash and Mode C DeepSeek-V4.1-Flash."
  guard_rounded_mode_b_idle || exit 1
  guard_rounded_mode_c_idle || exit 1
  start_nemotron_llm "qwen3.8-27b-nvfp4" "Qwen 3.8 27B NVFP4"
  maybe_attach_litellm "qwen3.8-27b-nvfp4" "$@"
}

# @function stop_qwen38_27b
# @command stop-qwen38-27b
stop_qwen38_27b() {
  log "Stopping Qwen3.8-27B..."
  stop_inference_job "qwen3.8-27b-nvfp4"
  log "Qwen3.8-27B stopped. LiteLLM left running unless you run stop-litellm."
}

# @function start_qwen38_flash_next
# @command start-qwen38-flash-next
start_qwen38_flash_next() {
  warn "=== Qwen3.8-Flash-Next NVFP4 (spark1, PLE mmap, TP=1) ==="
  warn "Refuses Mode B GLM-5.3-Flash and Mode C DeepSeek-V4.1-Flash."
  guard_rounded_mode_b_idle || exit 1
  guard_rounded_mode_c_idle || exit 1
  start_nemotron_llm "qwen3.8-flash-next-nvfp4" "Qwen3.8-Flash-Next NVFP4"
  maybe_attach_litellm "qwen3.8-flash-next-nvfp4" "$@"
}

# @function start_medgemma
# spark2 MedGemma 27B medical lane.
# @command start-medgemma
start_medgemma() {
  warn "=== MedGemma 27B (spark2). Not a medical device. HAI-DEF. ==="
  start_nemotron_llm "medgemma-27b" "MedGemma 27B multimodal"
}

# @function stop_medgemma
# @command stop-medgemma
stop_medgemma() {
  log "Stopping MedGemma..."
  stop_inference_job "medgemma-27b"
  stop_inference_job "medgemma-4b"
  log "MedGemma stopped."
}

# @function start_stack_rounded
# Mode A daily fleet + LiteLLM. Refuses Mode B.
# @command start-stack-rounded
start_stack_rounded() {
  local quality=0
  local overlay stack_id
  if [[ ${1:-} == "--quality" ]]; then
    quality=1
  fi

  warn "=== ROUNDED STACK Mode A (3× Spark, TP=1 per node, LiteLLM) ==="
  warn "spark0: qwen3.6-35b-a3b · spark1: qwen3.8-flash-next · spark2: medgemma-27b (or 27B quality)"
  warn "QSFP ring is unused for tokens in Mode A. Exclusive with start-glm53-flash and start-dsv41-flash."

  if [[ ${LAB_NON_INTERACTIVE:-} != "1" ]]; then
    echo
    read -r -p "Start rounded Mode A stack? [yes/NO] " response
    if [[ ! $response =~ ^[Yy][Ee][Ss]$ ]]; then
      log "Aborted."
      exit 0
    fi
  else
    require_heavy_confirm "rounded-spark-3" "Rounded stack requires confirmation." || exit 1
  fi

  guard_rounded_mode_b_idle || exit 1
  guard_rounded_mode_c_idle || exit 1
  _require_three_nodes || exit 1
  ensure_namespace

  if [[ $quality -eq 1 ]]; then
    stack_id="rounded-spark-3-quality"
    overlay="${REPO_ROOT}/k8s/overlays/rounded-stack-quality"
    warn "--quality: spark2 runs qwen3.6-27b-nvfp4. lab-med falls back to lab-smart (not MedGemma)."
  else
    stack_id="rounded-spark-3"
    overlay="${REPO_ROOT}/k8s/overlays/rounded-stack"
  fi

  enforce_capacity "stack:${stack_id}" || exit 1
  guard_active_job "qwen3.6-35b-a3b-nvfp4" || exit 1
  guard_active_job "qwen3.8-flash-next-nvfp4" || exit 1
  if [[ $quality -eq 1 ]]; then
    guard_active_job "qwen3.6-27b-nvfp4" || exit 1
  else
    guard_active_job "medgemma-27b" || exit 1
  fi

  log "Applying overlay ${overlay}"
  kubectl apply -k "$overlay" -n "${NAMESPACE}"
  log "Rounded stack submitted. LiteLLM: http://litellm.${NAMESPACE}.svc.cluster.local:4000/v1"
  log "Aliases: lab-fast/lab-code, lab-smart/lab-agent, lab-med, lab-auto. Open WebUI model URL = LiteLLM."
  wait_for_job "qwen3.6-35b-a3b-nvfp4" || true
  wait_for_job "qwen3.8-flash-next-nvfp4" || true
  if [[ $quality -eq 1 ]]; then
    wait_for_job "qwen3.6-27b-nvfp4" || true
  else
    wait_for_job "medgemma-27b" || true
  fi
}

# @function stop_stack_rounded
# Stop Mode A inference Jobs. Leaves LiteLLM up (backends may 503).
# @command stop-stack-rounded
stop_stack_rounded() {
  log "Stopping rounded Mode A inference Jobs (LiteLLM left running)..."
  stop_inference_job "qwen3.6-35b-a3b-nvfp4"
  stop_inference_job "qwen3.8-flash-next-nvfp4"
  stop_inference_job "medgemma-27b"
  stop_inference_job "qwen3.6-27b-nvfp4"
  stop_inference_job "medgemma-4b"
  log "Rounded Mode A Jobs stopped. LiteLLM still up unless you run stop-litellm."
}

# @function start_glm53_flash
# Exclusive Mode B TP=3 across the QSFP ring.
# @command start-glm53-flash
start_glm53_flash() {
  warn "=== GLM-5.3-Flash NVFP4 TP=3 (Mode B, USES THE RING) ==="
  warn "Exclusive: refuses Mode A rounded Jobs and Mode C DeepSeek-V4.1-Flash. hostNetwork + 3-node NCCL (not 2-node pair vars)."
  warn "Image glm53-flash-tp3:local must be built on Spark (see k8s/workloads/glm-5.3-flash/README.md)."

  if [[ ${LAB_NON_INTERACTIVE:-} != "1" ]]; then
    echo
    read -r -p "Start GLM-5.3-Flash TP=3? [yes/NO] " response
    if [[ ! $response =~ ^[Yy][Ee][Ss]$ ]]; then
      log "Aborted."
      exit 0
    fi
  else
    require_heavy_confirm "glm-5.3-flash" "Mode B frontier requires confirmation." || exit 1
  fi

  guard_rounded_mode_a_idle || exit 1
  guard_rounded_mode_c_idle || exit 1
  doctor_fabric || warn "Fabric doctor warned; continuing only if you understand the ring is required."
  _require_three_nodes || exit 1
  ensure_namespace
  guard_active_job "glm-5.3-flash" || exit 1
  guard_active_job "glm-5.3-flash-worker-1" || exit 1
  guard_active_job "glm-5.3-flash-worker-2" || exit 1
  enforce_capacity "stack:glm53-flash-spark-3" || exit 1

  log "Starting TP=3 workers then leader..."
  start_workload "glm-5.3-flash-worker-1" "--force"
  start_workload "glm-5.3-flash-worker-2" "--force"
  start_workload "glm-5.3-flash" "--force"
  wait_for_job "glm-5.3-flash" || true
  log "lab-frontier = glm-5.3-flash. lab-med falls back to lab-frontier with an explicit general-model prompt."
  maybe_attach_litellm "glm-5.3-flash" "$@"
  if ! args_have_with_litellm "$@"; then
    log "LiteLLM should already be up, or run: ./scripts/manage.sh start-litellm --backend glm-5.3-flash"
  fi
}

# @function stop_glm53_flash
# @command stop-glm53-flash
stop_glm53_flash() {
  log "Stopping GLM-5.3-Flash TP=3..."
  stop_inference_job "glm-5.3-flash"
  stop_inference_job "glm-5.3-flash-worker-1"
  stop_inference_job "glm-5.3-flash-worker-2"
  log "Mode B stopped."
}

# @function start_dsv41_flash
# Exclusive Mode C TP=3 DeepSeek-V4.1-Flash across the QSFP ring.
# @command start-dsv41-flash
start_dsv41_flash() {
  warn "=== DeepSeek-V4.1-Flash official MXFP4 TP=3 (Mode C, USES THE RING) ==="
  warn "Exclusive: refuses Mode A and Mode B. Official checkpoint only. Engram on NVMe."
  warn "Image dsv41-flash-tp3:local must be built on Spark (see k8s/workloads/deepseek-v4.1-flash/README.md)."
  warn "mem-fraction-static 0.95 is exclusive Mode C (MiaAI measured load). Hang line is MemAvailable ~8–12 GiB."
  warn "If MemAvailable drops below 8 GiB on any rank: ./scripts/manage.sh stop-dsv41-flash immediately. Do not generate load from spark0."

  if [[ ${LAB_NON_INTERACTIVE:-} != "1" ]]; then
    echo
    read -r -p "Start DeepSeek-V4.1-Flash TP=3? [yes/NO] " response
    if [[ ! $response =~ ^[Yy][Ee][Ss]$ ]]; then
      log "Aborted."
      exit 0
    fi
  else
    require_heavy_confirm "deepseek-v4.1-flash" "Mode C frontier requires confirmation." || exit 1
  fi

  guard_rounded_mode_a_idle || exit 1
  guard_rounded_mode_b_idle || exit 1
  doctor_fabric || warn "Fabric doctor warned; continuing only if you understand the ring is required."
  _require_three_nodes || exit 1
  ensure_namespace
  guard_active_job "deepseek-v4.1-flash" || exit 1
  guard_active_job "deepseek-v4.1-flash-worker-1" || exit 1
  guard_active_job "deepseek-v4.1-flash-worker-2" || exit 1
  enforce_capacity "stack:dsv41-flash-spark-3" || exit 1

  log "Starting TP=3 workers then leader..."
  start_workload "deepseek-v4.1-flash-worker-1" "--force"
  start_workload "deepseek-v4.1-flash-worker-2" "--force"
  start_workload "deepseek-v4.1-flash" "--force"
  wait_for_job "deepseek-v4.1-flash" || true
  log "lab-frontier-ds = deepseek-v4.1-flash. lab-frontier stays GLM. lab-med never uses the DeepSeek cloud API."
  log "Soak: MemAvailable ≥ 8 GiB on every rank or run stop-dsv41-flash."
  maybe_attach_litellm "deepseek-v4.1-flash" "$@"
  if ! args_have_with_litellm "$@"; then
    log "LiteLLM: ./scripts/manage.sh start-litellm --backend deepseek-v4.1-flash"
  fi
}

# @function stop_dsv41_flash
# @command stop-dsv41-flash
stop_dsv41_flash() {
  log "Stopping DeepSeek-V4.1-Flash TP=3..."
  stop_inference_job "deepseek-v4.1-flash"
  stop_inference_job "deepseek-v4.1-flash-worker-1"
  stop_inference_job "deepseek-v4.1-flash-worker-2"
  log "Mode C stopped."
}

# @function status_stack
# Mode A/B/C Jobs, LiteLLM, aliases, fabric hint.
# @command status-stack
status_stack() {
  log "=== Rounded stack status (namespace ${NAMESPACE}) ==="
  kubectl get jobs -n "${NAMESPACE}" -l family=qwen3.6 -o wide 2>/dev/null || true
  kubectl get jobs -n "${NAMESPACE}" -l family=qwen3.8 -o wide 2>/dev/null || true
  kubectl get jobs -n "${NAMESPACE}" -l family=medgemma -o wide 2>/dev/null || true
  kubectl get jobs -n "${NAMESPACE}" -l family=glm-5.3 -o wide 2>/dev/null || true
  kubectl get jobs -n "${NAMESPACE}" -l family=deepseek-v4.1 -o wide 2>/dev/null || true
  kubectl get deploy,svc -n "${NAMESPACE}" litellm 2>/dev/null || true
  local ll_backend
  ll_backend=$(kubectl get deploy litellm -n "${NAMESPACE}" -o jsonpath='{.metadata.labels.lab\.litellm-backend}' 2>/dev/null || true)
  log "LiteLLM backend profile: ${ll_backend:-unknown (start-litellm --backend …)}"
  echo
  log "Aliases (rounded profile): lab-fast/lab-code → 35b-a3b · lab-smart/lab-agent → flash-next · lab-med → medgemma · lab-frontier → glm-5.3-flash · lab-frontier-ds → deepseek-v4.1-flash · lab-auto → fast then smart"
  log "Exclusive profiles expose lab-auto plus one canonical alias. Open WebUI default model is lab-auto."
  log "Open WebUI model base URL: http://litellm.${NAMESPACE}.svc.cluster.local:4000/v1 (or spark0:32040)"
  log "Raw bypass: kubectl port-forward -n ${NAMESPACE} svc/<job> 8000:8000"
  doctor_fabric || true
}
