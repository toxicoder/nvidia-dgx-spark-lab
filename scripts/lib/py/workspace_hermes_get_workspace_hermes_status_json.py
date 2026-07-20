#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/workspace-hermes.sh`` (``get_workspace_hermes_status_json``).

Invoked by shell as: ``python3 scripts/lib/py/workspace_hermes_get_workspace_hermes_status_json.py [args...]``.
"""
from __future__ import annotations

import json, sys
from pathlib import Path

def _load_yaml(path):
    try:
        import yaml
        return yaml.safe_load(Path(path).read_text()) or {}
    except Exception:
        return {}

policy = _load_yaml(sys.argv[1])
profile_dir = Path(sys.argv[2])
stack_id = "hermes-workspace-dev"
stack = policy.get("stacks", {}).get(stack_id, {})
mode = policy.get("url_modes", {}).get(stack.get("mcp_url_mode", "in_cluster"), {})

print(json.dumps({
    "stack": stack_id,
    "profile_dir": str(profile_dir),
    "profile_files": sorted(p.name for p in profile_dir.iterdir() if p.is_file()),
    "url_mode": stack.get("mcp_url_mode"),
    "inference_template": mode.get("inference_base_url_template"),
    "mcp_servers": list(stack.get("mcp_servers", [])),
}))
