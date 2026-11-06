#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/hermes.sh`` (``hermes_start_port_forward``).

Invoked by shell as: ``python3 scripts/lib/py/hermes_hermes_start_port_forward.py [args...]``.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import TypedDict, cast


class _Preset(TypedDict, total=False):
    """Inference preset record from the policy ``inference_presets`` map."""

    service: str
    namespace: str


class _Stack(TypedDict, total=False):
    """Hermes stack record from the policy ``stacks`` map."""

    inference_preset: str


class _Policy(TypedDict, total=False):
    """Subset of the Hermes policy document this helper reads."""

    stacks: dict[str, _Stack]
    inference_presets: dict[str, _Preset]


def _load_yaml(path: str) -> _Policy:
    """Load the Hermes policy document.

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

policy = _load_yaml(sys.argv[1])
stack = policy.get("stacks", {}).get(sys.argv[2], {})
preset = policy.get("inference_presets", {}).get(stack.get("inference_preset", ""), {})
print(preset.get("service", ""), preset.get("namespace", "ai-inference"))
