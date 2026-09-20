#!/usr/bin/env python3
"""Load and validate config/lab-identities.yaml; render sudoers and cloud-init users.

Invoked as ``python3 scripts/lib/py/lab_identities.py <command> [catalog]``.

Commands:
    validate [catalog]              exit 0 when the catalog is valid
    sudoers [catalog]               print /etc/sudoers.d content
    cloud-init-users [catalog]      print cloud-init groups+users YAML (no keys)
    ssh-users [catalog]             print SSH login user names, one per line
    status-json [catalog] [--identities-dir DIR]
                                    catalog summary; never prints key material

Exit codes: 0 ok, 1 validation/IO error, 2 usage error.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

LOGIN_SHELLS = frozenset({"/bin/bash", "/bin/sh"})
NOLOGIN_SHELLS = frozenset({"/usr/sbin/nologin", "/sbin/nologin", "/bin/false"})


class CatalogError(ValueError):
    """Identity catalog failed validation or could not be loaded."""


def default_catalog_path() -> Path:
    """Return ``config/lab-identities.yaml`` relative to this file.

    Returns:
        Absolute path to the committed identity catalog.
    """
    return Path(__file__).resolve().parents[3] / "config" / "lab-identities.yaml"


def load_catalog(path: Path) -> dict[str, Any]:
    """Load and validate an identity catalog YAML file.

    Args:
        path: Path to ``lab-identities.yaml``.

    Returns:
        Validated catalog mapping.

    Raises:
        CatalogError: File missing, unreadable, or invalid.
    """
    if not path.is_file():
        raise CatalogError(f"catalog not found: {path}")
    try:
        import yaml
    except ImportError as exc:  # pragma: no cover - import env
        raise CatalogError("PyYAML is required (python3-yaml / pip install pyyaml)") from exc
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except Exception as exc:  # noqa: BLE001 - report any parse failure uniformly
        raise CatalogError(f"cannot parse {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise CatalogError(f"{path} must contain a mapping")
    errors = validate_catalog(data)
    if errors:
        raise CatalogError("; ".join(errors))
    return data


def validate_catalog(data: dict[str, Any]) -> list[str]:
    """Validate a catalog mapping; return error messages (empty means ok).

    Args:
        data: Parsed YAML mapping (may be incomplete).

    Returns:
        Human-readable error strings; empty list when valid.
    """
    errors: list[str] = []
    if not isinstance(data, dict):
        return ["catalog must be a mapping"]
    if data.get("schema") != 1:
        errors.append(f"schema must be 1 (got {data.get('schema')!r})")
    uid_min = int(data.get("uid_gid_min") or 60000)
    uid_max = int(data.get("uid_gid_max") or 60099)
    groups = data.get("groups")
    users = data.get("users")
    if not isinstance(groups, dict) or not groups:
        errors.append("groups must be a non-empty mapping")
        groups = {}
    if not isinstance(users, dict) or not users:
        errors.append("users must be a non-empty mapping")
        users = {}

    seen_gids: dict[int, str] = {}
    for name, group in groups.items():
        if not isinstance(group, dict):
            errors.append(f"groups.{name} must be a mapping")
            continue
        try:
            gid = int(group.get("gid"))
        except (TypeError, ValueError):
            errors.append(f"groups.{name}.gid must be an int")
            continue
        if gid < uid_min or gid > uid_max:
            errors.append(f"groups.{name}.gid {gid} is outside range {uid_min}-{uid_max}")
        if gid in seen_gids:
            errors.append(f"gid {gid} duplicated ({seen_gids[gid]} and {name})")
        seen_gids[gid] = str(name)
        sudo = group.get("sudo")
        if sudo is not None and not isinstance(sudo, str):
            errors.append(f"groups.{name}.sudo must be a string")

    seen_uids: dict[int, str] = {}
    for name, user in users.items():
        if not isinstance(user, dict):
            errors.append(f"users.{name} must be a mapping")
            continue
        try:
            uid = int(user.get("uid"))
        except (TypeError, ValueError):
            errors.append(f"users.{name}.uid must be an int")
            continue
        if uid < uid_min or uid > uid_max:
            errors.append(f"users.{name}.uid {uid} is outside range {uid_min}-{uid_max}")
        if uid in seen_uids:
            errors.append(f"uid {uid} duplicated ({seen_uids[uid]} and {name})")
        seen_uids[uid] = str(name)
        ssh = bool(user.get("ssh"))
        shell = str(user.get("shell") or "")
        if ssh and shell not in LOGIN_SHELLS:
            errors.append(f"users.{name} ssh users require a login shell (got {shell!r})")
        if not ssh and shell not in NOLOGIN_SHELLS:
            errors.append(f"users.{name} non-ssh users require a nologin shell (got {shell!r})")
        member_of = user.get("groups") or []
        if not isinstance(member_of, list):
            errors.append(f"users.{name}.groups must be a list")
            member_of = []
        for group_name in member_of:
            if group_name not in groups:
                errors.append(f"users.{name} references unknown group {group_name!r}")

    ansible_user = str(data.get("ansible_user") or "")
    if not ansible_user:
        errors.append("ansible_user is required")
    elif ansible_user not in users:
        errors.append(f"ansible_user {ansible_user!r} is not a catalog user")
    else:
        ansible_entry = users.get(ansible_user) or {}
        if isinstance(ansible_entry, dict) and not ansible_entry.get("ssh"):
            errors.append(f"ansible_user {ansible_user!r} must have ssh: true")

    bootstrap = str(data.get("bootstrap_user_default") or "")
    if not bootstrap:
        errors.append("bootstrap_user_default is required")
    elif bootstrap in users:
        errors.append(
            f"bootstrap_user_default {bootstrap!r} must not be a catalog user "
            "(it is the factory first-contact account)"
        )

    return errors


def ssh_user_names(catalog: dict[str, Any]) -> list[str]:
    """Return catalog users that receive SSH keys, in catalog order.

    Args:
        catalog: Validated catalog.

    Returns:
        Login user names with ``ssh: true``.
    """
    users = catalog.get("users") or {}
    return [name for name, spec in users.items() if isinstance(spec, dict) and spec.get("ssh")]


def _sudo_for_user(catalog: dict[str, Any], user_name: str) -> str | None:
    """Return the sudoers spec for a user via group membership, if any."""
    users = catalog.get("users") or {}
    groups = catalog.get("groups") or {}
    spec = users.get(user_name) or {}
    if not isinstance(spec, dict):
        return None
    for group_name in spec.get("groups") or []:
        group = groups.get(group_name) or {}
        if isinstance(group, dict) and group.get("sudo"):
            return str(group["sudo"])
    return None


def render_sudoers(catalog: dict[str, Any]) -> str:
    """Render a visudo-valid sudoers drop-in from group sudo fields.

    Args:
        catalog: Validated catalog.

    Returns:
        Text for ``/etc/sudoers.d/lab-identities``.
    """
    lines = [
        "# Managed by nvidia-dgx-spark-lab lab_identities. Do not edit.",
        "# Source of truth: config/lab-identities.yaml",
        "",
    ]
    groups = catalog.get("groups") or {}
    for name, group in groups.items():
        if not isinstance(group, dict):
            continue
        sudo = group.get("sudo")
        if sudo:
            lines.append(f"%{name} {sudo}")
    lines.append("")
    return "\n".join(lines)


def render_cloud_init_users(catalog: dict[str, Any]) -> str:
    """Render cloud-init ``groups:`` + ``users:`` YAML with no authorized keys.

    The distro default user (``- default``, ubuntu on Spark images) is kept so
    first-contact SSH still works. Catalog users are appended without keys.

    Args:
        catalog: Validated catalog.

    Returns:
        YAML fragment. Never includes private keys or ``ssh-ed25519 AAAA`` material.
    """
    lines: list[str] = ["groups:"]
    for name in (catalog.get("groups") or {}):
        lines.append(f"  - {name}")
    lines.append("users:")
    # Keep the factory account; do not list it as name: ubuntu (not a catalog user).
    lines.append("  - default")
    users = catalog.get("users") or {}
    for name, spec in users.items():
        if not isinstance(spec, dict):
            continue
        member_of = spec.get("groups") or []
        groups_csv = ",".join(str(g) for g in member_of)
        lines.append(f"  - name: {name}")
        lines.append(f"    uid: {spec.get('uid')}")
        lines.append("    lock_passwd: true")
        lines.append(f"    shell: {spec.get('shell')}")
        if groups_csv:
            lines.append(f"    groups: {groups_csv}")
        sudo = _sudo_for_user(catalog, name)
        if sudo:
            lines.append(f"    sudo: {sudo}")
        if spec.get("ssh") is False:
            lines.append("    system: true")
            lines.append("    no_create_home: true")
    return "\n".join(lines) + "\n"


def dump_status(catalog: dict[str, Any], identities_dir: Path | None = None) -> dict[str, Any]:
    """Build a metadata-only status mapping (no key material).

    Args:
        catalog: Validated catalog.
        identities_dir: Optional directory of SSH key pairs.

    Returns:
        JSON-serializable status dict. Values never include PEM or OpenSSH private keys.
    """
    ident = identities_dir if identities_dir is not None else Path()
    users_out: list[dict[str, Any]] = []
    users = catalog.get("users") or {}
    for name, spec in users.items():
        if not isinstance(spec, dict):
            continue
        priv = ident / name
        pub = ident / f"{name}.pub"
        users_out.append(
            {
                "name": name,
                "uid": spec.get("uid"),
                "ssh": bool(spec.get("ssh")),
                "shell": spec.get("shell"),
                "groups": list(spec.get("groups") or []),
                "sudo": _sudo_for_user(catalog, name),
                "private_key_present": bool(spec.get("ssh")) and priv.is_file(),
                "public_key_present": bool(spec.get("ssh")) and pub.is_file(),
            }
        )
    groups_out = []
    for name, group in (catalog.get("groups") or {}).items():
        if not isinstance(group, dict):
            continue
        groups_out.append(
            {
                "name": name,
                "gid": group.get("gid"),
                "sudo": group.get("sudo"),
            }
        )
    return {
        "schema": catalog.get("schema"),
        "ansible_user": catalog.get("ansible_user"),
        "bootstrap_user_default": catalog.get("bootstrap_user_default"),
        "models_dir": catalog.get("models_dir"),
        "identities_dir": str(ident) if identities_dir is not None else "",
        "groups": groups_out,
        "users": users_out,
    }


def _cli(argv: list[str] | None = None) -> int:
    """CLI dispatcher used by tests and ``__main__``.

    Args:
        argv: Argument list without the program name. ``None`` reads ``sys.argv[1:]``.

    Returns:
        Process exit code.
    """
    parser = argparse.ArgumentParser(prog="lab_identities", description=__doc__)
    parser.add_argument(
        "command",
        nargs="?",
        choices=("validate", "sudoers", "cloud-init-users", "ssh-users", "status-json"),
        help="subcommand",
    )
    parser.add_argument("catalog", nargs="?", help="path to lab-identities.yaml")
    parser.add_argument("--identities-dir", default="", help="SSH key directory for status-json")
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:
        code = exc.code
        if code in (0, 2, None):
            return 0 if code in (0, None) else 2
        return int(code)

    if not args.command:
        parser.print_help()
        return 2

    path = Path(args.catalog) if args.catalog else default_catalog_path()
    try:
        catalog = load_catalog(path)
    except CatalogError as exc:
        print(f"lab-identities: {exc}", file=sys.stderr)
        return 1

    if args.command == "validate":
        print("lab-identities: ok")
        return 0
    if args.command == "sudoers":
        sys.stdout.write(render_sudoers(catalog))
        return 0
    if args.command == "cloud-init-users":
        sys.stdout.write(render_cloud_init_users(catalog))
        return 0
    if args.command == "ssh-users":
        for name in ssh_user_names(catalog):
            print(name)
        return 0
    ident = Path(args.identities_dir) if args.identities_dir else None
    json.dump(dump_status(catalog, identities_dir=ident), sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def main(argv: list[str] | None = None) -> int:
    """CLI entry point.

    Args:
        argv: Argument list without the program name.

    Returns:
        Process exit code.
    """
    return _cli(argv)


if __name__ == "__main__":
    sys.exit(main())
