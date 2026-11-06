#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/models.sh`` (``get_nemotron_catalog_json``).

Invoked by shell as: ``python3 scripts/lib/py/models_get_nemotron_catalog_json.py [args...]``.
"""
from __future__ import annotations

import json, sys
from pathlib import Path
from typing import TypedDict, cast


class _Pillar(TypedDict, total=False):
    """Nemotron pillar record from the catalog ``pillars`` map."""

    label: str
    icon: str


class _Catalog(TypedDict, total=False):
    """Subset of ``config/nemotron-catalog.yaml`` this helper reads."""

    models: dict[str, dict[str, object]]
    pillars: dict[str, _Pillar]
    qwen_tiers: dict[str, str]


def _load_yaml(path: str) -> _Catalog:
    """Load the Nemotron catalog document.

    Args:
        path: Filesystem path of the catalog YAML file.

    Returns:
        The parsed catalog mapping, or an empty mapping when the file is missing
        or PyYAML cannot load it.
    """
    try:
        import yaml
        return cast(_Catalog, yaml.safe_load(Path(path).read_text()) or {})
    except Exception:
        return {}

policy: dict[str, object] = json.loads(Path(sys.argv[1]).read_text())
catalog = _load_yaml(sys.argv[2])
stacks = policy.get("stacks", {})
out = {
    "models": catalog.get("models", {}),
    "pillars": catalog.get("pillars", {}),
    "stacks": stacks,
    "qwen_tiers": catalog.get("qwen_tiers", {}),
}
print(json.dumps(out))
