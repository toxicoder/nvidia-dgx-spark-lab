#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/mcp.sh`` (``_mcp_stack_startup_order``).

Invoked by shell as: ``python3 scripts/lib/py/mcp_mcp_stack_startup_order.py [args...]``.
"""
from __future__ import annotations

import json, sys
from pathlib import Path

def _load_yaml(path):
    try:
        import yaml
        return yaml.safe_load(Path(path).read_text()) or {}
    except Exception:
        text = Path(path).read_text()
        # minimal fallback: empty
        return {}

policy = _load_yaml(sys.argv[1])
stack = policy.get("stacks", {}).get(sys.argv[2], {})
order = stack.get("startup_order") or stack.get("stack_with", [])
print("\n".join(order))
