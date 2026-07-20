#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/models.sh`` (``get_nemotron_stack_status_json``).

Invoked by shell as: ``python3 scripts/lib/py/models_get_nemotron_stack_status_json.py [args...]``.
"""
from __future__ import annotations

import json, subprocess, sys
from pathlib import Path

policy = json.loads(Path(sys.argv[1]).read_text())
ns = "ai-inference"
stacks_out = []

def _job_state(name):
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

def _deploy_state(name):
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
        state = _deploy_state(m) if kind == "deployment" else _job_state(m)
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
