#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/domains.sh`` (``domains_set``).

Invoked by shell as: ``python3 scripts/lib/py/domains_domains_set.py [args...]``.
"""
from __future__ import annotations

import json, sys
from pathlib import Path
from typing import TypedDict, cast


class _Tls(TypedDict, total=False):
    """Certificate overrides from the config ``tls`` block."""

    acme_email: str


class _DomainsConfig(TypedDict, total=False):
    """Subset of ``config/lab-domains.yaml`` this helper writes."""

    local_domain: str
    public_domain: str
    primary: str
    email_domain: str
    tls: _Tls


path = Path(sys.argv[1])
args = sys.argv[2:]
local_d, public_d, primary, email, acme_email = (args + [""] * 5)[:5]

try:
    import yaml
except ImportError:
    sys.stderr.write("PyYAML required for domains set\n")
    sys.exit(1)

cfg = cast(_DomainsConfig, yaml.safe_load(path.read_text()) or {})
if local_d:
    cfg["local_domain"] = local_d
if public_d or public_d == "":
    cfg["public_domain"] = public_d
if primary:
    cfg["primary"] = primary
if email:
    cfg["email_domain"] = email
tls = cfg.setdefault("tls", {})
if acme_email:
    tls["acme_email"] = acme_email
path.write_text(yaml.dump(cfg, default_flow_style=False, sort_keys=False))
json_path = path.with_suffix(".json")
json_path.write_text(json.dumps(cfg, indent=2) + "\n")
print(f"Updated {path}")
