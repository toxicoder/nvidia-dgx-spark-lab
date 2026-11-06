#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/mcp.sh`` (``stop_mcp_stack``).

Invoked by shell as: ``python3 scripts/lib/py/mcp_stop_mcp_stack.py [args...]``.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import TypedDict, cast


class _Stack(TypedDict, total=False):
    """MCP stack record from the policy ``stacks`` map."""

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
        return {}

policy = _load_yaml(sys.argv[1])
names: set[str] = set()
for stack in policy.get("stacks", {}).values():
    for c in stack.get("stack_with", []):
        names.add(c)
for n in sorted(names):
    print(n)
