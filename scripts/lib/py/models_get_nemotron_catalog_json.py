#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/models.sh`` (``get_nemotron_catalog_json``).

Invoked by shell as: ``python3 scripts/lib/py/models_get_nemotron_catalog_json.py [args...]``.
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

policy = json.loads(Path(sys.argv[1]).read_text())
catalog = _load_yaml(sys.argv[2])
stacks = policy.get("stacks", {})
out = {
    "models": catalog.get("models", {}),
    "pillars": catalog.get("pillars", {}),
    "stacks": stacks,
    "qwen_tiers": catalog.get("qwen_tiers", {}),
}
print(json.dumps(out))
