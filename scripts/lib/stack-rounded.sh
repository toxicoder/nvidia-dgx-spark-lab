#!/usr/bin/env bash
# ## 3-node rounded stack (Mode A mixed fleet vs Mode B GLM-5.3-Flash TP=3)
#
# LiteLLM aliases, Mode A/B mutual exclusion, and QSFP-ring fabric doctor.
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

# @function lab_mgmt_ifname
# Management / NCCL OOB interface. Default enP7s7; override LAB_MGMT_IFNAME.
# Does not hard-fail if the live name differs — callers warn via doctor_fabric.
lab_mgmt_ifname() {
  echo "${LAB_MGMT_IFNAME:-enP7s7}"
}

# @function doctor_fabric
# Warn if the 3-node QSFP ring looks unavailable. Does not hard-fail on iface names.
# @command doctor-fabric
doctor_fabric() {
  local n nodes mgmt
  mgmt=$(lab_mgmt_ifname)
  log "=== Fabric doctor (3-node QSFP ring) ==="
  warn "Cabling: Node1 Port0→Node2 Port1; Node2 Port0→Node3 Port1; Node3 Port0→Node1 Port1."
  warn "Triangle mesh at 200 Gb/s per pair. Not NVLink. Not the 2-node dual-400G pair vars."
  log "NCCL OOB/Gloo on mgmt iface '${mgmt}' (override LAB_MGMT_IFNAME)."
  log "NCCL_IB_HCA default: rocep1s0f0,roceP2p1s0f0,rocep1s0f1,roceP2p1s0f1 (override LAB_NCCL_IB_HCA)."
  log "Confirm live names with ibdev2netdev on every node. MTU 9000 on CX-7."
  log "Optional livelock fallback (not default): NCCL_NET_GDR_LEVEL=0"

  nodes=$(kubectl get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ' || echo 0)
  n=${nodes:-0}
  if [[ $n -lt 3 ]]; then
    warn "Only ${n} Kubernetes node(s) visible; Mode B TP=3 expects spark0+spark1+spark2."
    return 1
  fi
  log "Kubernetes nodes: ${n} (ok for a 3-node ring)."
  warn "This doctor cannot run ibdev2netdev inside the cluster. If NCCL hangs, check Port0/Port1 polarity and that OOB is on 10GbE not QSFP."
  return 0
}

# @function _rounded_node_count
_rounded_node_count() {
  kubectl get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ' || echo 0
}

# @function _require_three_nodes
# Require ≥3 nodes for rounded / Mode B starts.
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

# @function start_litellm
# Apply LiteLLM kustomize (management Deployment). Always is OK; no GPU.
# @command start-litellm
start_litellm() {
  local path="${REPO_ROOT}/k8s/workloads/litellm"
  log "Starting LiteLLM proxy (management, LAN only)..."
  ensure_namespace
  if [[ ${1:-} != "--force" ]]; then
    enforce_capacity "model:litellm" || exit 1
  fi
  kubectl apply -k "$path" -n "${NAMESPACE}"
  log "LiteLLM submitted. ClusterIP: http://litellm.${NAMESPACE}.svc.cluster.local:4000/v1"
  log "LAN NodePort: 32040 on spark0. Backends may 503; the proxy must stay up."
}

# @function stop_litellm
# @command stop-litellm
stop_litellm() {
  log "Stopping LiteLLM..."
  kubectl delete deployment litellm -n "${NAMESPACE}" --ignore-not-found=true --grace-period=30 || true
  kubectl delete svc litellm -n "${NAMESPACE}" --ignore-not-found=true || true
  log "LiteLLM stopped (ConfigMap retained until namespace delete)."
}

# @function start_qwen38_flash_next
# @command start-qwen38-flash-next
start_qwen38_flash_next() {
  warn "=== Qwen3.8-Flash-Next NVFP4 (spark1, PLE mmap, TP=1) ==="
  start_nemotron_llm "qwen3.8-flash-next-nvfp4" "Qwen3.8-Flash-Next NVFP4"
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
  warn "QSFP ring is unused for tokens in Mode A. Exclusive with start-glm53-flash."

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
  warn "Exclusive: refuses Mode A rounded Jobs. hostNetwork + 3-node NCCL (not 2-node 400G vars)."
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
  log "LiteLLM should already be up, or run: ./scripts/manage.sh start-litellm"
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

# @function status_stack
# Mode A/B Jobs, LiteLLM, aliases, fabric hint.
# @command status-stack
status_stack() {
  log "=== Rounded stack status (namespace ${NAMESPACE}) ==="
  kubectl get jobs -n "${NAMESPACE}" -l family=qwen3.6 -o wide 2>/dev/null || true
  kubectl get jobs -n "${NAMESPACE}" -l family=qwen3.8 -o wide 2>/dev/null || true
  kubectl get jobs -n "${NAMESPACE}" -l family=medgemma -o wide 2>/dev/null || true
  kubectl get jobs -n "${NAMESPACE}" -l family=glm-5.3 -o wide 2>/dev/null || true
  kubectl get deploy,svc -n "${NAMESPACE}" litellm 2>/dev/null || true
  echo
  log "Aliases: lab-fast/lab-code → 35b-a3b · lab-smart/lab-agent → flash-next · lab-med → medgemma · lab-frontier → glm-5.3-flash · lab-auto → fast then smart"
  log "Open WebUI model base URL: http://litellm.${NAMESPACE}.svc.cluster.local:4000/v1 (or spark0:32040)"
  log "Raw bypass: kubectl port-forward -n ${NAMESPACE} svc/<job> 8000:8000"
  doctor_fabric || true
}
