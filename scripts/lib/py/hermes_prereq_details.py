#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/hermes.sh`` (``block_481``).

Invoked by shell as: ``python3 scripts/lib/py/hermes_prereq_details.py [args...]``.
"""
from __future__ import annotations

import json, subprocess, sys
from pathlib import Path
from typing import TypedDict, cast


class _Stack(TypedDict, total=False):
    """Hermes stack record from the policy ``stacks`` map."""

    requires_nemotron_stack: bool
    requires_mcp_stack: bool


class _Policy(TypedDict, total=False):
    """Subset of the Hermes policy document this helper reads."""

    stacks: dict[str, _Stack]


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
print(json.dumps({
    "requires_nemotron_stack": stack.get("requires_nemotron_stack"),
    "requires_mcp_stack": stack.get("requires_mcp_stack"),
}))
