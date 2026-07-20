#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/resources.sh`` (``suggest_free_resources``).

Invoked by shell as: ``python3 scripts/lib/py/resources_suggest_free_resources.py [args...]``.
"""
from __future__ import annotations

import json, subprocess, sys
from pathlib import Path

policy = json.loads(Path(sys.argv[1]).read_text())
check = json.loads(sys.argv[2])
actions = policy.get("free_actions", [])
out = []

def _helm_running(ns, rel):
    try:
        r = subprocess.run(["helm", "list", "-n", ns, "-q"], capture_output=True, text=True, timeout=5)
        return rel in (r.stdout or "").splitlines()
    except Exception:
        return False

def _job_active(job, ns="ai-inference"):
    try:
        r = subprocess.run(
            ["kubectl", "get", "job", job, "-n", ns, "-o", "jsonpath={.status.active}"],
            capture_output=True, text=True, timeout=5,
        )
        return bool(r.stdout.strip()) and int(r.stdout.strip() or 0) > 0
    except Exception:
        return False

for item in actions:
    aid = item.get("id", "")
    act = item.get("action", "")
    entry = {
        "id": aid,
        "label": item.get("label", aid),
        "action": act,
        "reversible": item.get("reversible", True),
        "impact": item.get("impact", ""),
        "applicable": False,
        "frees": {},
    }
    if act == "dev:coder":
        if _helm_running("coder", "coder"):
            entry["applicable"] = True
            entry["frees"] = {"cpu": "2", "memory": "4Gi", "gpus": 0}
    elif act == "dev:kasm":
        if _helm_running("kasm", "kasm"):
            entry["applicable"] = True
            entry["frees"] = {"cpu": "2", "memory": "4Gi", "gpus": 0}
    elif act.startswith("stop-job:"):
        jobs = act.split(":", 1)[1].split(",")
        active = [j for j in jobs if _job_active(j.strip())]
        if active:
            entry["applicable"] = True
            entry["frees"] = {"gpus": 4 * len(active) if "ray" in act else 2, "memory": "16Gi", "gpus_note": "approx"}
    elif act == "stop-inference":
        entry["applicable"] = True
        entry["frees"] = {"gpus": "all", "memory": "all", "cpu": "all"}
    if entry["applicable"]:
        out.append(entry)

print(json.dumps(out))
