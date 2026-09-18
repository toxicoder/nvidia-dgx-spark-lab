#!/usr/bin/env python3
"""Contract checks for the interactive cluster-variables panel.

The panel lets a reader edit `SPARK0_IP`, `NAMESPACE` and `DASHBOARD_PORT` and have every
`{{TOKEN}}` in the page's code examples re-resolve live, with the Copy buttons handing out
the substituted text.  It used to be a hand-written widget (`command-vars.js`) injected by
MkDocs; it is now `docs-site/components/cluster-config-panel.tsx`.

The seed/merge/profile/substitute arithmetic itself is pinned by the Vitest suite in
`docs-site/tests/unit/cluster-config-panel.test.ts`, which imports the shipped component.
What is checked here is the wiring around it, which no unit test can see:

  * the pages that are supposed to mount the panel still do,
  * the panel keeps the storage key returning readers expect,
  * the build leaves the tokens editable rather than frozen into literals, so a later
    reader can still change the address.

Run via the accompanying shell wrapper as a Bazel sh_test, or directly:
    python3 docs/test_command_vars.py
"""

from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
DOCS_DIR = SCRIPT_DIR
SITE_DIR = REPO_ROOT / "docs-site"
EXPORT_DIR = SITE_DIR / "out"
PANEL_COMPONENT = SITE_DIR / "components" / "cluster-config-panel.tsx"
NAV_JSON = SITE_DIR / "lib" / "nav.json"

#: Storage key shared with the previous MkDocs widget, so a returning reader keeps values.
STORAGE_KEY = "dgx-lab-docs-cluster-vars"

#: Pages that must offer the panel because they publish copy-pastable cluster commands.
REQUIRED_PANEL_PAGES = (
    "getting-started",
    "operate/capacity-planning",
    "troubleshooting",
)


def read_content(stem: str) -> str:
    """Read a documentation page by path without the extension.

    Args:
        stem: Path relative to `docs/`, e.g. ``getting-started`` or ``operate/index``.

    Returns:
        The page source.

    Raises:
        AssertionError: If neither the `.mdx` nor the `.md` form exists.
    """
    for suffix in (".mdx", ".md"):
        candidate = DOCS_DIR / f"{stem}{suffix}"
        if candidate.is_file():
            return candidate.read_text(encoding="utf-8", errors="replace")
    raise AssertionError(f"documentation page not found: {stem} (.mdx/.md)")


class TestPanelWiring(unittest.TestCase):
    """Checks that the panel is mounted where it is needed and stays interactive."""

    def test_component_is_mounted_on_pages_that_need_it(self) -> None:
        """Each command-heavy page includes the panel component."""
        for stem in REQUIRED_PANEL_PAGES:
            text = read_content(stem)
            self.assertIn(
                "<ClusterConfigPanel />",
                text,
                f"{stem} must mount <ClusterConfigPanel /> so its examples stay editable",
            )

    def test_component_declares_the_editable_contract(self) -> None:
        """The shipped component declares the attributes the substitution relies on."""
        self.assertTrue(PANEL_COMPONENT.is_file(), f"missing {PANEL_COMPONENT}")
        source = PANEL_COMPONENT.read_text(encoding="utf-8")
        for marker in ("data-var", "data-profile", "originalText", "MutationObserver"):
            self.assertIn(marker, source, f"panel component lost its {marker!r} wiring")
        self.assertIn(STORAGE_KEY, source, "panel changed its storage key; readers lose saved values")

    def test_tokens_are_not_frozen_into_literals(self) -> None:
        """Page sources keep `{{TOKEN}}` placeholders rather than baked-in addresses."""
        for stem in REQUIRED_PANEL_PAGES:
            text = re.sub(r"^```.*?^```", "", read_content(stem), flags=re.S | re.M)
            found = set(re.findall(r"\{\{([A-Z][A-Z0-9_]+)\}\}", text))
            self.assertTrue(
                bool(found),
                f"{stem} has no {{{{TOKEN}}}} placeholders left in prose, so edits would do nothing",
            )

    def test_export_keeps_the_panel_and_unfrozen_tokens(self) -> None:
        """The published page mounts the panel and still carries live tokens.

        The token is expected to survive into the exported HTML: the server renders the
        `{{TOKEN}}}` text and the client resolves it after hydration, which is what keeps it
        editable.  A build that resolved the token at compile time would freeze a lab
        address into the page and leave the reader's edits with nothing to act on, so this
        asserts the token is still there.  That the reader ends up seeing the resolved value
        is a post-hydration property and is asserted in the browser suite
        (`docs-site/scripts/verify_site.mjs`).
        """
        page = EXPORT_DIR / "getting-started" / "index.html"
        if not page.is_file():
            self.skipTest("No documentation export present; run the docs-site build first.")
        html = page.read_text(encoding="utf-8")
        self.assertIn("cluster-config", html)
        self.assertIn("data-profile", html)
        self.assertIn("1node", html)
        self.assertIn("{{SPARK0_IP}}", html, "token was frozen into a literal at build time")
        self.assertIn("localhost", html, "the default profile value should be pre-filled")

    def test_search_index_covers_the_panel_pages(self) -> None:
        """Every panel page is reachable through the generated search index."""
        index = EXPORT_DIR / "api" / "search"
        if not index.is_file():
            self.skipTest("No exported search index present; run the docs-site build first.")
        data = json.loads(index.read_text(encoding="utf-8"))
        records = (data.get("docs") or {}).get("docs") or {}
        urls = {str(record.get("url", "")) for record in records.values()}
        for stem in REQUIRED_PANEL_PAGES:
            slug = stem.rsplit("/", 1)[-1]
            self.assertTrue(
                any(url.rstrip("/").endswith(f"/{slug}") for url in urls),
                f"{stem} is missing from the search index",
            )


if __name__ == "__main__":
    unittest.main()
