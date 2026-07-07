#!/usr/bin/env bash
#
# ## Dev workspaces & dashboard logic
#
# Manages Coder (VS Code workspaces), Kasm, and the full monitoring + custom dashboard stack
# using Helm (preferred) with fallback to raw manifests.
#
# All components run in dedicated namespaces and use explicit resource limits.
# See dev-workspaces.md for user guide and ports.

# Dev specific
DEV_NAMESPACES=(coder coder-workspaces kasm monitoring dev)
DEV_HELM_RELEASES=(coder kasm node-exporter kube-state-metrics blackbox-exporter prometheus grafana headlamp lab-dashboard open-webui)

# Ports (centralized defaults, can be overridden by env or group_vars)
DASHBOARD_PORT=${DASHBOARD_PORT:-32082}
CODER_PORT=${CODER_PORT:-32080}
KASM_PORT=${KASM_PORT:-32081}
GRAFANA_PORT=${GRAFANA_PORT:-32083}
HEADLAMP_PORT=${HEADLAMP_PORT:-32084}
NODE_EXPORTER_PORT=${NODE_EXPORTER_PORT:-32090}

# ## start_coder
# @command start-coder
# Deploys Coder v2 via Helm into the coder namespace.
# Provides browser-based VS Code development environments on the cluster.
#
# Uses ansible/files/coder-values.yaml when present for customization.
#
# Usage:
#   ./scripts/manage.sh start-coder
#
# Access:
#   http://<spark0-ip>:32080 (tunnel or expose as needed)
# @function start_coder
# Deploy Coder v2 via Helm into the coder namespace.

start_coder() {
  require_helm
  log "Starting Coder via Helm (namespace coder)..."
  ensure_dev_namespaces
  local extra=()
  if type sso_enabled &>/dev/null && sso_enabled; then
    extra+=(--set coder.service.type=ClusterIP)
  fi
  local coder_values
  coder_values="$(lab_ansible_values_file coder-values.yaml 2>/dev/null || true)"
  if [[ -n "$coder_values" ]]; then
    helm upgrade --install coder coder-v2/coder \
      --namespace coder \
      --version "${coder_version:-2.34.0}" \
      -f "$coder_values" \
      "${extra[@]}" \
      --wait --timeout 8m
  else
    helm upgrade --install coder coder-v2/coder --namespace coder "${extra[@]}" --wait --timeout 8m
  fi
  if type sso_enabled &>/dev/null && sso_enabled; then
    log "Coder submitted. Access: $(lab_service_url coder "/" local 2>/dev/null || echo "https://coder.${LAB_SSO_DOMAIN:-lab.local}:32443")"
  else
    log "Coder submitted. Access: http://<spark0>:32080 (or use ssh tunnel)"
  fi
}

# ## start_kasm
# @command start-kasm
# Deploys Kasm Workspaces via Helm for streamed desktops and applications.
#
# Usage:
#   ./scripts/manage.sh start-kasm
#
# Access:
#   http://<spark0-ip>:32081
# @function start_kasm
# Deploy Kasm Workspaces via Helm into the kasm namespace.

start_kasm() {
  require_helm
  log "Starting Kasm via Helm (namespace kasm)..."
  ensure_dev_namespaces
  helm upgrade --install kasm kasmweb/kasm-helm \
    --namespace kasm \
    --version "${kasm_version:-1.19.0}" \
    --wait --timeout 8m || true
  log "Kasm submitted. Access: http://<spark0>:32081"
}

# ## stop_coder
# @command stop-coder
# Removes the Coder Helm release from the coder namespace.
# Frees dev management resources without touching inference workloads.
#
# Usage:
#   ./scripts/manage.sh stop-coder
#
# Safety:
#   Only affects the coder namespace. Unsaved workspace sessions may be lost.
# @function stop_coder
# Uninstall Coder Helm release from coder namespace.

stop_coder() {
  require_helm
  log "Stopping Coder (helm uninstall in namespace coder)..."
  helm uninstall coder -n coder --ignore-not-found 2>/dev/null || true
  log "Coder stopped."
}

# ## stop_kasm
# @command stop-kasm
# Removes the Kasm Helm release from the kasm namespace.
#
# Usage:
#   ./scripts/manage.sh stop-kasm
#
# Safety:
#   Only affects the kasm namespace. Active desktop sessions will disconnect.
# @function stop_kasm
# Uninstall Kasm Helm release from kasm namespace.

stop_kasm() {
  require_helm
  log "Stopping Kasm (helm uninstall in namespace kasm)..."
  helm uninstall kasm -n kasm --ignore-not-found 2>/dev/null || true
  log "Kasm stopped."
}

# @function _workspace_pod_counts
# Returns "total ready" pod counts for a dev workspace namespace.
_workspace_pod_counts() {
  local ns="$1"
  local total ready
  total=$(kubectl get pods -n "$ns" --no-headers 2>/dev/null | grep -vc '^$' || echo 0)
  ready=$(
    kubectl get pods -n "$ns" --no-headers 2>/dev/null \
      | awk '$2 ~ /\// && $2 !~ /^0\// { c++ } END { print c + 0 }' || echo 0
  )
  echo "$total $ready"
}

# @function _workspace_url
# Builds browser-reachable URL for coder or kasm NodePort service.
_workspace_url() {
  local svc="$1"
  local host="${LAB_WORKSPACE_HOST:-localhost}"
  local port
  case "$svc" in
    coder) port="${CODER_PORT:-32080}" ;;
    kasm) port="${KASM_PORT:-32081}" ;;
    *) port="0" ;;
  esac
  echo "http://${host}:${port}"
}

# @function get_workspace_status
# Reports Coder or Kasm lifecycle state using helm + pod readiness.
# States: stopped | starting | running
#
# Usage:
#   get_workspace_status coder
#   get_workspace_status kasm --json
get_workspace_status() {
  local svc="$1"
  local json_flag="${2:-}"
  local ns="$svc"
  local total ready helm_installed=false state="stopped"

  read -r total ready < <(_workspace_pod_counts "$ns")

  if helm list -n "$ns" -q 2>/dev/null | grep -qx "$svc"; then
    helm_installed=true
  fi

  if [[ "$helm_installed" == true || "$total" -gt 0 ]]; then
    if [[ "$total" -gt 0 && "$ready" -eq "$total" ]]; then
      state="running"
    else
      state="starting"
    fi
  fi

  local url
  url=$(_workspace_url "$svc")

  if [[ "$json_flag" == "--json" ]]; then
    printf '{"name":"%s","state":"%s","readyPods":%s,"totalPods":%s,"url":"%s","helmInstalled":%s}\n' \
      "$svc" "$state" "$ready" "$total" "$url" "$helm_installed"
  else
    echo "$svc: $state (pods ${ready}/${total}) $url"
  fi
}

# @function get_all_workspaces_status
# JSON status for both coder and kasm (dashboard utility contract).
get_all_workspaces_status() {
  local coder_json kasm_json
  coder_json=$(get_workspace_status coder --json)
  kasm_json=$(get_workspace_status kasm --json)
  printf '{"coder":%s,"kasm":%s}\n' "$coder_json" "$kasm_json"
}

# ## start_monitoring
# @command start-monitoring
# @command start-dashboard
# Deploys the complete observability and dashboard stack:
#
# - Headlamp (modern Kubernetes UI)
# - Grafana + DCGM metrics
# - Custom lab-dashboard (Next.js app with tasks, storage treemap, machine state)
#
# Prefers the helm/lab-dashboard chart (strategic Helm usage).
# Falls back to raw k8s/dev/dashboard/ manifests.
#
# Usage:
#   ./scripts/manage.sh start-monitoring
#   ./scripts/manage.sh urls
#
# Safety:
#   Dev components have resource limits to avoid starving inference.
#   Use stop-dev to cleanly remove only dev parts.
# @function start_monitoring
# Deploy observability and lab dashboard stack via monitoring.sh.

start_monitoring() {
  if type deploy_monitoring_stack &>/dev/null; then
    deploy_monitoring_stack
  else
    err "monitoring.sh not loaded — cannot deploy observability stack"
    return 1
  fi

  if type sso_enabled &>/dev/null && sso_enabled; then
    log "Observability stack ready behind Traefik SSO — run: ./scripts/manage.sh sso urls"
  else
    log "Observability stack ready. Custom UI: http://<spark0>:${DASHBOARD_PORT:-32082}  Grafana: :${GRAFANA_PORT:-32083}  Headlamp: :${HEADLAMP_PORT:-32084}  node-exporter: :${NODE_EXPORTER_PORT:-32090}"
  fi
}

# ## stop_dev_workloads
# @command stop-dev
# Removes all dev/monitoring Helm releases and dashboard manifests.
# Leaves inference workloads (jobs in ai-inference ns) untouched.
#
# Safe to run independently of stop for inference.
# @function stop_dev_workloads
# Remove dev/monitoring Helm releases and dashboard manifests.
# Leaves ai-inference workloads untouched.

stop_dev_workloads() {
  log "Stopping dev workspaces & dashboard (helm + manifests)..."
  # One namespace per helm invocation (multiple -n flags only honor the last).
  for rel in "${DEV_HELM_RELEASES[@]}"; do
    for ns in "${DEV_NAMESPACES[@]}"; do
      helm uninstall "$rel" -n "$ns" --ignore-not-found 2>/dev/null || true
    done
  done
  kubectl delete -f "${REPO_ROOT}/k8s/dev/dashboard/" -n dev --ignore-not-found=true || true
  kubectl delete deploy,svc,cm,sa,role,rolebinding -l app=lab-dashboard -n dev --ignore-not-found || true
  log "Dev components stopped."
}

# ensure_dev_namespaces and print_dev_status are provided by common.sh after deduplication.
# They are re-export friendly; redefine locally only if extension needed.
