#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/mcp.sh`` (``_mcp_stack_startup_order``).

Invoked by shell as: ``python3 scripts/lib/py/mcp_mcp_stack_startup_order.py [args...]``.
"""
from __future__ import annotations

import json, sys
from pathlib import Path
from typing import TypedDict, cast


class _Stack(TypedDict, total=False):
    """MCP stack record from the policy ``stacks`` map."""

    startup_order: list[str]
    stack_with: list[str]


class _Policy(TypedDict, total=False):
    """Subset of the MCP policy document this helper reads."""

    stacks: dict[str, _Stack]


def _load_yaml(path: str) -> _Policy:
    """Load the MCP policy document.

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
        text = Path(path).read_text()
        # minimal fallback: empty
        return {}

policy = _load_yaml(sys.argv[1])
stack = policy.get("stacks", {}).get(sys.argv[2], {})
order = stack.get("startup_order") or stack.get("stack_with", [])
print("\n".join(order))
