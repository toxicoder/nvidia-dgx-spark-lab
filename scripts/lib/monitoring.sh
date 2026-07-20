#!/usr/bin/env bash
#
# ## Monitoring stack logic
#
# Unified observability deploy: node-exporter, kube-state-metrics, blackbox-exporter,
# Prometheus, Grafana (provisioned), Headlamp, and lab-dashboard.
#
# Used by manage.sh start-monitoring and ansible/roles/monitoring.

MONITORING_NAMESPACE=${MONITORING_NAMESPACE:-monitoring}
PROMETHEUS_CHART_VERSION=${PROMETHEUS_CHART_VERSION:-25.27.0}
KUBE_STATE_METRICS_CHART_VERSION=${KUBE_STATE_METRICS_CHART_VERSION:-5.27.0}
NODE_EXPORTER_CHART_VERSION=${NODE_EXPORTER_CHART_VERSION:-1.8.2}
BLACKBOX_EXPORTER_CHART_VERSION=${BLACKBOX_EXPORTER_CHART_VERSION:-9.1.0}
GRAFANA_CHART_VERSION=${GRAFANA_CHART_VERSION:-7.3.0}
HEADLAMP_CHART_VERSION=${HEADLAMP_CHART_VERSION:-0.25.0}

MONITORING_HELM_RELEASES=(node-exporter kube-state-metrics blackbox-exporter prometheus grafana headlamp)

# @function monitoring_helm_release_names
monitoring_helm_release_names() {
  printf '%s\n' "${MONITORING_HELM_RELEASES[@]}"
}

: "${REPO_ROOT:=$(if [[ -n "${BASH_SOURCE[0]:-}" ]]; then cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd; else echo "${PWD}"; fi)}"

# @function monitoring_repo_root
monitoring_repo_root() {
  if [[ -n "${REPO_ROOT:-}" ]]; then
    echo "${REPO_ROOT}"
    return 0
  fi
  if [[ -n "${BASH_SOURCE[0]:-}" ]]; then echo "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; else echo "${PWD}"; fi
}

# @function monitoring_probes_path
monitoring_probes_path() {
  echo "$(monitoring_repo_root)/config/monitoring-probes.yaml"
}

# @function monitoring_grafana_dashboards_dir
monitoring_grafana_dashboards_dir() {
  echo "$(monitoring_repo_root)/config/grafana/dashboards"
}

# @function monitoring_spark0_ip
monitoring_spark0_ip() {
  if [[ -n "${LAB_SPARK0_IP:-}" ]]; then
    echo "${LAB_SPARK0_IP}"
    return 0
  fi
  local ip
  ip=$(kubectl get node spark0 -o jsonpath='{.status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || true)
  if [[ -z "$ip" ]]; then
    ip=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || true)
  fi
  echo "${ip:-127.0.0.1}"
}

# @function ensure_monitoring_namespaces
ensure_monitoring_namespaces() {
  require_kubectl
  kubectl get ns "${MONITORING_NAMESPACE}" >/dev/null 2>&1 || \
    kubectl apply -f "${REPO_ROOT}/k8s/base/namespaces-dev.yaml"
  kubectl get ns dev >/dev/null 2>&1 || \
    kubectl apply -f "${REPO_ROOT}/k8s/base/namespaces-dev.yaml"
}

# @function monitoring_helm_repo_add
monitoring_helm_repo_add() {
  require_helm
  helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
  helm repo add grafana https://grafana.github.io/helm-charts >/dev/null 2>&1 || true
  helm repo add headlamp https://kubernetes-sigs.github.io/headlamp/ >/dev/null 2>&1 || true
  helm repo update >/dev/null 2>&1 || true
}

# @function monitoring_apply_grafana_dashboards_configmap
monitoring_apply_grafana_dashboards_configmap() {
  local dir
  dir="$(monitoring_grafana_dashboards_dir)"
  if [[ ! -d "$dir" ]]; then
    warn "Grafana dashboards dir missing: $dir"
    return 0
  fi
  kubectl create configmap grafana-dashboards-spark-lab -n "${MONITORING_NAMESPACE}" \
    --from-file="${dir}/" \
    --dry-run=client -o yaml | kubectl apply -f -
}

# @function monitoring_generate_prometheus_scrape_config
# Writes prometheus-scrape-config.yaml (override path via MONITORING_SCRAPE_CONFIG_OUT).
monitoring_generate_prometheus_scrape_config() {
  local spark0_ip probes_path out_file
  spark0_ip="$(monitoring_spark0_ip)"
  probes_path="$(monitoring_probes_path)"
  # Prefer env override over unused $1 (callers never pass args; keeps shellcheck SC2120 clean).
  out_file="${MONITORING_SCRAPE_CONFIG_OUT:-$(monitoring_repo_root)/k8s/monitoring/prometheus-scrape-config.yaml}"

  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/prometheus_scrape.py" "$probes_path" "$spark0_ip" "$out_file"
}

# @function monitoring_apply_prometheus_scrape_config
monitoring_apply_prometheus_scrape_config() {
  local generated mon_dir
  generated="$(monitoring_generate_prometheus_scrape_config)"
  mon_dir="$(dirname "$generated")"
  kubectl apply -k "$mon_dir"
}

# @function deploy_node_exporter
deploy_node_exporter() {
  monitoring_helm_repo_add
  local extra=()
  if [[ -f "${REPO_ROOT}/ansible/files/node-exporter-values.yaml" ]]; then
    extra+=(-f "${REPO_ROOT}/ansible/files/node-exporter-values.yaml")
  else
    extra+=(--set service.type=NodePort --set service.nodePort="${NODE_EXPORTER_PORT:-32090}")
  fi
  helm upgrade --install node-exporter prometheus-community/prometheus-node-exporter \
    -n "${MONITORING_NAMESPACE}" \
    --version "${NODE_EXPORTER_CHART_VERSION}" \
    "${extra[@]}" \
    --wait --timeout 5m || true
}

# @function deploy_kube_state_metrics
deploy_kube_state_metrics() {
  monitoring_helm_repo_add
  local extra=()
  if [[ -f "${REPO_ROOT}/ansible/files/kube-state-metrics-values.yaml" ]]; then
    extra+=(-f "${REPO_ROOT}/ansible/files/kube-state-metrics-values.yaml")
  fi
  helm upgrade --install kube-state-metrics prometheus-community/kube-state-metrics \
    -n "${MONITORING_NAMESPACE}" \
    --version "${KUBE_STATE_METRICS_CHART_VERSION}" \
    "${extra[@]}" \
    --wait --timeout 5m || true
}

# @function deploy_blackbox_exporter
deploy_blackbox_exporter() {
  monitoring_helm_repo_add
  local extra=()
  if [[ -f "${REPO_ROOT}/ansible/files/blackbox-exporter-values.yaml" ]]; then
    extra+=(-f "${REPO_ROOT}/ansible/files/blackbox-exporter-values.yaml")
  fi
  helm upgrade --install blackbox-exporter prometheus-community/prometheus-blackbox-exporter \
    -n "${MONITORING_NAMESPACE}" \
    --version "${BLACKBOX_EXPORTER_CHART_VERSION}" \
    "${extra[@]}" \
    --wait --timeout 5m || true
}

# @function deploy_prometheus
deploy_prometheus() {
  monitoring_helm_repo_add
  monitoring_apply_prometheus_scrape_config
  local extra=()
  if [[ -f "${REPO_ROOT}/ansible/files/prometheus-values.yaml" ]]; then
    extra+=(-f "${REPO_ROOT}/ansible/files/prometheus-values.yaml")
  fi
  local runtime_cfg="${REPO_ROOT}/k8s/monitoring/.prometheus-runtime.yml"
  mkdir -p "$(dirname "$runtime_cfg")"
  kubectl get configmap prometheus-scrape-config -n "${MONITORING_NAMESPACE}" \
    -o jsonpath='{.data.prometheus\.yml}' > "$runtime_cfg" 2>/dev/null || true
  if [[ ! -s "$runtime_cfg" ]]; then
    monitoring_generate_prometheus_scrape_config >/dev/null
    kubectl get configmap prometheus-scrape-config -n "${MONITORING_NAMESPACE}" \
      -o jsonpath='{.data.prometheus\.yml}' > "$runtime_cfg" 2>/dev/null || true
  fi
  if [[ -s "$runtime_cfg" ]]; then
    extra+=(--set-file "serverFiles.prometheus\\.yml=${runtime_cfg}")
  fi

  helm upgrade --install prometheus prometheus-community/prometheus \
    -n "${MONITORING_NAMESPACE}" \
    --version "${PROMETHEUS_CHART_VERSION}" \
    "${extra[@]}" \
    --wait --timeout 8m || true
}

# @function deploy_grafana_monitoring
deploy_grafana_monitoring() {
  monitoring_helm_repo_add
  monitoring_apply_grafana_dashboards_configmap

  local svc_type="NodePort"
  local extra=()
  if type sso_enabled &>/dev/null && sso_enabled; then
    svc_type="ClusterIP"
  fi

  local grafana_values
  grafana_values="$(lab_ansible_values_file grafana-values.yaml 2>/dev/null || true)"
  if [[ -n "$grafana_values" ]]; then
    extra+=(-f "$grafana_values")
  fi

  if [[ "$svc_type" == "NodePort" ]]; then
    extra+=(--set service.type=NodePort --set service.nodePort="${GRAFANA_PORT:-32083}")
  fi
  extra+=(--set adminPassword="${GRAFANA_ADMIN_PASSWORD:-admin}")

  helm upgrade --install grafana grafana/grafana \
    -n "${MONITORING_NAMESPACE}" \
    --version "${GRAFANA_CHART_VERSION}" \
    "${extra[@]}" \
    --wait --timeout 5m
}

# @function deploy_headlamp_monitoring
deploy_headlamp_monitoring() {
  monitoring_helm_repo_add
  local svc_type="NodePort"
  local extra=()
  if type sso_enabled &>/dev/null && sso_enabled; then
    svc_type="ClusterIP"
    if kubectl get secret sso-oidc-clients -n auth &>/dev/null; then
      extra+=(--set-string "config.oidc.clientID=headlamp")
      extra+=(--set "config.oidc.clientSecretFromSecret.enabled=true")
      extra+=(--set "config.oidc.clientSecretFromSecret.secretName=sso-oidc-clients")
      extra+=(--set "config.oidc.clientSecretFromSecret.secretKey=headlamp-client-secret")
      extra+=(--set-string "config.oidc.issuerURL=https://$(lab_fqdn auth 2>/dev/null || echo "auth.${LAB_SSO_DOMAIN:-lab.local}")")
    fi
  else
    extra+=(--set service.type=NodePort --set service.nodePort="${HEADLAMP_PORT:-32084}")
  fi
  extra+=(--set service.type="${svc_type}")

  helm upgrade --install headlamp headlamp/headlamp \
    -n "${MONITORING_NAMESPACE}" \
    --version "${HEADLAMP_CHART_VERSION}" \
    "${extra[@]}" \
    --wait --timeout 5m || true
}

# @function deploy_lab_dashboard_monitoring
deploy_lab_dashboard_monitoring() {
  local svc_type="NodePort"
  local dashboard_extra=()
  if type sso_enabled &>/dev/null && sso_enabled; then
    svc_type="ClusterIP"
    dashboard_extra+=(--set "sso.enabled=true")
    dashboard_extra+=(--set "sso.domain=$(lab_local_domain 2>/dev/null || echo "${LAB_SSO_DOMAIN:-lab.local}")")
    dashboard_extra+=(--set "sso.trustProxyAuth=true")
    dashboard_extra+=(--set "env.TRUST_PROXY_AUTH=1")
    dashboard_extra+=(--set "env.LAB_LOCAL_DOMAIN=$(lab_local_domain 2>/dev/null || echo "${LAB_SSO_DOMAIN:-lab.local}")")
    dashboard_extra+=(--set "env.LAB_PUBLIC_DOMAIN=$(lab_public_domain 2>/dev/null || true)")
    dashboard_extra+=(--set "env.LAB_PRIMARY_DOMAIN=$(lab_primary_domain 2>/dev/null || echo local)")
    dashboard_extra+=(--set "env.LAB_EMAIL_DOMAIN=$(lab_email_domain 2>/dev/null || echo lab.local)")
    dashboard_extra+=(--set "env.GRAFANA_PORT=${GRAFANA_PORT:-32083}")
    dashboard_extra+=(--set "env.HEADLAMP_PORT=${HEADLAMP_PORT:-32084}")
  fi

  if [[ -d "${REPO_ROOT}/helm/lab-dashboard" ]]; then
    local dash_svc_args=(--set "service.type=${svc_type}")
    if [[ "$svc_type" == "NodePort" ]]; then
      dash_svc_args+=(--set "service.nodePort=${DASHBOARD_PORT:-32082}")
    fi
    helm upgrade --install lab-dashboard "${REPO_ROOT}/helm/lab-dashboard" \
      -n dev \
      --set image.repository=lab-dashboard \
      --set image.tag=local \
      "${dash_svc_args[@]}" \
      "${dashboard_extra[@]}" \
      --wait --timeout 5m || true
  else
    kubectl apply -f "${REPO_ROOT}/k8s/dev/dashboard/" -n dev || true
  fi
}

# @function deploy_monitoring_stack
deploy_monitoring_stack() {
  require_helm
  require_kubectl
  log "Deploying observability stack (exporters + Prometheus + Grafana + Headlamp)..."
  ensure_monitoring_namespaces
  deploy_node_exporter
  deploy_kube_state_metrics
  deploy_blackbox_exporter
  deploy_prometheus
  deploy_grafana_monitoring
  deploy_headlamp_monitoring
  deploy_lab_dashboard_monitoring
  log "Observability stack deployed."
}

# @function _monitoring_release_ready
_monitoring_release_ready() {
  local release="$1"
  local ns="${2:-${MONITORING_NAMESPACE}}"
  if ! helm list -n "$ns" -q 2>/dev/null | grep -qx "$release"; then
    echo "0 0 stopped"
    return 0
  fi
  local ready total
  ready=$(kubectl get pods -n "$ns" -l "app.kubernetes.io/instance=${release}" \
    -o jsonpath='{range .items[?(@.status.phase=="Running")]}{.metadata.name}{"\n"}{end}' 2>/dev/null | grep -c . || echo 0)
  total=$(kubectl get pods -n "$ns" -l "app.kubernetes.io/instance=${release}" \
    -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | wc -w | tr -d ' ')
  local state="starting"
  if [[ "${ready:-0}" -gt 0 && "${ready:-0}" -eq "${total:-0}" && "${total:-0}" -gt 0 ]]; then
    state="running"
  elif [[ "${total:-0}" -eq 0 ]]; then
    state="stopped"
  fi
  echo "${ready:-0} ${total:-0} ${state}"
}

# @function _monitoring_dcgm_ready
_monitoring_dcgm_ready() {
  local ready
  ready=$(kubectl get pods -n gpu-operator -l app=nvidia-dcgm-exporter \
    -o jsonpath='{range .items[?(@.status.phase=="Running")]}{.metadata.name}{"\n"}{end}' 2>/dev/null | grep -c . || echo 0)
  local total
  total=$(kubectl get pods -n gpu-operator -l app=nvidia-dcgm-exporter \
    -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | wc -w | tr -d ' ')
  local state="stopped"
  if [[ "${ready:-0}" -gt 0 ]]; then state="running"
  elif [[ "${total:-0}" -gt 0 ]]; then state="starting"
  fi
  echo "${ready:-0} ${total:-0} ${state}"
}

# @function get_monitoring_status_json
get_monitoring_status_json() {
  local local_d public_d primary host https_port
  local_d="$(lab_local_domain 2>/dev/null || echo "${LAB_SSO_DOMAIN:-lab.local}")"
  public_d="$(lab_public_domain 2>/dev/null || true)"
  primary="$(lab_primary_domain 2>/dev/null || echo local)"
  host="${LAB_SSO_HOST:-${DASHBOARD_HOST:-localhost}}"
  https_port="$(lab_sso_https_port 2>/dev/null || echo 32443)"

  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/monitoring_get_monitoring_status_json.py" "$local_d" "$public_d" "$primary" "$host" "${GRAFANA_PORT:-32083}" "${HEADLAMP_PORT:-32084}" "$https_port"
}

# @function verify_scrape_targets
verify_scrape_targets() {
  require_kubectl
  local prom_pod
  prom_pod=$(kubectl get pods -n "${MONITORING_NAMESPACE}" -l "app.kubernetes.io/name=prometheus" \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  if [[ -z "$prom_pod" ]]; then
    err "Prometheus pod not found in ${MONITORING_NAMESPACE}"
    return 1
  fi

  python3 "${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/scripts/lib/py/monitoring_verify_scrape_targets.py" "$prom_pod" "${MONITORING_NAMESPACE}"
}