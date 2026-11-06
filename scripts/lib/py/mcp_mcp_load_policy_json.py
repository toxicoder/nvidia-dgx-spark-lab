#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/mcp.sh`` (``_mcp_load_policy_json``).

Invoked by shell as: ``python3 scripts/lib/py/mcp_mcp_load_policy_json.py [args...]``.
"""
from __future__ import annotations

import json, sys
from pathlib import Path

def _load_policy(json_path: str, yaml_path: str) -> object:
    """Load the MCP stack policy, preferring the generated JSON twin.

    Args:
        json_path: Filesystem path of the generated ``.json`` policy.
        yaml_path: Filesystem path of the YAML policy of record.

    Returns:
        The parsed policy document, or an empty mapping when neither file can
        be read.
    """
    jp = Path(json_path)
    if jp.is_file():
        return json.loads(jp.read_text())
    yp = Path(yaml_path)
    if not yp.is_file():
        return {}
    try:
        import yaml
        return yaml.safe_load(yp.read_text()) or {}
    except Exception:
        return {}

print(json.dumps(_load_policy(sys.argv[1], sys.argv[2])))
