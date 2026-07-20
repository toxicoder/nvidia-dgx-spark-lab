#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/hermes.sh`` (``get_hermes_status_json``).

Invoked by shell as: ``python3 scripts/lib/py/hermes_get_hermes_status_json.py [args...]``.
"""
from __future__ import annotations

import json, subprocess, sys, urllib.request
from pathlib import Path

data_dir, compose_file, container_name, pf_pid_file = sys.argv[1:5]

def _curl_ok(url, headers=None):
    try:
        req = urllib.request.Request(url, headers=headers or {})
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status < 400
    except Exception:
        return False

def _docker_state():
    try:
        out = subprocess.check_output(
            ["docker", "inspect", "-f", "{{.State.Status}}", container_name],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        return out
    except Exception:
        return "missing"

pf_pid = None
pf_alive = False
if Path(pf_pid_file).is_file():
    try:
        pf_pid = int(Path(pf_pid_file).read_text().strip())
        pf_alive = Path(f"/proc/{pf_pid}").exists()
    except Exception:
        pf_alive = False

api_key = ""
env_path = Path(data_dir) / ".env"
if env_path.is_file():
    for line in env_path.read_text().splitlines():
        if line.startswith("API_SERVER_KEY="):
            api_key = line.split("=", 1)[1].strip()
            break

status = {
    "container": container_name,
    "container_state": _docker_state(),
    "data_dir": data_dir,
    "port_forward": {"pid": pf_pid, "alive": pf_alive},
    "inference": {
        "url": "http://127.0.0.1:8000/v1/models",
        "reachable": _curl_ok("http://127.0.0.1:8000/v1/models"),
    },
    "mcp_searxng": {
        "url": "http://127.0.0.1:32100/sse",
        "reachable": _curl_ok("http://127.0.0.1:32100/sse"),
    },
    "gateway_api": {
        "url": "http://127.0.0.1:8642/v1/models",
        "reachable": _curl_ok(
            "http://127.0.0.1:8642/v1/models",
            {"Authorization": f"Bearer {api_key}"} if api_key else {},
        ),
    },
    "dashboard": {
        "url": "http://127.0.0.1:9119/",
        "reachable": _curl_ok("http://127.0.0.1:9119/"),
    },
}
print(json.dumps(status))
