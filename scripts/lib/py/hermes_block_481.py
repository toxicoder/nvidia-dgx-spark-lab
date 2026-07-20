#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/hermes.sh`` (``block_481``).

Invoked by shell as: ``python3 scripts/lib/py/hermes_prereq_details.py [args...]``.
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

policy = _load_yaml(sys.argv[1])
stack = policy.get("stacks", {}).get(sys.argv[2], {})
print(json.dumps({
    "requires_nemotron_stack": stack.get("requires_nemotron_stack"),
    "requires_mcp_stack": stack.get("requires_mcp_stack"),
}))
