#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/monitoring.sh`` (``get_monitoring_status_json``).

Invoked by shell as: ``python3 scripts/lib/py/monitoring_get_monitoring_status_json.py [args...]``.
"""
from __future__ import annotations

import json, subprocess, sys
from typing import TypedDict

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

class _ReleaseStatus(TypedDict):
    """One Helm release entry of the monitoring status report."""

    name: str
    state: str
    readyPods: int
    totalPods: int
    helmInstalled: bool


class _ReleaseStatusWithUrls(_ReleaseStatus, total=False):
    """Release entry once its user-facing URLs have been attached."""

    urls: dict[str, str]


def _sh(*args: str) -> str:
    """Run a command and return its trimmed stdout.

    Args:
        *args: Command and its arguments.

    Returns:
        The stripped stdout, or an empty string when the command fails.
    """
    try:
        return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""

def _release_status(release: str, ns: str = "monitoring") -> _ReleaseStatusWithUrls:
    """Summarise a Helm release and its Running pods.

    Args:
        release: Helm release name to inspect.
        ns: Kubernetes namespace the release is installed into.

    Returns:
        The release entry for the status report.
    """
    installed = release in _sh("helm", "list", "-n", ns, "-q").split()
    if not installed:
        return {"name": release, "state": "stopped", "readyPods": 0, "totalPods": 0, "helmInstalled": False}
    ready = len([x for x in _sh("kubectl", "get", "pods", "-n", ns, "-l", f"app.kubernetes.io/instance={release}", "-o", "jsonpath={range .items[?(@.status.phase=='Running')]}{.metadata.name}{'\\n'}{end}").split('\n') if x])
    total = len([x for x in _sh("kubectl", "get", "pods", "-n", ns, "-l", f"app.kubernetes.io/instance={release}", "-o", "jsonpath={.items[*].metadata.name}").split() if x])
    state = "starting"
    if ready > 0 and ready == total and total > 0:
        state = "running"
    elif total == 0:
        state = "stopped"
    return {"name": release, "state": state, "readyPods": ready, "totalPods": total, "helmInstalled": True}

def _dcgm_status() -> _ReleaseStatus:
    """Summarise the DCGM exporter DaemonSet pods.

    Returns:
        The dcgm-exporter entry for the status report.
    """
    ready = len([x for x in _sh("kubectl", "get", "pods", "-n", "gpu-operator", "-l", "app=nvidia-dcgm-exporter", "-o", "jsonpath={range .items[?(@.status.phase=='Running')]}{.metadata.name}{'\\n'}{end}").split('\n') if x])
    total = len([x for x in _sh("kubectl", "get", "pods", "-n", "gpu-operator", "-l", "app=nvidia-dcgm-exporter", "-o", "jsonpath={.items[*].metadata.name}").split() if x])
    state = "stopped"
    if ready > 0:
        state = "running"
    elif total > 0:
        state = "starting"
    return {"name": "dcgm-exporter", "state": state, "readyPods": ready, "totalPods": total, "helmInstalled": total > 0}

def _service_urls(name: str) -> dict[str, str]:
    """Build the URL set for a monitoring UI.

    Args:
        name: Service name used as the hostname label (grafana, headlamp).

    Returns:
        Mapping of URL flavour (``local``, ``nodeport``, and when public
        access is configured ``public`` and ``sso``) to the URL.
    """
    port = int(https_port)
    local_url = f"https://{name}.{local_d}:{port}/"
    urls: dict[str, str] = {"local": local_url, "nodeport": f"http://{host}:{grafana_port if name == 'grafana' else headlamp_port}"}
    if public_d:
        urls["public"] = f"https://{name}.{public_d}/"
    urls["sso"] = urls["public"] if primary == "public" and public_d else local_url
    return urls

grafana = _release_status("grafana")
grafana["urls"] = _service_urls("grafana")
headlamp = _release_status("headlamp")
headlamp["urls"] = _service_urls("headlamp")

status: dict[str, object] = {
    "grafana": grafana,
    "headlamp": headlamp,
    "prometheus": _release_status("prometheus"),
    "nodeExporter": _release_status("node-exporter"),
    "kubeStateMetrics": _release_status("kube-state-metrics"),
    "blackboxExporter": _release_status("blackbox-exporter"),
    "dcgmExporter": _dcgm_status(),
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
