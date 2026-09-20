#!/usr/bin/env python3
"""Unit tests for lab_identities (catalog load, sudoers, cloud-init users, CLI)."""

from __future__ import annotations

import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from lab_identities import (
    CatalogError,
    _cli,
    default_catalog_path,
    dump_status,
    load_catalog,
    render_cloud_init_users,
    render_sudoers,
    ssh_user_names,
    validate_catalog,
)

MINI = """
schema: 1
uid_gid_min: 60000
uid_gid_max: 60099
bootstrap_user_default: ubuntu
ansible_user: lab-ansible
models_dir: /mnt/models
models_dir_mode: "2775"
k3s_kubeconfig: /etc/rancher/k3s/k3s.yaml
k3s_kubeconfig_mode: "0640"
groups:
  lab:
    gid: 60000
    description: parent
  lab-admin:
    gid: 60001
    description: break-glass
    sudo: ALL=(ALL) NOPASSWD:ALL
  lab-ops:
    gid: 60002
    description: ansible
    sudo: ALL=(ALL) NOPASSWD:ALL
  lab-k3s:
    gid: 60003
    description: kubeconfig
  lab-models:
    gid: 60004
    description: models
users:
  lab-admin:
    uid: 60001
    groups: [lab, lab-admin]
    ssh: true
    shell: /bin/bash
    comment: break-glass
  lab-ansible:
    uid: 60002
    groups: [lab, lab-ops, lab-k3s, lab-models]
    ssh: true
    shell: /bin/bash
    comment: ansible
  lab-svc:
    uid: 60003
    groups: [lab, lab-models]
    ssh: false
    shell: /usr/sbin/nologin
    comment: files
"""


class TestLabIdentities(unittest.TestCase):
    """Catalog parse, validation, sudoers, cloud-init, CLI."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.cat_path = Path(self.tmp.name) / "lab-identities.yaml"
        self.cat_path.write_text(MINI, encoding="utf-8")
        self.cat = load_catalog(self.cat_path)

    def test_load_mini_catalog(self) -> None:
        self.assertEqual(self.cat["ansible_user"], "lab-ansible")
        self.assertEqual(self.cat["bootstrap_user_default"], "ubuntu")
        self.assertEqual(ssh_user_names(self.cat), ["lab-admin", "lab-ansible"])
        self.assertNotIn("ubuntu", self.cat["users"])

    def test_committed_catalog_matches_policy(self) -> None:
        catalog = load_catalog(default_catalog_path())
        self.assertEqual(catalog["ansible_user"], "lab-ansible")
        self.assertEqual(catalog["bootstrap_user_default"], "ubuntu")
        self.assertEqual(set(catalog["users"]), {"lab-admin", "lab-ansible", "lab-svc"})
        self.assertTrue(catalog["users"]["lab-ansible"]["ssh"])
        self.assertFalse(catalog["users"]["lab-svc"]["ssh"])
        self.assertEqual(catalog["users"]["lab-svc"]["shell"], "/usr/sbin/nologin")
        sudoers = render_sudoers(catalog)
        self.assertIn("%lab-admin ALL=(ALL) NOPASSWD:ALL", sudoers)
        self.assertIn("%lab-ops ALL=(ALL) NOPASSWD:ALL", sudoers)
        self.assertNotIn("ubuntu", sudoers)
        users_block = render_cloud_init_users(catalog)
        self.assertIn("name: lab-admin", users_block)
        self.assertIn("name: lab-ansible", users_block)
        self.assertIn("name: lab-svc", users_block)
        self.assertIn("  - default\n", users_block)
        self.assertNotIn("name: ubuntu", users_block)
        self.assertNotIn("ssh-ed25519 AAAA", users_block)
        self.assertNotIn("BEGIN OPENSSH", users_block)
        self.assertNotIn("NOPASSWD:ALL", users_block.split("name: lab-svc")[-1])

    def test_duplicate_uid_rejected(self) -> None:
        bad = MINI.replace("uid: 60003", "uid: 60001")
        path = Path(self.tmp.name) / "dup.yaml"
        path.write_text(bad, encoding="utf-8")
        with self.assertRaises(CatalogError) as ctx:
            load_catalog(path)
        self.assertIn("uid", str(ctx.exception).lower())

    def test_ansible_user_must_be_ssh_user(self) -> None:
        bad = MINI.replace("ansible_user: lab-ansible", "ansible_user: lab-svc")
        path = Path(self.tmp.name) / "bad-ansible.yaml"
        path.write_text(bad, encoding="utf-8")
        with self.assertRaises(CatalogError) as ctx:
            load_catalog(path)
        self.assertIn("ansible_user", str(ctx.exception))

    def test_bootstrap_user_must_not_be_catalog_user(self) -> None:
        bad = MINI.replace("bootstrap_user_default: ubuntu", "bootstrap_user_default: lab-admin")
        path = Path(self.tmp.name) / "bad-boot.yaml"
        path.write_text(bad, encoding="utf-8")
        with self.assertRaises(CatalogError) as ctx:
            load_catalog(path)
        self.assertIn("bootstrap_user", str(ctx.exception))

    def test_unknown_group_membership_rejected(self) -> None:
        bad = MINI.replace("groups: [lab, lab-admin]", "groups: [lab, lab-admin, no-such]")
        path = Path(self.tmp.name) / "bad-group.yaml"
        path.write_text(bad, encoding="utf-8")
        with self.assertRaises(CatalogError) as ctx:
            load_catalog(path)
        self.assertIn("no-such", str(ctx.exception))

    def test_uid_out_of_range_rejected(self) -> None:
        bad = MINI.replace("uid: 60003", "uid: 1000")
        path = Path(self.tmp.name) / "range.yaml"
        path.write_text(bad, encoding="utf-8")
        with self.assertRaises(CatalogError) as ctx:
            load_catalog(path)
        self.assertIn("range", str(ctx.exception).lower())

    def test_ssh_user_requires_login_shell(self) -> None:
        bad = MINI.replace(
            "ssh: true\n    shell: /bin/bash\n    comment: break-glass",
            "ssh: true\n    shell: /usr/sbin/nologin\n    comment: break-glass",
        )
        path = Path(self.tmp.name) / "shell.yaml"
        path.write_text(bad, encoding="utf-8")
        with self.assertRaises(CatalogError) as ctx:
            load_catalog(path)
        self.assertIn("shell", str(ctx.exception).lower())

    def test_validate_catalog_returns_errors_list(self) -> None:
        errors = validate_catalog({"schema": 2})
        self.assertTrue(errors)

    def test_dump_status_has_no_key_material(self) -> None:
        payload = dump_status(self.cat, identities_dir=Path(self.tmp.name))
        text = str(payload)
        self.assertNotIn("BEGIN", text)
        self.assertNotIn("PRIVATE", text)
        self.assertEqual(payload["ansible_user"], "lab-ansible")
        names = {row["name"] for row in payload["users"]}
        self.assertEqual(names, {"lab-admin", "lab-ansible", "lab-svc"})

    def test_cli_validate_ok(self) -> None:
        self.assertEqual(_cli(["validate", str(self.cat_path)]), 0)

    def test_cli_validate_missing_file(self) -> None:
        self.assertEqual(_cli(["validate", str(Path(self.tmp.name) / "missing.yaml")]), 1)

    def test_cli_sudoers_and_users(self) -> None:
        buf = io.StringIO()
        with patch("sys.stdout", buf):
            rc = _cli(["sudoers", str(self.cat_path)])
        self.assertEqual(rc, 0)
        self.assertIn("%lab-ops", buf.getvalue())
        buf = io.StringIO()
        with patch("sys.stdout", buf):
            rc = _cli(["cloud-init-users", str(self.cat_path)])
        self.assertEqual(rc, 0)
        self.assertIn("lab-ansible", buf.getvalue())
        buf = io.StringIO()
        with patch("sys.stdout", buf):
            rc = _cli(["ssh-users", str(self.cat_path)])
        self.assertEqual(rc, 0)
        self.assertIn("lab-admin", buf.getvalue())
        self.assertIn("lab-ansible", buf.getvalue())
        self.assertNotIn("lab-svc", buf.getvalue())

    def test_cli_status_json(self) -> None:
        buf = io.StringIO()
        with patch("sys.stdout", buf):
            rc = _cli(["status-json", str(self.cat_path), "--identities-dir", self.tmp.name])
        self.assertEqual(rc, 0)
        self.assertIn("lab-ansible", buf.getvalue())
        self.assertNotIn("BEGIN OPENSSH", buf.getvalue())

    def test_cli_status_json_flag_before_catalog(self) -> None:
        """Python 3.12 argparse rejects a leftover positional after options."""
        buf = io.StringIO()
        with patch("sys.stdout", buf):
            rc = _cli(
                ["status-json", "--identities-dir", self.tmp.name, str(self.cat_path)]
            )
        self.assertEqual(rc, 0)
        self.assertIn("lab-ansible", buf.getvalue())

    def test_cli_unknown_and_help(self) -> None:
        buf = io.StringIO()
        with patch("sys.stderr", buf):
            self.assertEqual(_cli(["nope"]), 2)
        buf = io.StringIO()
        with patch("sys.stdout", buf):
            self.assertEqual(_cli(["--help"]), 0)
        buf = io.StringIO()
        with patch("sys.stderr", buf):
            self.assertEqual(_cli(["validate", str(self.cat_path), "--bogus"]), 2)


if __name__ == "__main__":
    unittest.main()
