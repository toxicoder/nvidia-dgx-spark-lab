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

  python3 - "$probes_path" "$spark0_ip" "$out_file" <<'PY'
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

probes_path, spark0_ip, out_file = sys.argv[1:4]

def load_yaml(path):
    text = Path(path).read_text()
    if yaml:
        return yaml.safe_load(text) or {}
    return {}

policy = load_yaml(probes_path)

scrape_configs = [
    {
        "job_name": "prometheus",
        "static_configs": [{"targets": ["localhost:9090"]}],
    },
    {
        "job_name": "node-exporter",
        "kubernetes_sd_configs": [{"role": "endpoints", "namespaces": {"names": ["monitoring"]}}],
        "relabel_configs": [
            {"source_labels": ["__meta_kubernetes_service_name"], "regex": "node-exporter-prometheus-node-exporter", "action": "keep"},
            {"source_labels": ["__meta_kubernetes_endpoint_port_name"], "regex": "metrics", "action": "keep"},
            {"source_labels": ["__meta_kubernetes_pod_node_name"], "target_label": "node"},
        ],
    },
    {
        "job_name": "dcgm",
        "kubernetes_sd_configs": [{"role": "endpoints", "namespaces": {"names": ["gpu-operator"]}}],
        "relabel_configs": [
            {"source_labels": ["__meta_kubernetes_service_name"], "regex": "nvidia-dcgm-exporter", "action": "keep"},
            {"source_labels": ["__meta_kubernetes_pod_node_name"], "target_label": "node"},
        ],
    },
    {
        "job_name": "kube-state-metrics",
        "kubernetes_sd_configs": [{"role": "endpoints", "namespaces": {"names": ["monitoring"]}}],
        "relabel_configs": [
            {"source_labels": ["__meta_kubernetes_service_name"], "regex": "kube-state-metrics", "action": "keep"},
        ],
    },
    {
        "job_name": "kubernetes-pods-annotated",
        "kubernetes_sd_configs": [{"role": "pod"}],
        "relabel_configs": [
            {"source_labels": ["__meta_kubernetes_pod_annotation_prometheus_io_scrape"], "regex": "true", "action": "keep"},
            {"source_labels": ["__meta_kubernetes_pod_annotation_prometheus_io_path"], "target_label": "__metrics_path__", "regex": "(.+)"},
            {"source_labels": ["__address__", "__meta_kubernetes_pod_annotation_prometheus_io_port"], "regex": "([^:]+)(?::\\d+)?;(\\d+)", "replacement": "$1:$2", "target_label": "__address__"},
            {"source_labels": ["__meta_kubernetes_namespace"], "target_label": "namespace"},
            {"source_labels": ["__meta_kubernetes_pod_name"], "target_label": "pod"},
            {"source_labels": ["__meta_kubernetes_pod_label_app"], "target_label": "app"},
        ],
    },
    {
        "job_name": "kubernetes-services-annotated",
        "kubernetes_sd_configs": [{"role": "service"}],
        "relabel_configs": [
            {"source_labels": ["__meta_kubernetes_service_annotation_prometheus_io_scrape"], "regex": "true", "action": "keep"},
            {"source_labels": ["__meta_kubernetes_service_annotation_prometheus_io_path"], "target_label": "__metrics_path__", "regex": "(.+)"},
            {"source_labels": ["__address__", "__meta_kubernetes_service_annotation_prometheus_io_port"], "regex": "([^:]+)(?::\\d+)?;(\\d+)", "replacement": "$1:$2", "target_label": "__address__"},
            {"source_labels": ["__meta_kubernetes_namespace"], "target_label": "namespace"},
            {"source_labels": ["__meta_kubernetes_service_name"], "target_label": "service"},
        ],
    },
    {
        "job_name": "traefik",
        "kubernetes_sd_configs": [{"role": "endpoints", "namespaces": {"names": ["traefik"]}}],
        "relabel_configs": [
            {"source_labels": ["__meta_kubernetes_service_name"], "regex": "traefik", "action": "keep"},
            {"source_labels": ["__meta_kubernetes_endpoint_port_name"], "regex": "metrics", "action": "keep"},
        ],
    },
    {
        "job_name": "ray-head",
        "kubernetes_sd_configs": [{"role": "service", "namespaces": {"names": ["ai-inference"]}}],
        "metrics_path": "/metrics",
        "relabel_configs": [
            {"source_labels": ["__meta_kubernetes_service_name"], "regex": "ray-head", "action": "keep"},
        ],
    },
]

# Cluster HTTP probes via blackbox
cluster_targets = []
for probe in policy.get("cluster_probes", []):
    cluster_targets.append(f"{probe['service']}.{probe['namespace']}.svc.cluster.local:{probe['port']}")

if cluster_targets:
    scrape_configs.append({
        "job_name": "blackbox-cluster",
        "metrics_path": "/probe",
        "params": {"module": ["http_2xx"]},
        "static_configs": [{"targets": cluster_targets, "labels": {"probe_type": "cluster"}}],
        "relabel_configs": [
            {"source_labels": ["__address__"], "target_label": "__param_target"},
            {"source_labels": ["__param_target"], "target_label": "instance"},
            {"target_label": "__address__", "replacement": "blackbox-exporter-prometheus-blackbox-exporter.monitoring.svc.cluster.local:9115"},
        ],
    })

# Inference service probes
inf = policy.get("inference_probes", {})
inf_ns = inf.get("namespace", "ai-inference")
inf_port = inf.get("port", 8000)
inf_targets = [f"{svc}.{inf_ns}.svc.cluster.local:{inf_port}" for svc in inf.get("services", [])]
if inf_targets:
    scrape_configs.append({
        "job_name": "blackbox-inference",
        "metrics_path": "/probe",
        "params": {"module": ["http_2xx"]},
        "static_configs": [{"targets": inf_targets, "labels": {"probe_type": "inference"}}],
        "relabel_configs": [
            {"source_labels": ["__address__"], "target_label": "__param_target"},
            {"source_labels": ["__param_target"], "target_label": "instance"},
            {"target_label": "__address__", "replacement": "blackbox-exporter-prometheus-blackbox-exporter.monitoring.svc.cluster.local:9115"},
        ],
    })

# MCP NodePort probes (via spark0 host IP)
mcp_targets = [f"{spark0_ip}:{p['port']}" for p in policy.get("mcp_nodeport_probes", [])]
if mcp_targets:
    scrape_configs.append({
        "job_name": "blackbox-mcp",
        "metrics_path": "/probe",
        "params": {"module": ["http_2xx"]},
        "static_configs": [{"targets": mcp_targets, "labels": {"probe_type": "mcp"}}],
        "relabel_configs": [
            {"source_labels": ["__address__"], "target_label": "__param_target"},
            {"source_labels": ["__param_target"], "target_label": "instance"},
            {"target_label": "__address__", "replacement": "blackbox-exporter-prometheus-blackbox-exporter.monitoring.svc.cluster.local:9115"},
        ],
    })

# Host probes (Hermes)
host_targets = []
for probe in policy.get("host_probes", []):
    host_targets.append(probe["url"].replace("{{SPARK0_IP}}", spark0_ip))
if host_targets:
    scrape_configs.append({
        "job_name": "blackbox-host",
        "metrics_path": "/probe",
        "params": {"module": ["http_2xx"]},
        "static_configs": [{"targets": host_targets, "labels": {"probe_type": "host"}}],
        "relabel_configs": [
            {"source_labels": ["__address__"], "target_label": "__param_target"},
            {"source_labels": ["__param_target"], "target_label": "instance"},
            {"target_label": "__address__", "replacement": "blackbox-exporter-prometheus-blackbox-exporter.monitoring.svc.cluster.local:9115"},
        ],
    })

prometheus_yml = {
    "global": {"scrape_interval": "30s", "evaluation_interval": "30s"},
    "scrape_configs": scrape_configs,
}

# Write ConfigMap manifest
cm = {
    "apiVersion": "v1",
    "kind": "ConfigMap",
    "metadata": {
        "name": "prometheus-scrape-config",
        "namespace": "monitoring",
        "labels": {"app.kubernetes.io/part-of": "spark-lab-monitoring"},
    },
    "data": {
        "prometheus.yml": yaml.dump(prometheus_yml, default_flow_style=False) if yaml else str(prometheus_yml),
    },
}

header = (
    "# Purpose: Prometheus scrape configuration ConfigMap for the monitoring stack\n"
    "# Source of truth: generated from config/monitoring-probes.yaml via monitoring_generate_prometheus_scrape_config\n"
    "# Regenerate: monitoring-stack.sh or manage.sh start-monitoring\n"
    "# Safety: read-only scrape targets; no cluster credentials\n\n"
)
if yaml:
    Path(out_file).write_text(header + yaml.dump_all([cm], default_flow_style=False))
else:
    Path(out_file).write_text(header + str(cm))

print(out_file)
PY
}

# @function monitoring_apply_prometheus_scrape_config
monitoring_apply_prometheus_scrape_config() {
  local generated
  generated="$(monitoring_generate_prometheus_scrape_config)"
  kubectl apply -f "$generated"
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

  python3 - "$local_d" "$public_d" "$primary" "$host" "${GRAFANA_PORT:-32083}" "${HEADLAMP_PORT:-32084}" "$https_port" <<'PY'
import json, subprocess, sys

local_d, public_d, primary, host, grafana_port, headlamp_port, https_port = sys.argv[1:8]
domain = public_d if primary == "public" and public_d else local_d

DASHBOARDS = [
    {"uid": "spark-overview", "title": "Lab Overview", "path": "/d/spark-overview"},
    {"uid": "spark-nodes", "title": "DGX Nodes", "path": "/d/spark-nodes"},
    {"uid": "spark-gpu", "title": "GPU Cluster", "path": "/d/spark-gpu"},
    {"uid": "spark-k8s", "title": "Kubernetes", "path": "/d/spark-k8s"},
    {"uid": "spark-inference", "title": "Inference", "path": "/d/spark-inference"},
    {"uid": "spark-platform", "title": "Platform Services", "path": "/d/spark-platform"},
    {"uid": "spark-dev-agent", "title": "Dev & Agent Stack", "path": "/d/spark-dev-agent"},
    {"uid": "spark-storage-net", "title": "Storage & Network", "path": "/d/spark-storage-net"},
]

def sh(*args):
    try:
        return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""

def release_status(release, ns="monitoring"):
    installed = release in sh("helm", "list", "-n", ns, "-q").split()
    if not installed:
        return {"name": release, "state": "stopped", "readyPods": 0, "totalPods": 0, "helmInstalled": False}
    ready = len([x for x in sh("kubectl", "get", "pods", "-n", ns, "-l", f"app.kubernetes.io/instance={release}", "-o", "jsonpath={range .items[?(@.status.phase=='Running')]}{.metadata.name}{'\\n'}{end}").split('\n') if x])
    total = len([x for x in sh("kubectl", "get", "pods", "-n", ns, "-l", f"app.kubernetes.io/instance={release}", "-o", "jsonpath={.items[*].metadata.name}").split() if x])
    state = "starting"
    if ready > 0 and ready == total and total > 0:
        state = "running"
    elif total == 0:
        state = "stopped"
    return {"name": release, "state": state, "readyPods": ready, "totalPods": total, "helmInstalled": True}

def dcgm_status():
    ready = len([x for x in sh("kubectl", "get", "pods", "-n", "gpu-operator", "-l", "app=nvidia-dcgm-exporter", "-o", "jsonpath={range .items[?(@.status.phase=='Running')]}{.metadata.name}{'\\n'}{end}").split('\n') if x])
    total = len([x for x in sh("kubectl", "get", "pods", "-n", "gpu-operator", "-l", "app=nvidia-dcgm-exporter", "-o", "jsonpath={.items[*].metadata.name}").split() if x])
    state = "stopped"
    if ready > 0:
        state = "running"
    elif total > 0:
        state = "starting"
    return {"name": "dcgm-exporter", "state": state, "readyPods": ready, "totalPods": total, "helmInstalled": total > 0}

def service_urls(name):
    port = int(https_port)
    local_url = f"https://{name}.{local_d}:{port}/"
    urls = {"local": local_url, "nodeport": f"http://{host}:{grafana_port if name == 'grafana' else headlamp_port}"}
    if public_d:
        urls["public"] = f"https://{name}.{public_d}/"
    urls["sso"] = urls["public"] if primary == "public" and public_d else local_url
    return urls

grafana = release_status("grafana")
grafana["urls"] = service_urls("grafana")
headlamp = release_status("headlamp")
headlamp["urls"] = service_urls("headlamp")

status = {
    "grafana": grafana,
    "headlamp": headlamp,
    "prometheus": release_status("prometheus"),
    "nodeExporter": release_status("node-exporter"),
    "kubeStateMetrics": release_status("kube-state-metrics"),
    "blackboxExporter": release_status("blackbox-exporter"),
    "dcgmExporter": dcgm_status(),
    "dashboards": [
        {
            "uid": d["uid"],
            "title": d["title"],
            "url": f"https://grafana.{domain}:{https_port}{d['path']}?orgId=1&refresh=30s" if not (primary == "public" and public_d) else f"https://grafana.{public_d}{d['path']}?orgId=1&refresh=30s",
            "localUrl": f"https://grafana.{local_d}:{https_port}{d['path']}?orgId=1&refresh=30s",
            "publicUrl": f"https://grafana.{public_d}{d['path']}?orgId=1&refresh=30s" if public_d else None,
            "nodeportUrl": f"http://{host}:{grafana_port}{d['path']}?orgId=1&refresh=30s",
        }
        for d in DASHBOARDS
    ],
}
print(json.dumps(status))
PY
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

  python3 - "$prom_pod" "${MONITORING_NAMESPACE}" <<'PY'
import json, subprocess, sys

pod, ns = sys.argv[1:3]
required_jobs = {"node-exporter", "kube-state-metrics", "prometheus"}

def query(expr):
    try:
        out = subprocess.check_output([
            "kubectl", "exec", "-n", ns, pod, "--",
            "wget", "-qO-", f"http://localhost:9090/api/v1/query?query={expr}"
        ], text=True, stderr=subprocess.DEVNULL)
        return json.loads(out)
    except Exception:
        return {}

result = query("up")
series = result.get("data", {}).get("result", [])
jobs_up = {}
for item in series:
    job = item.get("metric", {}).get("job", "")
    val = item.get("value", [None, "0"])[1]
    if val == "1":
        jobs_up[job] = jobs_up.get(job, 0) + 1

missing = sorted(required_jobs - set(jobs_up.keys()))
report = {
    "ok": len(missing) == 0,
    "jobsUp": jobs_up,
    "missingRequiredJobs": missing,
    "totalTargetsUp": sum(jobs_up.values()),
}
print(json.dumps(report))
PY
}