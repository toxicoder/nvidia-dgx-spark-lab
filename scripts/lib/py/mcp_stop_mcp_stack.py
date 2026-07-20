#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/mcp.sh`` (``stop_mcp_stack``).

Invoked by shell as: ``python3 scripts/lib/py/mcp_stop_mcp_stack.py [args...]``.
"""
from __future__ import annotations

import sys
from pathlib import Path

def _load_yaml(path):
    try:
        import yaml
        return yaml.safe_load(Path(path).read_text()) or {}
    except Exception:
        return {}

policy = _load_yaml(sys.argv[1])
names = set()
for stack in policy.get("stacks", {}).values():
    for c in stack.get("stack_with", []):
        names.add(c)
for n in sorted(names):
    print(n)
