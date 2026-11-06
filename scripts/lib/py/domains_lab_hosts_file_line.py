#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/domains.sh`` (``lab_hosts_file_line``).

Invoked by shell as: ``python3 scripts/lib/py/domains_lab_hosts_file_line.py [args...]``.
"""
from __future__ import annotations

import json, sys
from pathlib import Path
from typing import cast

def _load_yaml(path: Path) -> dict[str, object]:
    """Load the lab domains config.

    Args:
        path: Filesystem path of the domains YAML file.

    Returns:
        The parsed config mapping, or an empty mapping when the file is absent
        or neither the YAML nor its JSON twin can be read.
    """
    if not path.exists():
        return {}  # config is optional -- defaults + env overrides still apply
    try:
        import yaml
        return cast("dict[str, object]", yaml.safe_load(path.read_text()) or {})
    except Exception:
        return cast("dict[str, object]", json.loads(path.with_suffix(".json").read_text()))

cfg = _load_yaml(Path(sys.argv[2]))
ip = sys.argv[1]
local_d = cfg.get("local_domain", "lab.local")
hosts = ["auth", "dashboard", "chat", "coder", "grafana", "headlamp", "kasm", "traefik", "oauth"]
print(f"{ip} " + " ".join(f"{h}.{local_d}" for h in hosts))
