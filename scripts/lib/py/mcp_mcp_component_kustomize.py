#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/mcp.sh`` (``_mcp_component_kustomize``).

Invoked by shell as: ``python3 scripts/lib/py/mcp_mcp_component_kustomize.py [args...]``.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import TypedDict, cast


class _Component(TypedDict, total=False):
    """MCP component record from the policy ``components`` map."""

    kustomize: str


class _Policy(TypedDict, total=False):
    """Subset of the MCP policy document this helper reads."""

    components: dict[str, _Component]


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
components = policy.get("components", {})
entry = components.get(sys.argv[2], {})
print(entry.get("kustomize", ""))
