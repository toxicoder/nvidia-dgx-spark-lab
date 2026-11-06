#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/workspace-hermes.sh`` (``get_workspace_hermes_status_json``).

Invoked by shell as: ``python3 scripts/lib/py/workspace_hermes_get_workspace_hermes_status_json.py [args...]``.
"""
from __future__ import annotations

import json, sys
from pathlib import Path
from typing import TypedDict, cast


class _Stack(TypedDict, total=False):
    """Workspace Hermes stack record from the policy ``stacks`` map."""

    mcp_url_mode: str
    mcp_servers: list[str]


class _UrlMode(TypedDict, total=False):
    """URL mode record from the policy ``url_modes`` map."""

    inference_base_url_template: str


class _Policy(TypedDict, total=False):
    """Subset of the Hermes policy document this helper reads."""

    stacks: dict[str, _Stack]
    url_modes: dict[str, _UrlMode]


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
profile_dir = Path(sys.argv[2])
stack_id = "hermes-workspace-dev"
stack = policy.get("stacks", {}).get(stack_id, {})
mode = policy.get("url_modes", {}).get(stack.get("mcp_url_mode", "in_cluster"), {})

print(json.dumps({
    "stack": stack_id,
    "profile_dir": str(profile_dir),
    "profile_files": sorted(p.name for p in profile_dir.iterdir() if p.is_file()),
    "url_mode": stack.get("mcp_url_mode"),
    "inference_template": mode.get("inference_base_url_template"),
    "mcp_servers": list(stack.get("mcp_servers", [])),
}))
