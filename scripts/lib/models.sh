#!/usr/bin/env bash
# ## Model/job definitions and workload starters
#
# Extracted for modularity, reusability across scripts/tests.
#
# This file is a primary source for auto-generated documentation.
# Structured comments here are extracted by docs/generate_shell_docs.py
# and appear in the built MkDocs site under Reference → Shell Commands & Helpers.
#
# ### Model Profiles (used by estimate + doctor)
# kimi-test: lighter safe first step (2 GPUs)
# kimi: full production (8 GPUs, heavy confirmation)
# ray-head / ray-worker: distributed orchestration
# nemotron-3-ultra: large model (requires Ray + capacity check)
# glm-5.2 / glm-5.2-rpc: 1-bit UD-IQ1_M llama.cpp RPC (2-node dual-400G; no Ray)
# qwen3.5-122b-a10b-nvfp4: 1-node Qwen 122B NVFP4 substitute for 397B NVFP4
# qwen3.5-397b-spark2: 2-node Qwen 397B int4-AutoRound (vLLM TP=2 + Ray)
# qwen3.5-397b-nvfp4: 4-node Qwen 397B NVFP4 (SGLang distributed)
#
# Model/job definitions - centralized, portable bash (no associative arrays for macOS /bin/bash 3.2 compat + set -u).
# Use lookup functions.

# @function get_model_job
# Returns the path to the Job YAML for a given model name.
# Centralized so start-* commands and tests stay in sync.
get_model_job() {
  case "$1" in
    kimi-test) echo "k8s/workloads/kimi-test/kimi-test-job.yaml" ;;
    kimi) echo "k8s/workloads/kimi/kimi-job.yaml" ;;
    ray-head) echo "k8s/workloads/ray-head/ray-head-job.yaml" ;;
    ray-worker) echo "k8s/workloads/ray-worker/ray-worker-job.yaml" ;;
    nemotron-3-ultra) echo "k8s/workloads/nemotron-3-ultra/nemotron-3-ultra-job.yaml" ;;
    nemotron-3-nano-30b) echo "k8s/workloads/nemotron-3-nano-30b/nemotron-3-nano-30b-job.yaml" ;;
    nemotron-3-nano-omni-30b) echo "k8s/workloads/nemotron-3-nano-omni-30b/nemotron-3-nano-omni-30b-job.yaml" ;;
    nemotron-3-super-120b) echo "k8s/workloads/nemotron-3-super-120b/nemotron-3-super-120b-job.yaml" ;;
    glm-5.2) echo "k8s/workloads/glm-5.2/glm-5.2-job.yaml" ;;
    glm-5.2-rpc) echo "k8s/workloads/glm-5.2/glm-5.2-rpc-job.yaml" ;;
    qwen3.5-122b-a10b-nvfp4) echo "k8s/workloads/qwen3.5-122b-a10b-nvfp4/qwen3.5-122b-a10b-nvfp4-job.yaml" ;;
    qwen3.5-397b-spark2) echo "k8s/workloads/qwen3.5-397b-spark2/qwen3.5-397b-spark2-job.yaml" ;;
    qwen3.5-397b-nvfp4) echo "k8s/workloads/qwen3.5-397b-nvfp4/qwen3.5-397b-nvfp4-job.yaml" ;;
    qwen3.5-397b-nvfp4-worker-1) echo "k8s/workloads/qwen3.5-397b-nvfp4/qwen3.5-397b-nvfp4-worker-1-job.yaml" ;;
    qwen3.5-397b-nvfp4-worker-2) echo "k8s/workloads/qwen3.5-397b-nvfp4/qwen3.5-397b-nvfp4-worker-2-job.yaml" ;;
    qwen3.5-397b-nvfp4-worker-3) echo "k8s/workloads/qwen3.5-397b-nvfp4/qwen3.5-397b-nvfp4-worker-3-job.yaml" ;;
    *) echo "" ;;
  esac
}

# @function get_model_deployment
# Returns Deployment manifest path for NIM auxiliary models.
get_model_deployment() {
  case "$1" in
    nemotron-retriever-embed) echo "k8s/workloads/nemotron-retriever-embed/nemotron-retriever-embed-deployment.yaml" ;;
    nemotron-retriever-rerank) echo "k8s/workloads/nemotron-retriever-rerank/nemotron-retriever-rerank-deployment.yaml" ;;
    nemotron-parse) echo "k8s/workloads/nemotron-parse/nemotron-parse-deployment.yaml" ;;
    nemotron-safety-guard) echo "k8s/workloads/nemotron-safety-guard/nemotron-safety-guard-deployment.yaml" ;;
    nemotron-speech-asr) echo "k8s/workloads/nemotron-speech-asr/nemotron-speech-asr-deployment.yaml" ;;
    nemotron-speech-tts) echo "k8s/workloads/nemotron-speech-tts/nemotron-speech-tts-deployment.yaml" ;;
    *) echo "" ;;
  esac
}

# @function get_model_svc
# Service manifest mapper (for ClusterIP access inside the namespace).
get_model_svc() {
  case "$1" in
    kimi-test) echo "k8s/workloads/kimi-test/service.yaml" ;;
    kimi) echo "k8s/workloads/kimi/service.yaml" ;;
    ray-head) echo "k8s/workloads/ray-head/ray-head-service.yaml" ;;
    ray-worker) echo "k8s/workloads/ray-worker/ray-worker-service.yaml" ;;
    nemotron-3-ultra) echo "k8s/workloads/nemotron-3-ultra/service.yaml" ;;
    nemotron-3-nano-30b) echo "k8s/workloads/nemotron-3-nano-30b/service.yaml" ;;
    nemotron-3-nano-omni-30b) echo "k8s/workloads/nemotron-3-nano-omni-30b/service.yaml" ;;
    nemotron-3-super-120b) echo "k8s/workloads/nemotron-3-super-120b/service.yaml" ;;
    nemotron-retriever-embed) echo "k8s/workloads/nemotron-retriever-embed/service.yaml" ;;
    nemotron-retriever-rerank) echo "k8s/workloads/nemotron-retriever-rerank/service.yaml" ;;
    nemotron-parse) echo "k8s/workloads/nemotron-parse/service.yaml" ;;
    nemotron-safety-guard) echo "k8s/workloads/nemotron-safety-guard/service.yaml" ;;
    nemotron-speech-asr) echo "k8s/workloads/nemotron-speech-asr/service.yaml" ;;
    nemotron-speech-tts) echo "k8s/workloads/nemotron-speech-tts/service.yaml" ;;
    glm-5.2) echo "k8s/workloads/glm-5.2/service.yaml" ;;
    qwen3.5-122b-a10b-nvfp4) echo "k8s/workloads/qwen3.5-122b-a10b-nvfp4/service.yaml" ;;
    qwen3.5-397b-spark2) echo "k8s/workloads/qwen3.5-397b-spark2/service.yaml" ;;
    qwen3.5-397b-nvfp4) echo "k8s/workloads/qwen3.5-397b-nvfp4/service.yaml" ;;
    *) echo "" ;;
  esac
}

# @function start_workload
# Internal helper that looks up Job+Service manifests by model key (via get_model_*) and applies them.
# Used by all start-* wrappers and directly in some dispatch paths.
#
# Usage:
#   start_workload "kimi-test"
#   start_workload "{{MODEL:=kimi}}"
#
# Safety:
#   Runs enforce_capacity before apply. Assumes kubectl access already verified.
start_workload() {
  local model="$1"
  local force_flag="${2:-}"
  local job dep svc
  job=$(get_model_job "$model")
  dep=$(get_model_deployment "$model")
  svc=$(get_model_svc "$model")
  if [[ -z "$job" && -z "$dep" ]]; then
    err "Unknown model: $model"
    exit 1
  fi

  if [[ "$force_flag" != "--force" ]]; then
    enforce_capacity "model:${model}" || exit 1
  fi

  log "Starting $model workload..."
  ensure_namespace
  if [[ -n "$svc" ]]; then
    kubectl apply -f "${REPO_ROOT}/${svc}" -n "${NAMESPACE}" || true
  fi
  if [[ -n "$dep" ]]; then
    kubectl apply -f "${REPO_ROOT}/${dep}" -n "${NAMESPACE}"
  elif [[ -n "$job" ]]; then
    kubectl apply -f "${REPO_ROOT}/${job}" -n "${NAMESPACE}"
  fi
  log "$model submitted. Monitor with: kubectl get pods -n ${NAMESPACE} -l app=${model}"
}

# @function stop_inference_deployment
stop_inference_deployment() {
  local name="$1"
  kubectl delete deployment "$name" -n "${NAMESPACE}" --ignore-not-found=true --grace-period=30 || true
}

# @function stop_inference_job
# Stops a single inference job by name.
stop_inference_job() {
  local job="$1"
  kubectl delete job "$job" -n "${NAMESPACE}" --ignore-not-found=true --grace-period=30 || true
}

# @function start_test
# Thin wrapper for the test workload. Delegates to start_workload.
start_test() {
  guard_active_job "kimi-test" || exit 1
  start_workload "kimi-test"
}

# @function start_kimi
# Heavy production Kimi starter (internal impl for start-kimi/start-full).
# Includes user confirmation, duplicate job guard, and capacity check.
start_kimi() {
  warn "=== HEAVY PRODUCTION WORKLOAD ==="
  warn "This requests 8 GPUs + 128Gi+ memory."
  warn "Make sure you have validated with 'start-test' first."
  warn "Heavy workloads can make SSH unresponsive if limits are exceeded."

  if [[ "${LAB_NON_INTERACTIVE:-}" != "1" ]]; then
    echo
    read -r -p "Are you absolutely sure you want to start the FULL kimi workload? [yes/NO] " response
    if [[ ! "$response" =~ ^[Yy][Ee][Ss]$ ]]; then
      log "Aborted by user."
      exit 0
    fi
  else
    require_heavy_confirm "kimi" "Heavy kimi requires confirmation." || exit 1
  fi

  ensure_namespace
  guard_active_job "kimi" || exit 1

  start_workload "kimi"
}

# @function start_ray
# Starts Ray head (and worker on >1 node). Used by start-ray and by larger models.
start_ray() {
  log "Starting Ray cluster..."
  ensure_namespace
  guard_active_job "ray-head" || exit 1
  num_nodes=$(kubectl get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ' || echo 1)
  start_workload "ray-head"
  if [ "$num_nodes" -gt 1 ]; then
    if ! _is_job_active "ray-worker"; then
      start_workload "ray-worker"
    fi
  fi
  log "Ray submitted. Waiting for healthy..."
  wait_for_job "ray-head" || true
  kubectl get pods -n "${NAMESPACE}" -l workload=ray || true
  log "Check Ray: kubectl logs job/ray-head -n ${NAMESPACE}"
}

# @function start_nemotron
# Confirmation + Ray + workload for Nemotron 3 Ultra heavy model.
start_nemotron() {
  warn "=== NEMOTRON 3 ULTRA (NVFP4, tp=1 pp=2 on two-node) ==="
  warn "This requests significant GPUs/memory. Validate with test first."
  warn "Safety: gpu-mem-util 0.82 default. Do not exceed 0.90."

  if [[ "${LAB_NON_INTERACTIVE:-}" != "1" ]]; then
    echo
    read -r -p "Start NEMOTRON 3 ULTRA? [yes/NO] " response
    if [[ ! "$response" =~ ^[Yy][Ee][Ss]$ ]]; then
      log "Aborted."
      exit 0
    fi
  else
    require_heavy_confirm "nemotron-3-ultra" || exit 1
  fi

  ensure_namespace
  guard_active_job "nemotron-3-ultra" || exit 1

  start_ray
  log "Waiting for Ray healthy (for two-node)..."
  wait_for_job "ray-head" || true
  kubectl get pods -n "${NAMESPACE}" -l workload=ray || true
  start_workload "nemotron-3-ultra"
  log "Nemotron submitted. Waiting for health..."
  wait_for_job "nemotron-3-ultra" || true
  kubectl get pods -n "${NAMESPACE}" -l app=nemotron-3-ultra || true
  log "Monitor: kubectl logs -f job/nemotron-3-ultra -n ${NAMESPACE} -c inference"
  log "Health: kubectl port-forward svc/nemotron-3-ultra 8000:8000 &; curl -s http://localhost:8000/health"
}

# @function start_glm
# Confirmation + 2-node llama.cpp RPC for GLM-5.2 UD-IQ1_M (1-bit dynamic quant).
start_glm() {
  local models_dir="${MODELS_DIR:-/mnt/models}"
  local shard_dir="${models_dir}/GLM-5.2-GGUF/UD-IQ1_M"

  warn "=== GLM-5.2 ULTRA 2-NODE (1-bit UD-IQ1_M, llama.cpp RPC across dual-400G) ==="
  warn "Quality trade-off: ~76% top-1 retention vs higher quants. 2 nodes required (spark0 + spark1)."
  warn "Model ~228 GB; first load/repack may take 15-30+ minutes. No Ray dependency."

  if [[ "${LAB_NON_INTERACTIVE:-}" != "1" ]]; then
    echo
    read -r -p "Start GLM-5.2? [yes/NO] " response
    if [[ ! "$response" =~ ^[Yy][Ee][Ss]$ ]]; then
      log "Aborted."
      exit 0
    fi
  else
    require_heavy_confirm "glm-5.2" || exit 1
  fi

  ensure_namespace
  guard_active_job "glm-5.2" || exit 1

  if ! compgen -G "${shard_dir}/GLM-5.2-UD-IQ1_M-00001-of-*.gguf" >/dev/null; then
    warn "Model shards not found under ${shard_dir}"
    warn "Download first: bazelisk run //scripts:run-utility -- download-glm52-gguf run"
    if [[ "${LAB_NON_INTERACTIVE:-}" != "1" ]]; then
      read -r -p "Continue without local shard check? [y/N] " cont
      if [[ ! "$cont" =~ ^[Yy]$ ]]; then
        log "Aborted — download model shards before starting."
        exit 1
      fi
    fi
  fi

  num_nodes=$(kubectl get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ' || echo 1)
  if [[ "$num_nodes" -lt 2 && "${LAB_NON_INTERACTIVE:-}" != "1" ]]; then
    warn "Only ${num_nodes} node(s) detected. GLM-5.2 RPC expects spark0 + spark1."
    read -r -p "Continue on single-node cluster? [y/N] " cont
    if [[ ! "$cont" =~ ^[Yy]$ ]]; then
      log "Aborted — add spark1 worker before starting GLM-5.2 RPC."
      exit 1
    fi
  fi

  log "Starting RPC backend on spark1..."
  enforce_capacity "model:glm-5.2" || exit 1
  start_workload "glm-5.2-rpc" "--force"
  wait_for_job "glm-5.2-rpc" || true
  kubectl get pods -n "${NAMESPACE}" -l app=glm-5.2-rpc || true

  log "Starting llama-server on spark0..."
  start_workload "glm-5.2" "--force"
  log "GLM submitted. Waiting for health (long initial delay expected)..."
  wait_for_job "glm-5.2" || true
  kubectl get pods -n "${NAMESPACE}" -l app=glm-5.2 || true
  log "Monitor RPC: kubectl logs -f job/glm-5.2-rpc -n ${NAMESPACE} -c rpc"
  log "Monitor server: kubectl logs -f job/glm-5.2 -n ${NAMESPACE} -c inference"
  log "Health: kubectl port-forward svc/glm-5.2 8000:8000 &; curl -s http://localhost:8000/health"
}

# @function start_qwen3_5_122b_nvfp4
# 1-node Qwen 122B NVFP4 — substitute when 397B NVFP4 does not fit.
start_qwen3_5_122b_nvfp4() {
  warn "=== QWEN 3.5 122B NVFP4 (1-node substitute for 397B NVFP4) ==="
  warn "Uses RedHatAI/Qwen3.5-122B-A10B-NVFP4 (~75 GB). Requires vLLM cu130-nightly."
  start_nemotron_llm "qwen3.5-122b-a10b-nvfp4" "Qwen 3.5 122B NVFP4"
}

# @function start_qwen3_5_397b_spark2
# 2-node Qwen 397B int4-AutoRound — substitute when 397B NVFP4 does not fit.
start_qwen3_5_397b_spark2() {
  warn "=== QWEN 3.5 397B SPARK-2 (int4-AutoRound, vLLM TP=2 + Ray) ==="
  warn "Uses Intel/Qwen3.5-397B-A17B-int4-AutoRound. Proven ~26-30 tok/s on dual Spark."
  warn "Requires Ray cluster and vLLM cu130-nightly + transformers 5.x patches."

  if [[ "${LAB_NON_INTERACTIVE:-}" != "1" ]]; then
    echo
    read -r -p "Start Qwen 397B (2-node)? [yes/NO] " response
    if [[ ! "$response" =~ ^[Yy][Ee][Ss]$ ]]; then
      log "Aborted."
      exit 0
    fi
  else
    require_heavy_confirm "qwen3.5-397b-spark2" || exit 1
  fi

  ensure_namespace
  guard_active_job "qwen3.5-397b-spark2" || exit 1

  num_nodes=$(kubectl get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ' || echo 1)
  if [[ "$num_nodes" -lt 2 && "${LAB_NON_INTERACTIVE:-}" != "1" ]]; then
    warn "Only ${num_nodes} node(s) detected. Qwen 397B spark2 expects 2 nodes."
    read -r -p "Continue on single-node cluster? [y/N] " cont
    if [[ ! "$cont" =~ ^[Yy]$ ]]; then
      log "Aborted — add spark1 worker or use qwen-agentic-spark-1."
      exit 1
    fi
  fi

  start_ray
  wait_for_job "ray-head" || true
  start_workload "qwen3.5-397b-spark2"
  log "Qwen 397B spark2 submitted. First load may take 20+ minutes."
  wait_for_job "qwen3.5-397b-spark2" || true
  log "Monitor: kubectl logs -f job/qwen3.5-397b-spark2 -n ${NAMESPACE} -c inference"
}

# @function start_qwen3_5_397b_nvfp4
# 4-node Qwen 397B NVFP4 — exact nvidia/Qwen3.5-397B-A17B-NVFP4 checkpoint via SGLang.
start_qwen3_5_397b_nvfp4() {
  warn "=== QWEN 3.5 397B NVFP4 (4-node SGLang, TP=4) ==="
  warn "Uses nvidia/Qwen3.5-397B-A17B-NVFP4 (~250 GB). Requires spark0..spark3."

  if [[ "${LAB_NON_INTERACTIVE:-}" != "1" ]]; then
    echo
    read -r -p "Start Qwen 397B NVFP4 (4-node)? [yes/NO] " response
    if [[ ! "$response" =~ ^[Yy][Ee][Ss]$ ]]; then
      log "Aborted."
      exit 0
    fi
  else
    require_heavy_confirm "qwen3.5-397b-nvfp4" || exit 1
  fi

  ensure_namespace
  guard_active_job "qwen3.5-397b-nvfp4" || exit 1

  num_nodes=$(kubectl get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ' || echo 1)
  if [[ "$num_nodes" -lt 4 && "${LAB_NON_INTERACTIVE:-}" != "1" ]]; then
    warn "Only ${num_nodes} node(s) detected. NVFP4 397B expects 4 nodes."
    warn "For smaller clusters use: qwen-agentic-spark-1 (1 node) or qwen-agentic-spark-2 (2 nodes)."
    read -r -p "Continue anyway? [y/N] " cont
    if [[ ! "$cont" =~ ^[Yy]$ ]]; then
      log "Aborted."
      exit 1
    fi
  fi

  enforce_capacity "model:qwen3.5-397b-nvfp4" || exit 1

  log "Starting SGLang workers on spark1..spark3..."
  start_workload "qwen3.5-397b-nvfp4-worker-1" "--force"
  start_workload "qwen3.5-397b-nvfp4-worker-2" "--force"
  start_workload "qwen3.5-397b-nvfp4-worker-3" "--force"
  sleep 10

  log "Starting SGLang leader on spark0..."
  start_workload "qwen3.5-397b-nvfp4" "--force"
  wait_for_job "qwen3.5-397b-nvfp4" || true
  log "Monitor: kubectl logs -f job/qwen3.5-397b-nvfp4 -n ${NAMESPACE} -c inference"
}

# @function _stack_startup_order
# Prints newline-separated model names for a stack id from policy JSON.
_stack_startup_order() {
  local stack_id="$1"
  local policy_path
  policy_path=$(resource_policy_path)
  python3 - "$policy_path" "$stack_id" <<'PY'
import json, sys
from pathlib import Path
policy = json.loads(Path(sys.argv[1]).read_text())
stack = policy.get("stacks", {}).get(sys.argv[2], {})
order = stack.get("startup_order") or stack.get("stack_with", [])
print("\n".join(order))
PY
}

# @function start_nemotron_stack
# Ordered deploy of a Nemotron agentic stack preset (see config/resource-policy.yaml stacks).
start_nemotron_stack() {
  local stack_id="$1"
  local policy_path order model

  policy_path=$(resource_policy_path)
  if ! python3 -c "
import json, sys
from pathlib import Path
p = json.loads(Path('${policy_path}').read_text())
sys.exit(0 if '${stack_id}' in p.get('stacks', {}) else 1)
"; then
    err "Unknown stack: ${stack_id}"
    exit 1
  fi

  warn "=== NEMOTRON AGENTIC STACK: ${stack_id} ==="
  warn "Deploys multiple services in order. Stop dev workspaces first if capacity is tight."

  if [[ "${LAB_NON_INTERACTIVE:-}" != "1" ]]; then
    echo
    read -r -p "Start stack ${stack_id}? [yes/NO] " response
    if [[ ! "$response" =~ ^[Yy][Ee][Ss]$ ]]; then
      log "Aborted."
      exit 0
    fi
  else
    require_heavy_confirm "${stack_id}" "Heavy stack requires confirmation." || exit 1
  fi

  enforce_capacity "stack:${stack_id}" || exit 1
  ensure_namespace

  order=$(_stack_startup_order "$stack_id")
  while IFS= read -r model; do
    [[ -z "$model" ]] && continue
    log "Stack step: starting ${model}..."
    start_workload "$model" "--force"
    if get_model_job "$model" | grep -q .; then
      wait_for_job "$model" || true
    else
      sleep 5
    fi
  done <<< "$order"

  log "Stack ${stack_id} submitted. Endpoints: kubectl get svc -n ${NAMESPACE} | grep nemotron"
}

# @function stop_nemotron_stack
stop_nemotron_stack() {
  local target="${1:-all}"
  local policy_path

  policy_path=$(resource_policy_path)

  if [[ "$target" == "all" ]]; then
    python3 - "$policy_path" <<'PY'
import json, sys
from pathlib import Path
policy = json.loads(Path(sys.argv[1]).read_text())
names = set()
for stack in policy.get("stacks", {}).values():
    for m in stack.get("stack_with", []):
        names.add(m)
for n in sorted(names):
    print(n)
PY
  else
    _stack_startup_order "$target" | tail -r
  fi | while IFS= read -r model; do
    [[ -z "$model" ]] && continue
    if get_model_job "$model" | grep -q .; then
      stop_inference_job "$model"
    elif get_model_deployment "$model" | grep -q .; then
      stop_inference_deployment "$model"
    fi
  done
  log "Stack stop complete for ${target}"
}

# @function get_nemotron_catalog_json
get_nemotron_catalog_json() {
  local policy_path catalog_path
  policy_path=$(resource_policy_path)
  catalog_path="${REPO_ROOT}/config/nemotron-catalog.yaml"
  python3 - "$policy_path" "$catalog_path" <<'PY'
import json, sys
from pathlib import Path

def load_yaml(path):
    try:
        import yaml
        return yaml.safe_load(Path(path).read_text()) or {}
    except Exception:
        return {}

policy = json.loads(Path(sys.argv[1]).read_text())
catalog = load_yaml(sys.argv[2])
stacks = policy.get("stacks", {})
out = {
    "models": catalog.get("models", {}),
    "pillars": catalog.get("pillars", {}),
    "stacks": stacks,
    "qwen_tiers": catalog.get("qwen_tiers", {}),
}
print(json.dumps(out))
PY
}

# @function get_nemotron_stack_status_json
get_nemotron_stack_status_json() {
  local policy_path
  policy_path=$(resource_policy_path)
  python3 - "$policy_path" <<'PY'
import json, subprocess, sys
from pathlib import Path

policy = json.loads(Path(sys.argv[1]).read_text())
ns = "ai-inference"
stacks_out = []

def job_state(name):
    try:
        data = json.loads(subprocess.check_output(
            ["kubectl", "get", "job", name, "-n", ns, "-o", "json"],
            stderr=subprocess.DEVNULL, timeout=5))
        st = data.get("status", {})
        if (st.get("active") or 0) > 0:
            return "running"
        if (st.get("succeeded") or 0) > 0:
            return "succeeded"
        if (st.get("failed") or 0) > 0:
            return "failed"
        return "absent"
    except Exception:
        return "absent"

def deploy_state(name):
    try:
        data = json.loads(subprocess.check_output(
            ["kubectl", "get", "deployment", name, "-n", ns, "-o", "json"],
            stderr=subprocess.DEVNULL, timeout=5))
        ready = data.get("status", {}).get("readyReplicas") or 0
        return "running" if ready > 0 else "pending"
    except Exception:
        return "absent"

for sid, stack in policy.get("stacks", {}).items():
    components = []
    all_running = True
    any_present = False
    for m in stack.get("stack_with", []):
        meta = policy.get("models", {}).get(m, {})
        kind = meta.get("kind", "job")
        state = deploy_state(m) if kind == "deployment" else job_state(m)
        if state not in ("running", "succeeded"):
            all_running = False
        if state != "absent":
            any_present = True
        components.append({"model": m, "state": state})
    stacks_out.append({
        "id": sid,
        "label": stack.get("label", sid),
        "healthy": all_running and any_present,
        "components": components,
    })

print(json.dumps({"stacks": stacks_out, "namespace": ns}))
PY
}

# @function start_nemotron_llm
# Generic heavy LLM starter with confirmation.
start_nemotron_llm() {
  local model="$1"
  local label="${2:-$model}"
  warn "=== ${label} ==="
  if [[ "${LAB_NON_INTERACTIVE:-}" != "1" ]]; then
    read -r -p "Start ${label}? [yes/NO] " response
    if [[ ! "$response" =~ ^[Yy][Ee][Ss]$ ]]; then
      log "Aborted."
      exit 0
    fi
  else
    require_heavy_confirm "$model" || exit 1
  fi
  guard_active_job "$model" || exit 1
  start_workload "$model"
}

# @function start_model
# Unified entry for dashboard/utility: dispatches to per-model starters.
start_model() {
  local model="$1"
  case "$model" in
    kimi-test) start_test ;;
    kimi) start_kimi ;;
    ray-head) start_ray ;;
    nemotron-3-ultra) start_nemotron ;;
    nemotron-3-nano-30b) start_nemotron_llm "nemotron-3-nano-30b" "Nemotron 3 Nano 30B" ;;
    nemotron-3-nano-omni-30b) start_nemotron_llm "nemotron-3-nano-omni-30b" "Nemotron 3 Nano Omni 30B" ;;
    nemotron-3-super-120b) start_nemotron_llm "nemotron-3-super-120b" "Nemotron 3 Super 120B" ;;
    nemotron-retriever-embed|nemotron-retriever-rerank|nemotron-parse|nemotron-safety-guard|nemotron-speech-asr|nemotron-speech-tts)
      start_workload "$model"
      ;;
    glm-5.2) start_glm ;;
    qwen3.5-122b-a10b-nvfp4) start_qwen3_5_122b_nvfp4 ;;
    qwen3.5-397b-spark2) start_qwen3_5_397b_spark2 ;;
    qwen3.5-397b-nvfp4) start_qwen3_5_397b_nvfp4 ;;
    *)
      err "Unknown model for start_model: $model"
      exit 1
      ;;
  esac
}

# @function stop_model
# Stops one or more inference jobs.
stop_model() {
  local target="${1:-all}"
  case "$target" in
    all)
      kubectl delete job kimi kimi-test nemotron-3-ultra nemotron-3-nano-30b nemotron-3-nano-omni-30b \
        nemotron-3-super-120b glm-5.2 glm-5.2-rpc \
        qwen3.5-122b-a10b-nvfp4 qwen3.5-397b-spark2 \
        qwen3.5-397b-nvfp4 qwen3.5-397b-nvfp4-worker-1 qwen3.5-397b-nvfp4-worker-2 qwen3.5-397b-nvfp4-worker-3 \
        ray-head ray-worker \
        -n "${NAMESPACE}" --ignore-not-found=true --grace-period=30 || true
      kubectl delete deployment nemotron-retriever-embed nemotron-retriever-rerank nemotron-parse \
        nemotron-safety-guard nemotron-speech-asr nemotron-speech-tts \
        -n "${NAMESPACE}" --ignore-not-found=true --grace-period=30 || true
      ;;
    kimi-test|kimi|nemotron-3-ultra|nemotron-3-nano-30b|nemotron-3-nano-omni-30b|nemotron-3-super-120b|glm-5.2|glm-5.2-rpc|ray-head|ray-worker|qwen3.5-122b-a10b-nvfp4|qwen3.5-397b-spark2|qwen3.5-397b-nvfp4|qwen3.5-397b-nvfp4-worker-1|qwen3.5-397b-nvfp4-worker-2|qwen3.5-397b-nvfp4-worker-3)
      stop_inference_job "$target"
      ;;
    nemotron-retriever-embed|nemotron-retriever-rerank|nemotron-parse|nemotron-safety-guard|nemotron-speech-asr|nemotron-speech-tts)
      stop_inference_deployment "$target"
      ;;
    ray)
      stop_inference_job "ray-head"
      stop_inference_job "ray-worker"
      ;;
    *)
      err "Unknown stop target: $target"
      exit 1
      ;;
  esac
}

# @function get_inference_status_json
# JSON snapshot of registered inference jobs for dashboard.
get_inference_status_json() {
  local policy_path models_json
  policy_path=$(resource_policy_path)
  models_json=$(python3 -c "
import json
from pathlib import Path
p = json.loads(Path('${policy_path}').read_text())
print(json.dumps(list(p.get('models', {}).keys())))
")

  python3 - "$models_json" "$policy_path" <<'PY'
import json, subprocess, sys
from pathlib import Path

models = json.loads(sys.argv[1])
policy = json.loads(Path(sys.argv[2]).read_text())
ns = "ai-inference"
out = {"jobs": [], "namespace": ns}

model_meta = policy.get("models", {})

for model in models:
    job = model
    meta = model_meta.get(model, {})
    kind = meta.get("kind", "job")
    try:
        if kind == "deployment":
            data = json.loads(subprocess.check_output(
                ["kubectl", "get", "deployment", job, "-n", ns, "-o", "json"],
                stderr=subprocess.DEVNULL, timeout=5,
            ))
            ready = data.get("status", {}).get("readyReplicas") or 0
            out["jobs"].append({
                "model": model,
                "job": job,
                "active": ready,
                "state": "running" if ready > 0 else "absent",
                "kind": "deployment",
            })
        else:
            data = json.loads(subprocess.check_output(
                ["kubectl", "get", "job", job, "-n", ns, "-o", "json"],
                stderr=subprocess.DEVNULL, timeout=5,
            ))
            status = data.get("status", {})
            out["jobs"].append({
                "model": model,
                "job": job,
                "active": status.get("active", 0) or 0,
                "succeeded": status.get("succeeded", 0) or 0,
                "failed": status.get("failed", 0) or 0,
                "state": "running" if (status.get("active") or 0) > 0 else (
                    "succeeded" if (status.get("succeeded") or 0) > 0 else (
                        "failed" if (status.get("failed") or 0) > 0 else "absent"
                    )
                ),
                "kind": "job",
            })
    except subprocess.CalledProcessError:
        out["jobs"].append({
            "model": model,
            "job": job,
            "active": 0,
            "state": "absent",
            "kind": kind,
        })
    except Exception as e:
        out["jobs"].append({"model": model, "job": job, "state": "error", "error": str(e), "kind": kind})

print(json.dumps(out))
PY
}