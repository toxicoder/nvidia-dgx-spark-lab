#!/usr/bin/env bash
#
# ## Common utilities (log, safety helpers, resource math, printing)
#
# Shared by manage.sh and the lib modules.
# These functions are heavily used by doctor, estimate, status, start-* etc.
#
# All heavy operations should go through these helpers so logging,
# preflights, and safety conventions stay consistent.

# Colors (shared)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# @function log
# Green informational message.
log() { echo -e "${GREEN}[manage]${NC} $*"; }

# @function warn
# Yellow warning.
warn() { echo -e "${YELLOW}[manage][WARN]${NC} $*"; }

# @function err
# Red error to stderr.
err() { echo -e "${RED}[manage][ERROR]${NC} $*"; }

# @function require_kubectl
# Fail fast if kubectl is not in PATH.
require_kubectl() {
  if ! command -v kubectl &> /dev/null; then
    err "kubectl not found in PATH"
    exit 1
  fi
}

# @function ensure_namespace
# Make sure the inference namespace exists (idempotent).
ensure_namespace() {
  kubectl get ns "${NAMESPACE}" >/dev/null 2>&1 || kubectl apply -f "${REPO_ROOT}/k8s/base/namespace.yaml"
}

# @function check_cluster_access
# Verify we can talk to the Kubernetes API.
check_cluster_access() {
  if ! kubectl cluster-info >/dev/null 2>&1; then
    err "Cannot reach Kubernetes cluster. Check KUBECONFIG or connection."
    exit 1
  fi
}

# @function get_approx_free_gpus
# Best-effort free GPUs = cluster allocatable minus Running/Pending pod GPU requests.
# Used by doctor + estimate to decide whether a workload is safe to start.
#
# Returns "unknown" if jq or the cluster is unreachable.
get_approx_free_gpus() {
  if ! command -v jq &>/dev/null; then
    echo "unknown"
    return 0
  fi
  local alloc allocated
  alloc=$(kubectl get nodes -o json 2>/dev/null | \
    jq -r '[.items[] | (.status.allocatable["nvidia.com/gpu"] // "0" | tonumber)] | add // 0' 2>/dev/null) || alloc=""
  if [[ -z "$alloc" ]]; then
    echo "unknown"
    return 0
  fi
  allocated=$(kubectl get pods -A -o json 2>/dev/null | \
    jq -r '
      [.items[]
       | select(.status.phase == "Running" or .status.phase == "Pending")
       | (.spec.containers[]?.resources.requests["nvidia.com/gpu"] // empty)
       | tonumber] | add // 0
    ' 2>/dev/null) || allocated=""
  if [[ -z "$allocated" ]]; then
    echo "unknown"
    return 0
  fi
  echo $((alloc - allocated))
}

# @function get_free_gpus
# Backward-compat shim (minor 4.4). Delegates to get_approx_free_gpus.
# Call sites updated to new name; old name preserved for any direct users of libs.
get_free_gpus() { get_approx_free_gpus "$@"; }

# @function print_status
# Pretty cluster overview (nodes + GPU resources + current ai-inference workloads + events).
# Called by `manage.sh status`.
print_status() {
  echo
  log "=== Cluster Nodes (supports 1-4 node scalable setups) ==="
  kubectl get nodes -L nvidia-dgx-spark/highspeed,nvidia-dgx-spark/role || true

  echo
  log "=== GPU Resources (allocatable) ==="
  kubectl get nodes -o custom-columns='NAME:.metadata.name,GPU-Allocatable:.status.allocatable.nvidia.com/gpu,GPU-Capacity:.status.capacity.nvidia.com/gpu' || true

  echo
  log "=== Workloads in ${NAMESPACE} ==="
  kubectl get pods,jobs,svc -n "${NAMESPACE}" -o wide || true

  echo
  log "=== Recent events (ai-inference) ==="
  kubectl get events -n "${NAMESPACE}" --sort-by='.lastTimestamp' | tail -10 || true
}

# @function require_helm
# Fail fast if helm is not in PATH (Coder, Kasm, Grafana installs).
require_helm() {
  if ! command -v helm &> /dev/null; then
    err "helm not found in PATH (required for Coder/Kasm/Grafana)"
    exit 1
  fi
}

# @function ensure_dev_namespaces
# Idempotently create dev namespaces (coder, kasm, monitoring, dev) when missing.
ensure_dev_namespaces() {
  for ns in coder kasm monitoring dev; do
    kubectl get ns "$ns" >/dev/null 2>&1 || kubectl create ns "$ns" >/dev/null 2>&1 || true
  done
}

# @function print_dev_status
# Shows status of dev workspaces (Coder/Kasm) and dashboard/monitoring components.
# Used by `manage.sh status`.
print_dev_status() {
  echo
  log "=== Dev Workspaces (coder / kasm) ==="
  for ns in coder kasm; do
    helm list -n "$ns" 2>/dev/null || true
    kubectl get pods -n "$ns" --no-headers 2>/dev/null || true
  done

  echo
  log "=== Dashboard / Monitoring ==="
  for ns in dev monitoring; do
    kubectl get pods,svc -n "$ns" --no-headers 2>/dev/null || true
  done
}

# @function print_access_info
# Prints all important NodePort URLs for the lab (custom dashboard, Coder, Kasm, Grafana, etc.).
# Includes tips for remote access via ssh -L or VPN.
# Supports DASHBOARD_HOST and port overrides.
#
# @command urls
# @command access
print_access_info() {
  echo
  log "=== Access Information (use ssh -L or VPN for remote) ==="
  local base_ip="${DASHBOARD_HOST:-<spark0-ip>}"
  if type sso_enabled &>/dev/null && sso_enabled; then
    if type print_sso_access_info &>/dev/null; then
      print_sso_access_info
    fi
    if [[ "${SSO_BYPASS_NODEPORTS:-1}" == "1" ]]; then
      echo
      warn "Legacy direct NodePorts (bypass SSO):"
      echo "  Custom Dashboard: http://${base_ip}:${DASHBOARD_PORT:-32082}"
      echo "  Coder: http://${base_ip}:${CODER_PORT:-32080}"
      echo "  Kasm: http://${base_ip}:${KASM_PORT:-32081}"
      echo "  Grafana: http://${base_ip}:${GRAFANA_PORT:-32083}"
      echo "  Headlamp: http://${base_ip}:${HEADLAMP_PORT:-32084}"
      echo "  Open WebUI (chat): http://${base_ip}:${OPENWEBUI_PORT:-32085}"
    fi
  else
    echo "  Custom Dashboard: http://${base_ip}:${DASHBOARD_PORT:-32082}"
    echo "  Coder (VSCode workspaces): http://${base_ip}:${CODER_PORT:-32080}"
    echo "  Kasm: http://${base_ip}:${KASM_PORT:-32081}"
    echo "  Grafana: http://${base_ip}:${GRAFANA_PORT:-32083}"
    echo "  Headlamp (K8s UI): http://${base_ip}:${HEADLAMP_PORT:-32084}"
    echo "  Open WebUI (agent chat): http://${base_ip}:${OPENWEBUI_PORT:-32085}"
  fi
  echo "  node-exporter: http://${base_ip}:${NODE_EXPORTER_PORT:-32090}"
  echo "  vLLM example (after start): kubectl port-forward svc/kimi -n ${NAMESPACE} 8000:8000"
  echo "Tip: ./scripts/manage.sh status ; use browser on control machine or tunnel."
}

# @function require_jq
# Fail fast if jq is missing (required for GPU estimation in doctor/estimate).
require_jq() {
  if ! command -v jq &> /dev/null; then
    err "jq not found (needed for GPU status etc). Install jq."
    exit 1
  fi
}

# @function wait_for_job
# Waits (with timeout) for a Kubernetes Job to complete.
# Used by the `wait` command.
wait_for_job() {
  local job="$1"
  local ns="${2:-${NAMESPACE}}"
  log "Waiting for job/$job in $ns to complete (timeout 5m)..."
  kubectl wait --for=condition=complete job/"$job" -n "$ns" --timeout=300s || true
  kubectl get job "$job" -n "$ns" -o wide || true
}

# ## Model resource profiles & estimator (safety-first)
#
# Used by doctor and estimate commands.
# Profiles are conservative to protect host stability.

# @function get_model_profile
# Returns "gpus mem note" string for a model.
# Conservative values chosen for DGX Spark host memory + GPU limits.
get_model_profile() {
  # Returns "gpus mem note" e.g. "2 32Gi lighter safe first step"
  case "$1" in
    kimi-test)           echo "2 32Gi lighter-test (recommended first validation)" ;;
    kimi)                echo "8 128Gi full production (confirm + 8+ GPUs)" ;;
    ray-head)            echo "1 8Gi Ray head (Spark: 1 GPU/node)" ;;
    ray-worker)          echo "1 8Gi Ray worker (multi-node)" ;;
    nemotron-3-ultra)    echo "8 128Gi+ NVFP4 tp/pp=2 (legacy 8-GPU profile)" ;;
    nemotron-3-nano-30b) echo "1 40Gi NVFP4 agent orchestrator (Mamba-MoE)" ;;
    nemotron-3-nano-omni-30b) echo "1 45Gi NVFP4 multimodal orchestrator" ;;
    nemotron-3-super-120b) echo "1 95Gi NVFP4 hard reasoning (gpu-mem 0.65)" ;;
    nemotron-retriever-embed) echo "0 4Gi NIM embed (CPU)" ;;
    nemotron-retriever-rerank) echo "0 6Gi NIM rerank (CPU)" ;;
    nemotron-parse)      echo "1 8Gi NIM document parse" ;;
    nemotron-safety-guard) echo "0 4Gi NeMo Guard (CPU)" ;;
    nemotron-speech-asr) echo "0 6Gi NIM ASR" ;;
    nemotron-speech-tts) echo "0 6Gi NIM TTS" ;;
    glm-5.2)             echo "2 110Gi+ 1-bit UD-IQ1_M llama.cpp RPC (2-node dual-400G; no Ray)" ;;
    qwen3.5-122b-a10b-nvfp4) echo "1 95Gi Qwen 122B NVFP4 (1-node 397B substitute)" ;;
    qwen3.5-397b-spark2) echo "2 220Gi Qwen 397B int4-AutoRound (2-node; Ray + vLLM)" ;;
    qwen3.5-397b-nvfp4)  echo "4 460Gi+ Qwen 397B NVFP4 SGLang (4-node frontier)" ;;
    qwen3.6-27b-nvfp4)   echo "1 48Gi Qwen3.6 27B NVFP4 dense (exclusive util 0.72; dual 0.38)" ;;
    qwen3.6-35b-a3b-nvfp4) echo "1 48Gi Qwen3.6 35B-A3B NVFP4-Fast MoE (exclusive util 0.72; dual 0.38)" ;;
    qwen36-dual-spark-1|qwen36-dual) echo "2 96Gi Qwen3.6 dual 27B+35B (time-sliced; mid ctx)" ;;
    comfy-base)          echo "1 60Gi ComfyUI base (visual; Spark unified-memory patches)" ;;
    flux-fast)           echo "1 60Gi FLUX.2 Klein 9B NVFP4+Nunchaku (visual fast)" ;;
    flux-quality)        echo "1 70Gi FLUX.2 Dev FP8 (visual quality)" ;;
    *)                   echo "unknown unknown unknown model" ;;
  esac
}

# @function estimate_resources
# Core of the `estimate` command.
# Shows free GPUs vs required, gives safety verdict, and suggests the exact
# next command (with {{PLACEHOLDER}} for the interactive panel).
#
# @command estimate
# @command recommend
estimate_resources() {
  local model="${1:-}"
  if [[ -z "$model" ]]; then
    err "Usage: estimate <model>   (kimi-test|kimi|ray-head|...)"
    return 1
  fi
  local free
  free=$(get_approx_free_gpus 2>/dev/null || echo "unknown")
  local profile
  profile=$(get_model_profile "$model")
  read -r want_gpus want_mem note <<< "$profile"

  log "=== Resource Estimate for $model ==="
  echo "  Detected free GPUs (best-effort): $free"
  echo "  Model profile: ${want_gpus} GPUs, ~${want_mem} memory — $note"

  if command -v check_capacity &>/dev/null || type check_capacity &>/dev/null 2>&1; then
    local check_json ok verdict
    check_json=$(check_capacity "model:${model}" 2>/dev/null) || true
    ok=$(echo "$check_json" | jq -r '.ok // empty' 2>/dev/null)
    verdict=$(echo "$check_json" | jq -r '.verdict // empty' 2>/dev/null)
    if [[ "$ok" == "true" ]]; then
      echo "  Status: LIKELY SAFE to start now (GPU/CPU/memory after headroom)."
    elif [[ -n "$verdict" ]]; then
      warn "  Status: MAY BE TIGHT ($verdict)."
      echo "$check_json" | jq -r '.available | "  Available: \(.gpus) GPUs, \(.cpu) CPU, \(.memory) memory"' 2>/dev/null || true
      echo "$check_json" | jq -r '.required | "  Required:  \(.gpus) GPUs, \(.cpu) CPU, \(.memory) memory"' 2>/dev/null || true
    fi
  elif [[ "$free" != "unknown" && "$want_gpus" != "unknown" ]]; then
    if [[ "$free" -ge "$want_gpus" ]]; then
      echo "  Status: LIKELY SAFE to start now."
    else
      warn "  Status: MAY BE TIGHT (have ~$free, wants $want_gpus). Validate with lighter model first."
    fi
  fi

  echo
  echo "Suggested next command (edit variables as needed):"
  echo "  {{SPARK0_IP:=<your-spark0>}}"
  echo "  ./scripts/manage.sh start-${model}   # or start-test first if heavy"
  echo
  echo "Or run: ./scripts/manage.sh doctor   for full preflight."
}
