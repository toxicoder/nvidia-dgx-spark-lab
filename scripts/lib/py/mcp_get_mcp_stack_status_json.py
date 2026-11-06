#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/mcp.sh`` (``get_mcp_stack_status_json``).

Invoked by shell as: ``python3 scripts/lib/py/mcp_get_mcp_stack_status_json.py [args...]``.
"""
from __future__ import annotations

import json, subprocess, sys
from pathlib import Path
from typing import TypedDict, cast


class _ObjectMeta(TypedDict, total=False):
    """``metadata`` block of a Kubernetes object."""

    name: str


class _K8sObject(TypedDict, total=False):
    """Subset of a Kubernetes workload object."""

    kind: str
    metadata: _ObjectMeta
    status: dict[str, object]


class _K8sList(TypedDict, total=False):
    """Subset of a Kubernetes list response."""

    items: list[_K8sObject]


class _ComponentState(TypedDict, total=False):
    """Per-component entry of the status report emitted on stdout."""

    present: bool
    kind: object
    ready: object


class _Policy(TypedDict, total=False):
    """Subset of the MCP policy document this helper reads."""

    components: dict[str, object]


def _load_yaml(path: str) -> _Policy:
    """Load the MCP policy document.

    Args:
        path: Filesystem path of the policy YAML file.

    Returns:
        The parsed policy mapping, or an empty mapping when the file is missing
        or PyYAML cannot load it.
    """
    try:
        import yaml
        return cast(_Policy, yaml.safe_load(Path(path).read_text()) or {})
    except Exception:
        return {}

ns = sys.argv[1]
policy = _load_yaml(sys.argv[2])
components = list(policy.get("components", {}).keys())
raw = subprocess.check_output(
    ["kubectl", "get", "deploy,statefulset,cronjob", "-n", ns, "-o", "json"],
    text=True,
)
data = cast(_K8sList, json.loads(raw))
items = data.get("items", [])
by_name: dict[str, _ComponentState] = {}
for item in items:
    meta = item.get("metadata", {})
    by_name[meta.get("name", "")] = {
        "kind": item.get("kind"),
        "ready": item.get("status", {}),
    }
out = {"namespace": ns, "components": {c: by_name.get(c, {"present": False}) for c in components}}
print(json.dumps(out))
