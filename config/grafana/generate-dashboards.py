#!/usr/bin/env python3
"""Generate provisioned Grafana dashboards for DGX Spark Lab.

Builds JSON dashboard definitions for Prometheus-backed observability panels
covering cluster health, GPU metrics, Kubernetes workloads, inference, platform
services, dev/agent tooling, and storage/network views. Output is written to
``config/grafana/dashboards/`` for provisioning by Grafana.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

OUT = Path(__file__).parent / "dashboards"
OUT.mkdir(parents=True, exist_ok=True)


def _load_domains() -> dict[str, Any]:
    """Load lab domain config for external dashboard links.

    Returns:
        Mapping with a ``dashboard_url`` key pointing at the lab observability
        section on the primary apex domain.

    Raises:
        FileNotFoundError: If neither the YAML nor JSON config file exists.
        json.JSONDecodeError: If the JSON fallback file is malformed.
    """
    cfg_path = Path(
        os.environ.get(
            "LAB_DOMAINS_CONFIG",
            Path(__file__).resolve().parents[1] / "lab-domains.yaml",
        )
    )
    try:
        import yaml

        data = yaml.safe_load(cfg_path.read_text()) or {}
    except Exception:
        data = json.loads(cfg_path.with_suffix(".json").read_text())
    local = data.get("local_domain", "lab.local")
    public = data.get("public_domain") or ""
    primary = data.get("primary", "local")
    sso = data.get("sso") or {}
    port = int(sso.get("https_port", 32443))
    apex = public if primary == "public" and public else local
    host = f"dashboard.{apex}"
    if primary == "public" and public:
        url = f"https://{host}/#observability"
    else:
        url = f"https://{host}:{port}/#observability"
    return {"dashboard_url": url}

DS: dict[str, str] = {"type": "prometheus", "uid": "Prometheus"}


def panel_stat(
    id_: int,
    title: str,
    expr: str,
    x: int,
    y: int,
    w: int = 4,
    h: int = 4,
    unit: str = "none",
) -> dict[str, Any]:
    """Build a Grafana stat panel definition.

    Args:
        id_: Unique panel identifier within the dashboard.
        title: Panel title shown in Grafana.
        expr: PromQL expression for the panel target.
        x: Grid X position.
        y: Grid Y position.
        w: Panel width in grid units.
        h: Panel height in grid units.
        unit: Grafana field unit (for example ``percent`` or ``celsius``).

    Returns:
        Grafana panel JSON object.
    """
    return {
        "id": id_,
        "type": "stat",
        "title": title,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "datasource": DS,
        "targets": [{"expr": expr, "refId": "A"}],
        "fieldConfig": {
            "defaults": {
                "unit": unit,
                "thresholds": {
                    "mode": "absolute",
                    "steps": [
                        {"color": "green", "value": None},
                        {"color": "yellow", "value": 75},
                        {"color": "red", "value": 90},
                    ],
                },
            }
        },
        "options": {"reduceOptions": {"calcs": ["lastNotNull"]}, "colorMode": "background"},
    }


def panel_timeseries(
    id_: int,
    title: str,
    expr: str,
    x: int,
    y: int,
    w: int = 12,
    h: int = 8,
    unit: str = "none",
) -> dict[str, Any]:
    """Build a Grafana time-series panel definition.

    Args:
        id_: Unique panel identifier within the dashboard.
        title: Panel title shown in Grafana.
        expr: PromQL expression for the panel target.
        x: Grid X position.
        y: Grid Y position.
        w: Panel width in grid units.
        h: Panel height in grid units.
        unit: Grafana field unit (for example ``percent`` or ``Bps``).

    Returns:
        Grafana panel JSON object.
    """
    return {
        "id": id_,
        "type": "timeseries",
        "title": title,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "datasource": DS,
        "targets": [{"expr": expr, "legendFormat": "{{instance}}", "refId": "A"}],
        "fieldConfig": {"defaults": {"unit": unit}},
    }


def panel_row(id_: int, title: str, y: int) -> dict[str, Any]:
    """Build a Grafana row panel used to group related panels.

    Args:
        id_: Unique panel identifier within the dashboard.
        title: Row title shown in Grafana.
        y: Grid Y position.

    Returns:
        Grafana row panel JSON object.
    """
    return {"id": id_, "type": "row", "title": title, "gridPos": {"h": 1, "w": 24, "x": 0, "y": y}, "collapsed": False}


def base(
    uid: str,
    title: str,
    tags: list[str],
    panels: list[dict[str, Any]],
    refresh: str = "30s",
    links: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """Build the top-level Grafana dashboard object.

    Args:
        uid: Stable dashboard UID used in Grafana URLs.
        title: Dashboard title.
        tags: Grafana tags applied to the dashboard.
        panels: Panel definitions composing the dashboard layout.
        refresh: Auto-refresh interval.
        links: Optional dashboard links; defaults to cross-dashboard navigation.

    Returns:
        Complete Grafana dashboard JSON object.
    """
    return {
        "uid": uid,
        "title": title,
        "tags": tags,
        "timezone": "browser",
        "schemaVersion": 39,
        "version": 1,
        "refresh": refresh,
        "editable": False,
        "graphTooltip": 1,
        "time": {"from": "now-6h", "to": "now"},
        "links": links or dashboard_links(uid),
        "templating": {
            "list": [
                {
                    "name": "node",
                    "type": "query",
                    "datasource": DS,
                    "query": "label_values(node_uname_info, nodename)",
                    "refresh": 2,
                    "includeAll": True,
                    "multi": True,
                }
            ]
        },
        "panels": panels,
    }


def dashboard_links(current_uid: str) -> list[dict[str, str]]:
    """Build cross-links between lab dashboards.

    Args:
        current_uid: UID of the dashboard being generated; omitted from links.

    Returns:
        List of Grafana dashboard link objects.
    """
    all_dash = [
        ("spark-overview", "Overview"),
        ("spark-nodes", "DGX Nodes"),
        ("spark-gpu", "GPU Cluster"),
        ("spark-k8s", "Kubernetes"),
        ("spark-inference", "Inference"),
        ("spark-platform", "Platform"),
        ("spark-dev-agent", "Dev & Agent"),
        ("spark-storage-net", "Storage & Network"),
    ]
    links: list[dict[str, Any]] = []
    for uid, title in all_dash:
        if uid != current_uid:
            links.append({"title": title, "url": f"/d/{uid}", "type": "link"})
    links.append(
        {
            "title": "Lab Dashboard",
            "url": _load_domains()["dashboard_url"],
            "type": "link",
            "targetBlank": True,
        }
    )
    return links


DASHBOARDS: dict[str, dict[str, Any]] = {
    "00-lab-overview.json": base(
        "spark-overview",
        "DGX Spark Lab — Enterprise Overview",
        ["spark-lab", "overview"],
        [
            panel_stat(1, "Nodes Up", 'count(kube_node_status_condition{condition="Ready",status="true"})', 0, 0),
            panel_stat(2, "GPUs Allocatable", 'sum(kube_node_status_allocatable{resource="nvidia_com_gpu"}) or vector(0)', 4, 0),
            panel_stat(3, "GPU Util Avg %", "avg(DCGM_FI_DEV_GPU_UTIL) or vector(0)", 8, 0, unit="percent"),
            panel_stat(4, "Inference Probes Up", 'sum(probe_success{job=~"blackbox-inference.*"}) or vector(0)', 12, 0),
            panel_stat(5, "SSO Routes Healthy %", "avg(probe_success{job=~\"blackbox.*\"}) * 100", 16, 0, unit="percent"),
            panel_stat(6, "Failed Jobs", 'sum(kube_job_status_failed) or vector(0)', 20, 0),
            panel_row(10, "Cluster Health", 4),
            panel_timeseries(11, "CPU Utilization %", '100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)', 0, 5, 12),
            panel_timeseries(12, "Memory Used %", "(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100", 12, 5, 12, unit="percent"),
            panel_row(20, "GPU & Inference", 13),
            panel_timeseries(21, "GPU Utilization by Node", "avg by (node) (DCGM_FI_DEV_GPU_UTIL)", 0, 14, 12, unit="percent"),
            panel_timeseries(22, "vLLM Running Requests", 'sum(vllm:num_requests_running) or vector(0)', 12, 14, 12),
        ],
    ),
    "01-dgx-nodes.json": base(
        "spark-nodes",
        "DGX Spark — Node Metrics",
        ["spark-lab", "nodes"],
        [
            panel_row(1, "Per-Node Resources", 0),
            panel_timeseries(2, "CPU Util %", '100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle",nodename=~"$node"}[5m])) * 100)', 0, 1, 12, unit="percent"),
            panel_timeseries(3, "Memory Used %", '(1 - node_memory_MemAvailable_bytes{nodename=~"$node"} / node_memory_MemTotal_bytes{nodename=~"$node"}) * 100', 12, 1, 12, unit="percent"),
            panel_timeseries(4, "Disk Util %", '(1 - node_filesystem_avail_bytes{mountpoint="/",nodename=~"$node"} / node_filesystem_size_bytes{mountpoint="/",nodename=~"$node"}) * 100', 0, 9, 12, unit="percent"),
            panel_timeseries(5, "Network RX", 'rate(node_network_receive_bytes_total{device!~"lo|veth.*",nodename=~"$node"}[5m])', 12, 9, 12, unit="Bps"),
            panel_timeseries(6, "Load Average (1m)", 'node_load1{nodename=~"$node"}', 0, 17, 24),
        ],
    ),
    "02-gpu-cluster.json": base(
        "spark-gpu",
        "DGX Spark — GPU Cluster (DCGM)",
        ["spark-lab", "gpu"],
        [
            panel_stat(1, "Avg GPU Util", "avg(DCGM_FI_DEV_GPU_UTIL)", 0, 0, unit="percent"),
            panel_stat(2, "Avg GPU Memory %", "avg(DCGM_FI_DEV_FB_USED / (DCGM_FI_DEV_FB_USED + DCGM_FI_DEV_FB_FREE)) * 100", 4, 0, unit="percent"),
            panel_stat(3, "Total Power (W)", "sum(DCGM_FI_DEV_POWER_USAGE)", 8, 0, unit="watt"),
            panel_stat(4, "Max Temp (C)", "max(DCGM_FI_DEV_GPU_TEMP)", 12, 0, unit="celsius"),
            panel_row(10, "Per-GPU Metrics", 4),
            panel_timeseries(11, "GPU Utilization", "DCGM_FI_DEV_GPU_UTIL", 0, 5, 12, unit="percent"),
            panel_timeseries(12, "GPU Memory Used (MiB)", "DCGM_FI_DEV_FB_USED", 12, 5, 12, unit="decmbytes"),
            panel_timeseries(13, "GPU Power", "DCGM_FI_DEV_POWER_USAGE", 0, 13, 12, unit="watt"),
            panel_timeseries(14, "GPU Temperature", "DCGM_FI_DEV_GPU_TEMP", 12, 13, 12, unit="celsius"),
        ],
        refresh="10s",
    ),
    "03-kubernetes.json": base(
        "spark-k8s",
        "DGX Spark — Kubernetes Cluster",
        ["spark-lab", "kubernetes"],
        [
            panel_stat(1, "Running Pods", 'sum(kube_pod_status_phase{phase="Running"})', 0, 0),
            panel_stat(2, "Pending Pods", 'sum(kube_pod_status_phase{phase="Pending"})', 4, 0),
            panel_stat(3, "Failed Pods", 'sum(kube_pod_status_phase{phase="Failed"})', 8, 0),
            panel_stat(4, "Failed Jobs", "sum(kube_job_status_failed) or vector(0)", 12, 0),
            panel_row(10, "Workloads by Namespace", 4),
            panel_timeseries(11, "Pods by Namespace", "sum by (namespace) (kube_pod_status_phase{phase=\"Running\"})", 0, 5, 12),
            panel_timeseries(12, "Job Failures", "kube_job_status_failed", 12, 5, 12),
            panel_timeseries(13, "ResourceQuota Used — CPU", 'kube_resourcequota{resource="requests.cpu", type="used"}', 0, 13, 12),
            panel_timeseries(14, "ResourceQuota Used — Memory", 'kube_resourcequota{resource="requests.memory", type="used"}', 12, 13, 12),
        ],
    ),
    "04-inference.json": base(
        "spark-inference",
        "DGX Spark — Inference Workloads",
        ["spark-lab", "inference"],
        [
            panel_stat(1, "Running Inference Pods", 'count(kube_pod_status_phase{namespace="ai-inference",phase="Running"})', 0, 0),
            panel_stat(2, "vLLM Requests Running", 'sum(vllm:num_requests_running) or vector(0)', 4, 0),
            panel_stat(3, "GPU Cache Usage %", 'avg(vllm:gpu_cache_usage_perc) * 100 or vector(0)', 8, 0, unit="percent"),
            panel_stat(4, "Inference Probes Up", 'sum(probe_success{job=~"blackbox-inference.*"})', 12, 0),
            panel_row(10, "Throughput & Health", 4),
            panel_timeseries(11, "vLLM Running Requests", "vllm:num_requests_running", 0, 5, 12),
            panel_timeseries(12, "vLLM GPU Cache %", "vllm:gpu_cache_usage_perc * 100", 12, 5, 12, unit="percent"),
            panel_timeseries(13, "Inference Probe Success", 'probe_success{job=~"blackbox-inference.*"}', 0, 13, 24),
        ],
        refresh="10s",
    ),
    "05-platform-services.json": base(
        "spark-platform",
        "DGX Spark — Platform Services",
        ["spark-lab", "platform"],
        [
            panel_stat(1, "Traefik Up", 'up{job="traefik"}', 0, 0),
            panel_stat(2, "Prometheus Targets Up", "sum(up)", 4, 0),
            panel_stat(3, "Probe Success Rate", "avg(probe_success) * 100", 8, 0, unit="percent"),
            panel_stat(4, "cert-manager Up", 'up{job=~"blackbox-cluster.*",instance=~".*cert-manager.*"} or vector(0)', 12, 0),
            panel_row(10, "Ingress & Probes", 4),
            panel_timeseries(11, "Traefik Request Rate", "sum(rate(traefik_entrypoint_requests_total[5m]))", 0, 5, 12),
            panel_timeseries(12, "HTTP Probe Success", "probe_success", 12, 5, 12),
            panel_timeseries(13, "Probe Duration (s)", "probe_duration_seconds", 0, 13, 24, unit="s"),
        ],
    ),
    "06-dev-agent-stack.json": base(
        "spark-dev-agent",
        "DGX Spark — Dev & Agent Stack",
        ["spark-lab", "dev", "agent"],
        [
            panel_stat(1, "Coder Pods Running", 'sum(kube_pod_status_phase{namespace="coder",phase="Running"})', 0, 0),
            panel_stat(2, "Kasm Pods Running", 'sum(kube_pod_status_phase{namespace="kasm",phase="Running"})', 4, 0),
            panel_stat(3, "Open WebUI Running", 'sum(kube_pod_status_phase{namespace="dev",pod=~".*open-webui.*",phase="Running"})', 8, 0),
            panel_stat(4, "MCP Probes Up", 'sum(probe_success{job=~"blackbox-mcp.*"})', 12, 0),
            panel_row(10, "Agent Services", 4),
            panel_timeseries(11, "Hermes Host Probes", 'probe_success{job=~"blackbox-host.*"}', 0, 5, 12),
            panel_timeseries(12, "MCP NodePort Probes", 'probe_success{job=~"blackbox-mcp.*"}', 12, 5, 12),
            panel_timeseries(13, "agent-tools Pod Count", 'sum by (pod) (kube_pod_status_phase{namespace="agent-tools",phase="Running"})', 0, 13, 24),
        ],
    ),
    "07-storage-network.json": base(
        "spark-storage-net",
        "DGX Spark — Storage & Network",
        ["spark-lab", "storage", "network"],
        [
            panel_row(1, "Storage", 0),
            panel_timeseries(2, "Disk Used % (root)", '(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100', 0, 1, 12, unit="percent"),
            panel_timeseries(3, "Disk I/O Read", 'rate(node_disk_read_bytes_total[5m])', 12, 1, 12, unit="Bps"),
            panel_timeseries(4, "Disk I/O Write", 'rate(node_disk_written_bytes_total[5m])', 0, 9, 12, unit="Bps"),
            panel_row(10, "High-Speed Network (400G)", 17),
            panel_timeseries(11, "HS RX (enp1s0*)", 'rate(node_network_receive_bytes_total{device=~"enp1s0.*"}[5m])', 0, 18, 12, unit="Bps"),
            panel_timeseries(12, "HS TX (enp1s0*)", 'rate(node_network_transmit_bytes_total{device=~"enp1s0.*"}[5m])', 12, 18, 12, unit="Bps"),
        ],
    ),
}


def main() -> None:
    """Write all dashboard JSON files to ``config/grafana/dashboards/``."""
    for filename, dashboard in DASHBOARDS.items():
        path = OUT / filename
        path.write_text(json.dumps(dashboard, indent=2))
        print(f"wrote {path}")


if __name__ == "__main__":
    main()