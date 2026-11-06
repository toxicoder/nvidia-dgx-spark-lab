#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/models.sh`` (``get_nemotron_stack_status_json``).

Invoked by shell as: ``python3 scripts/lib/py/models_get_nemotron_stack_status_json.py [args...]``.
"""
from __future__ import annotations

import json, subprocess, sys
from pathlib import Path
from typing import TypedDict, cast


class _ModelSpec(TypedDict, total=False):
    """Model record from the policy ``models`` map."""

    kind: str


class _Stack(TypedDict, total=False):
    """Nemotron stack record from the policy ``stacks`` map."""

    label: str
    stack_with: list[str]


class _Policy(TypedDict, total=False):
    """Subset of the Resource Guard policy this helper reads."""

    models: dict[str, _ModelSpec]
    stacks: dict[str, _Stack]


class _ComponentState(TypedDict):
    """One component of a stack in the status report."""

    model: str
    state: str


class _StackStatus(TypedDict):
    """One stack in the status report."""

    id: str
    label: str
    healthy: bool
    components: list[_ComponentState]


policy = cast(_Policy, json.loads(Path(sys.argv[1]).read_text()))
ns = "ai-inference"
stacks_out: list[_StackStatus] = []

def _job_state(name: str) -> str:
    """Report the phase of a Kubernetes Job.

    Args:
        name: Job name in the inference namespace.

    Returns:
        One of ``running``, ``succeeded``, ``failed``, ``absent``.
    """
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

def _deploy_state(name: str) -> str:
    """Report readiness of a Kubernetes Deployment.

    Args:
        name: Deployment name in the inference namespace.

    Returns:
        ``running`` when replicas are ready, ``pending`` when they are not, and
        ``absent`` when the Deployment cannot be read.
    """
    try:
        data = json.loads(subprocess.check_output(
            ["kubectl", "get", "deployment", name, "-n", ns, "-o", "json"],
            stderr=subprocess.DEVNULL, timeout=5))
        ready = data.get("status", {}).get("readyReplicas") or 0
        return "running" if ready > 0 else "pending"
    except Exception:
        return "absent"

for sid, stack in policy.get("stacks", {}).items():
    components: list[_ComponentState] = []
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
