#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/mcp.sh`` (``get_mcp_stack_status_json``).

Invoked by shell as: ``python3 scripts/lib/py/mcp_get_mcp_stack_status_json.py [args...]``.
"""
from __future__ import annotations

import json, subprocess, sys
from pathlib import Path

def _load_yaml(path):
    try:
        import yaml
        return yaml.safe_load(Path(path).read_text()) or {}
    except Exception:
        return {}

ns = sys.argv[1]
policy = _load_yaml(sys.argv[2])
components = list(policy.get("components", {}).keys())
raw = subprocess.check_output(
    ["kubectl", "get", "deploy,statefulset,cronjob", "-n", ns, "-o", "json"],
    text=True,
)
data = json.loads(raw)
items = data.get("items", [])
by_name = {}
for item in items:
    meta = item.get("metadata", {})
    by_name[meta.get("name", "")] = {
        "kind": item.get("kind"),
        "ready": item.get("status", {}),
    }
out = {"namespace": ns, "components": {c: by_name.get(c, {"present": False}) for c in components}}
print(json.dumps(out))
