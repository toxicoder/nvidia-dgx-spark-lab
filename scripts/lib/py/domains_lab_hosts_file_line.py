#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/domains.sh`` (``lab_hosts_file_line``).

Invoked by shell as: ``python3 scripts/lib/py/domains_lab_hosts_file_line.py [args...]``.
"""
from __future__ import annotations

import json, sys
from pathlib import Path

def _load_yaml(path: Path) -> dict:
    try:
        import yaml  # type: ignore
        return yaml.safe_load(path.read_text()) or {}
    except Exception:
        return json.loads(path.with_suffix(".json").read_text())

cfg = _load_yaml(Path(sys.argv[2]))
ip = sys.argv[1]
local_d = cfg.get("local_domain", "lab.local")
hosts = ["auth", "dashboard", "chat", "coder", "grafana", "headlamp", "kasm", "traefik", "oauth"]
print(f"{ip} " + " ".join(f"{h}.{local_d}" for h in hosts))
