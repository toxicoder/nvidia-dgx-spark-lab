#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/domains.sh`` (``_lab_domains_load``).

Invoked by shell as: ``python3 scripts/lib/py/domains_lab_domains_load.py [args...]``.
"""
from __future__ import annotations

import json, os, sys
from pathlib import Path
from typing import TypedDict, cast


class _Sso(TypedDict, total=False):
    """Port overrides from the config ``sso`` block."""

    https_port: int
    http_port: int


class _Tls(TypedDict, total=False):
    """Certificate overrides from the config ``tls`` block."""

    local_issuer: str
    public_issuer: str
    acme_email: str
    acme_solver: str


class _DomainsConfig(TypedDict, total=False):
    """Subset of ``config/lab-domains.yaml`` this helper reads."""

    local_domain: str
    public_domain: str
    primary: str
    email_domain: str
    sso: _Sso
    tls: _Tls


def _load_yaml(path: Path) -> _DomainsConfig:
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
        return cast(_DomainsConfig, yaml.safe_load(path.read_text()) or {})
    except Exception:
        return cast(_DomainsConfig, json.loads(path.with_suffix(".json").read_text()))

cfg = _load_yaml(Path(sys.argv[1]))
sso = cfg.get("sso") or {}
tls = cfg.get("tls") or {}

def _env(key: str, default: str) -> str:
    """Read an environment override.

    Args:
        key: Environment variable name.
        default: Value to fall back to when the variable is unset or empty.

    Returns:
        The environment value, or ``default`` when it is unset or empty.
    """
    return os.environ.get(key, default) or default

local_d = _env("LAB_LOCAL_DOMAIN", _env("LAB_SSO_DOMAIN", str(cfg.get("local_domain", "lab.local"))))
public_d = _env("LAB_PUBLIC_DOMAIN", str(cfg.get("public_domain", "") or ""))
primary = _env("LAB_DOMAIN_PROFILE", _env("LAB_PRIMARY_DOMAIN", str(cfg.get("primary", "local"))))
email_d = _env("LAB_EMAIL_DOMAIN", str(cfg.get("email_domain", local_d)))
https_port = _env("LAB_SSO_HTTPS_PORT", str(sso.get("https_port", 32443)))
http_port = _env("LAB_SSO_HTTP_PORT", str(sso.get("http_port", 32080)))
acme_email = _env("LAB_ACME_EMAIL", str(tls.get("acme_email", "") or ""))

if primary not in ("local", "public"):
    primary = "local"
if primary == "public" and not public_d:
    primary = "local"

fields = {
    "local_domain": local_d,
    "public_domain": public_d,
    "primary": primary,
    "email_domain": email_d,
    "https_port": https_port,
    "http_port": http_port,
    "acme_email": acme_email,
    "local_issuer": str(tls.get("local_issuer", "lab-ca-issuer")),
    "public_issuer": str(tls.get("public_issuer", "letsencrypt-prod")),
    "acme_solver": str(tls.get("acme_solver", "http01")),
}
for k, v in fields.items():
    print(f"{k}={v}")
