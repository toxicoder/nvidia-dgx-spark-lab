#!/usr/bin/env python3
"""Unit + Playwright contract tests for interactive command-vars panel.

Pure logic tests document the seed/merge/profile contract without a browser.
Playwright tests (when MkDocs site + Chromium are available) assert first-paint
substitution and profile button sync on getting-started.
"""

from __future__ import annotations

import http.server
import os
import socket
import socketserver
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except Exception:  # pragma: no cover - optional in minimal envs
    sync_playwright = None

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
JS_PATH = SCRIPT_DIR / "assets" / "javascripts" / "command-vars.js"
GETTING_STARTED = SCRIPT_DIR / "getting-started.md"


# --- Pure contract (mirrored from command-vars.js; keep in sync) -------------


def merge_vars(defaults: dict[str, str], stored: dict[str, str]) -> dict[str, str]:
    """Seed from defaults, then overlay non-empty stored values."""
    out = dict(defaults)
    for key, val in stored.items():
        if val is not None and str(val) != "":
            out[key] = str(val)
    return out


def profile_for_vars(vars_: dict[str, str]) -> str | None:
    """Return profile id for known SPARK0_IP values."""
    ip = (vars_.get("SPARK0_IP") or "").strip()
    if ip in ("localhost", "127.0.0.1"):
        return "1node"
    if ip == "192.168.1.10":
        return "2node"
    return None


def substitute_placeholders(text: str, vars_: dict[str, str]) -> str:
    """Replace {{KEY}} using vars; empty values leave the placeholder."""
    out = text
    for key, val in vars_.items():
        token = "{{" + key + "}}"
        if val is None or val == "":
            continue
        out = out.replace(token, str(val))
    return out


class TestCommandVarsLogic(unittest.TestCase):
    """Hermetic pure-logic tests (no browser, no MkDocs)."""

    def test_merge_empty_storage_keeps_defaults(self) -> None:
        """Empty localStorage must not wipe HTML input defaults."""
        defaults = {"SPARK0_IP": "localhost", "NAMESPACE": "ai-inference"}
        merged = merge_vars(defaults, {})
        self.assertEqual(merged["SPARK0_IP"], "localhost")
        self.assertEqual(merged["NAMESPACE"], "ai-inference")

    def test_merge_storage_overrides_defaults(self) -> None:
        """Saved user values win over HTML defaults."""
        defaults = {"SPARK0_IP": "localhost"}
        stored = {"SPARK0_IP": "192.168.1.10"}
        self.assertEqual(merge_vars(defaults, stored)["SPARK0_IP"], "192.168.1.10")

    def test_merge_ignores_empty_storage_values(self) -> None:
        """Blank storage values must not clobber defaults."""
        defaults = {"SPARK0_IP": "localhost"}
        self.assertEqual(merge_vars(defaults, {"SPARK0_IP": ""})["SPARK0_IP"], "localhost")

    def test_profile_mapping(self) -> None:
        """Known IPs map to profile buttons; custom IPs map to none."""
        self.assertEqual(profile_for_vars({"SPARK0_IP": "localhost"}), "1node")
        self.assertEqual(profile_for_vars({"SPARK0_IP": "127.0.0.1"}), "1node")
        self.assertEqual(profile_for_vars({"SPARK0_IP": "192.168.1.10"}), "2node")
        self.assertIsNone(profile_for_vars({"SPARK0_IP": "10.0.0.5"}))

    def test_substitute_uses_merged_vars(self) -> None:
        """Substitution after merge must not leave raw {{SPARK0_IP}}."""
        defaults = {"SPARK0_IP": "localhost", "DASHBOARD_PORT": "32082"}
        merged = merge_vars(defaults, {})
        text = "http://{{SPARK0_IP}}:{{DASHBOARD_PORT}}"
        self.assertEqual(substitute_placeholders(text, merged), "http://localhost:32082")
        self.assertNotIn("{{", substitute_placeholders(text, merged))

    def test_getting_started_defaults_match_primary_profile(self) -> None:
        """Source panel: primary 1node and default SPARK0_IP=localhost stay aligned."""
        src = GETTING_STARTED.read_text(encoding="utf-8")
        self.assertIn('data-profile="1node" class="md-button md-button--primary"', src)
        self.assertIn('data-var="SPARK0_IP" value="localhost"', src)
        self.assertTrue(JS_PATH.is_file(), f"missing {JS_PATH}")
        self.assertIn("dgx-lab-docs-cluster-vars", JS_PATH.read_text(encoding="utf-8"))

    def test_js_exposes_helpers_and_seeds_on_init(self) -> None:
        """command-vars.js must seed from inputs and expose contract helpers."""
        js = JS_PATH.read_text(encoding="utf-8")
        self.assertIn("seedDefaultsFromInputs", js)
        self.assertIn("mergeVars", js)
        self.assertIn("syncProfileButtons", js)
        self.assertIn("window.__dgxCommandVars", js)
        # Must not apply empty loadVars() alone without defaults.
        self.assertIn("mergeVars(defaults, loadVars())", js)


class TestCommandVarsPlaywright(unittest.TestCase):
    """Browser integration against a built MkDocs site (skipped when unavailable)."""

    site_dir: Path
    server_base: str | None
    httpd: socketserver.TCPServer | None

    @classmethod
    def setUpClass(cls) -> None:
        """Build docs once and serve for Playwright when tools exist."""
        cls.site_dir = Path(tempfile.mkdtemp(prefix="mkdocs-cmdvars-"))
        cls.server_base = None
        cls.httpd = None
        if sync_playwright is None:
            return
        # Prefer reuse when CI already built the site.
        reuse = os.environ.get("MKDOCS_SITE_DIR", "").strip()
        if reuse and (Path(reuse) / "getting-started" / "index.html").exists():
            cls.site_dir = Path(reuse)
        else:
            env = os.environ.copy()
            cmd = [
                sys.executable,
                "-m",
                "mkdocs",
                "build",
                "--strict",
                "-f",
                str(REPO_ROOT / "mkdocs.yml"),
                "-d",
                str(cls.site_dir),
            ]
            try:
                subprocess.run(cmd, check=True, cwd=str(REPO_ROOT), env=env, capture_output=True)
            except (subprocess.CalledProcessError, FileNotFoundError) as exc:
                print(f"command-vars playwright: mkdocs build skipped: {exc}", file=sys.stderr)
                return

        if not (cls.site_dir / "getting-started" / "index.html").exists():
            return

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]

        site_root = str(cls.site_dir)

        class _Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self, format: str, *args: object) -> None:  # noqa: A003
                return

        def make_handler(
            request: socket.socket,
            client_address: tuple[str, int],
            server: socketserver.BaseServer,
        ) -> http.server.SimpleHTTPRequestHandler:
            return _Quiet(request, client_address, server, directory=site_root)

        httpd = socketserver.TCPServer(("127.0.0.1", port), make_handler)
        thr = threading.Thread(target=httpd.serve_forever, daemon=True)
        thr.start()
        cls.httpd = httpd
        cls.server_base = f"http://127.0.0.1:{port}"

    @classmethod
    def tearDownClass(cls) -> None:
        """Stop the static server if started."""
        if cls.httpd is not None:
            try:
                cls.httpd.shutdown()
            except Exception:
                pass

    def test_first_paint_substitutes_without_toggle(self) -> None:
        """After load (cleared storage), code blocks show localhost, 1node is primary."""
        if self.server_base is None or sync_playwright is None:
            self.skipTest("Playwright/MkDocs site not available")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()
            page = context.new_page()
            try:
                page.goto(self.server_base + "/getting-started/")
                page.evaluate("() => localStorage.removeItem('dgx-lab-docs-cluster-vars')")
                page.reload()
                page.wait_for_selector(".cluster-config input[data-var='SPARK0_IP']", timeout=10000)
                # Allow command-vars init to run after DOMContentLoaded.
                page.wait_for_function(
                    """() => {
                      const code = document.body.innerText;
                      return code.includes('localhost') && !code.includes('{{SPARK0_IP}}');
                    }""",
                    timeout=10000,
                )
                ip = page.input_value(".cluster-config input[data-var='SPARK0_IP']")
                self.assertEqual(ip, "localhost")
                primary = page.locator(".cluster-config [data-profile].md-button--primary")
                self.assertEqual(primary.get_attribute("data-profile"), "1node")
                body = page.inner_text("main")
                self.assertNotIn("{{SPARK0_IP}}", body)
                self.assertIn("localhost", body)

                # Toggle to 2-node and back — content and primary must track.
                page.click('.cluster-config [data-profile="2node"]')
                page.wait_for_function(
                    """() => document.body.innerText.includes('192.168.1.10')
                        && !document.body.innerText.includes('{{SPARK0_IP}}')""",
                    timeout=5000,
                )
                self.assertEqual(
                    page.locator(".cluster-config [data-profile].md-button--primary").get_attribute(
                        "data-profile"
                    ),
                    "2node",
                )
                page.click('.cluster-config [data-profile="1node"]')
                page.wait_for_function(
                    """() => document.body.innerText.includes('localhost')""",
                    timeout=5000,
                )
                self.assertEqual(
                    page.locator(".cluster-config [data-profile].md-button--primary").get_attribute(
                        "data-profile"
                    ),
                    "1node",
                )
            finally:
                page.close()
                context.close()
                browser.close()


if __name__ == "__main__":
    unittest.main()
