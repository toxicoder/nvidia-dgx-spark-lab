#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/mcp.sh`` (``_mcp_component_kustomize``).

Invoked by shell as: ``python3 scripts/lib/py/mcp_mcp_component_kustomize.py [args...]``.
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
components = policy.get("components", {})
entry = components.get(sys.argv[2], {})
print(entry.get("kustomize", ""))
