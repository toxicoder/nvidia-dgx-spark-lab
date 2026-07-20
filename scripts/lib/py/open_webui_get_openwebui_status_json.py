#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/open-webui.sh`` (``get_openwebui_status_json``).

Invoked by shell as: ``python3 scripts/lib/py/open_webui_get_openwebui_status_json.py [args...]``.
"""
from __future__ import annotations

import json, subprocess, sys, urllib.request

release, ns, local_d, public_d, primary, host, sso_host, nodeport, https_port = sys.argv[1:9]

def _helm_installed():
    try:
        out = subprocess.check_output(["helm", "list", "-n", ns, "-q"], text=True, stderr=subprocess.DEVNULL)
        return release in out.split()
    except Exception:
        return False

def _pod_ready():
    try:
        out = subprocess.check_output(
            ["kubectl", "get", "pods", "-n", ns, "-l", f"app.kubernetes.io/instance={release}",
             "-o", "jsonpath={.items[?(@.status.phase=='Running')].metadata.name}"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        return bool(out)
    except Exception:
        return False

def _endpoint_ip():
    try:
        return subprocess.check_output(
            ["kubectl", "get", "endpoints", "hermes-gateway", "-n", "dev",
             "-o", "jsonpath={.subsets[0].addresses[0].ip}"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        return ""

def _hermes_gateway_ok():
    ip = _endpoint_ip()
    if not ip:
        return False, ""
    url = f"http://{ip}:8642/v1/models"
    try:
        with urllib.request.urlopen(url, timeout=3) as resp:
            return resp.status < 400, url
    except Exception:
        return False, url

installed = _helm_installed()
ready = _pod_ready() if installed else False
state = "stopped"
if installed:
    state = "running" if ready else "starting"

gw_ok, gw_url = _hermes_gateway_ok() if installed else (False, "")

status = {
    "release": release,
    "namespace": ns,
    "state": state,
    "helm_installed": installed,
    "pod_ready": ready,
    "urls": {
        "local": f"https://{sso_host}.{local_d}:{https_port}/",
        "public": f"https://{sso_host}.{public_d}/" if public_d else None,
        "sso": (
            f"https://{sso_host}.{public_d}/"
            if primary == "public" and public_d
            else f"https://{sso_host}.{local_d}:{https_port}/"
        ),
        "nodeport": f"http://{host}:{nodeport}",
    },
    "backend": {
        "hermes_gateway": {
            "url": gw_url or "http://hermes-gateway.dev.svc.cluster.local:8642/v1",
            "reachable": gw_ok,
            "endpoint_ip": _endpoint_ip(),
        }
    },
    "prerequisites": {
        "hermes_stack": "hermes-lab",
    },
}
print(json.dumps(status))
