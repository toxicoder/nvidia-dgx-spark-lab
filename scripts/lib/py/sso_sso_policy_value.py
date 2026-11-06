#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/sso.sh`` (``_sso_policy_value``).

Invoked by shell as: ``python3 scripts/lib/py/sso_sso_policy_value.py [args...]``.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import cast

def _load_yaml(path: str) -> dict[str, object]:
    """Load the SSO policy document.

    Args:
        path: Filesystem path of the policy YAML file.

    Returns:
        The parsed policy mapping, or an empty mapping when the file is missing
        or PyYAML cannot load it.
    """
    try:
        import yaml
        return cast("dict[str, object]", yaml.safe_load(Path(path).read_text()) or {})
    except Exception:
        return {}

policy = _load_yaml(sys.argv[1])
keys = sys.argv[2].split(".")
cur: object = policy
for k in keys:
    if not isinstance(cur, dict):
        cur = None
        break
    cur = cur.get(k)
if cur is None:
    print("")
else:
    print(cur)
