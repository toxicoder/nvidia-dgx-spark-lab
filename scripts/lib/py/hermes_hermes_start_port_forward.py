#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/hermes.sh`` (``hermes_start_port_forward``).

Invoked by shell as: ``python3 scripts/lib/py/hermes_hermes_start_port_forward.py [args...]``.
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
stack = policy.get("stacks", {}).get(sys.argv[2], {})
preset = policy.get("inference_presets", {}).get(stack.get("inference_preset", ""), {})
print(preset.get("service", ""), preset.get("namespace", "ai-inference"))
