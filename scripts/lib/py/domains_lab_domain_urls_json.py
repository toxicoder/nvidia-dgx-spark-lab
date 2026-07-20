#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/domains.sh`` (``lab_domain_urls_json``).

Invoked by shell as: ``python3 scripts/lib/py/domains_lab_domain_urls_json.py [args...]``.
"""
from __future__ import annotations

import json, os, subprocess, sys

host = sys.argv[1]
root = os.environ.get("REPO_ROOT", ".")
loader = subprocess.check_output(
    ["bash", "-c", f"source {root}/scripts/lib/domains.sh && _lab_domains_load"],
    text=True,
)
cfg = dict(line.split("=", 1) for line in loader.splitlines() if "=" in line)
local_d = cfg["local_domain"]
public_d = cfg.get("public_domain", "")
port = cfg.get("https_port", "32443")

def _url(profile: str) -> str:
    apex = public_d if profile == "public" and public_d else local_d
    fqdn = f"{host}.{apex}"
    if profile == "public" and public_d:
        return f"https://{fqdn}/"
    return f"https://{fqdn}:{port}/"

out = {"local": _url("local")}
if public_d:
    out["public"] = _url("public")
print(json.dumps(out))
