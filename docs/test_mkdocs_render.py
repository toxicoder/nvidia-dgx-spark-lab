#!/usr/bin/env python3
"""
Render-oriented tests for the MkDocs site.

These tests actually invoke a docs build (the server-side render)
and inspect the output HTML + source to catch problems that only
appear when the pages are "run" in a browser (Mermaid syntax that
passes md parsing but fails at JS render time, missing interactive
elements, JS asset references, etc.).

Additionally: full browser screenshots of key pages are taken via
Playwright against the built static site (served locally).
- Current renders ("actuals") are *always generated* as test outputs/artifacts
  when the test runs (alongside other tests). Look for them in
  TEST_UNDECLARED_OUTPUTS_DIR/mkdocs-visual-actuals/ (Bazel) or actuals/ dir.
- They are compared to committed goldens under docs/tests/visual/goldens/.
- Visual diffs cause test failure. To approve a UI change:
  UPDATE_SNAPSHOTS=1 bazel run //docs:visual-update
  Then review + commit the updated .png goldens (PR approval required).

Run via the accompanying .sh wrapper as a Bazel sh_test, or directly
after `docs/setup-docs.sh` (which creates the venv with mkdocs + playwright).
"""
from __future__ import annotations

import http.server
import os
import re
import socket
import socketserver
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from playwright.sync_api import Page

try:
    from playwright.sync_api import sync_playwright
except Exception:
    sync_playwright = None

# Bring in the local modules if needed (modeled on test_generate_shell_docs)
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
GOLDENS_DIR = SCRIPT_DIR / "tests" / "visual" / "goldens"

# Hand-written pages listed in mkdocs.yml nav (excludes generated/).
HAND_WRITTEN_NAV_PAGES = [
    "index.md",
    "getting-started.md",
    "dgx-spark-notes.md",
    "reboot-safety.md",
    "models-catalog.md",
    "architecture.md",
    "monitoring-observability.md",
    "BUILDING_WITH_BAZEL.md",
    "gitea-ci-setup.md",
    "dev-workspaces.md",
    "troubleshooting.md",
    "CONTRIBUTING.md",
    "project-conventions.md",
]

# Key pages to screenshot for visual regression. These exercise
# Mermaid diagrams, interactive panels (command-vars), lists, tabs,
# the overall Material theme (CSS), custom CSS/JS, and full rendering.
# More pages = more golden images. When a new slug has no golden yet,
# the test auto-creates one (in workspace) so goldens are produced as
# part of running the test.
KEY_PAGES = [
    ("index", "/"),
    ("getting-started", "/getting-started/"),
    ("architecture", "/architecture/"),
    ("models-catalog", "/models-catalog/"),
    ("troubleshooting", "/troubleshooting/"),
    ("reboot-safety", "/reboot-safety/"),
    ("dgx-spark-notes", "/dgx-spark-notes/"),
    ("monitoring-observability", "/monitoring-observability/"),
    ("dev-workspaces", "/dev-workspaces/"),
    ("gitea-ci-setup", "/gitea-ci-setup/"),
]

# We will build to a temp dir so we don't pollute the workspace
# and can inspect the "rendered" output.

FRONTMATTER_RE = re.compile(
    r"^---\s*\n"
    r"(?P<body>.*?)"
    r"\n---\s*\n",
    re.S,
)
TITLE_RE = re.compile(r"^title:\s*.+$", re.M)
DESCRIPTION_RE = re.compile(r"^description:\s*.+$", re.M)
# Colon at end of a prose line, then list on the *next* line (no blank line between).
# Only horizontal whitespace allowed after the colon — not a blank line.
BAD_PROSE_LIST_RE = re.compile(r"[^\n]:[ \t]*\n-\s")
BARE_FENCE_RE = re.compile(r"^```\s*$", re.M)


def run_mkdocs_build_strict(site_dir: Path) -> None:
    """Run ``mkdocs build --strict`` to a temporary site directory.

    Exercises the full Markdown, extensions, templates, and assets render
    step. When MkDocs is unavailable in the current environment, the build
    is skipped and source-based checks still run.

    Args:
        site_dir: Output directory for the rendered static site.

    Raises:
        subprocess.CalledProcessError: If MkDocs is installed and the build fails.
    """
    try:
        import mkdocs  # noqa: F401
    except Exception:
        # No mkdocs in this python env; the source-based checks below
        # are still very useful and will catch the historical failure modes.
        return

    cmd = [
        sys.executable, "-m", "mkdocs", "build",
        "--strict",
        "--config-file", str(REPO_ROOT / "mkdocs.yml"),
        "--site-dir", str(site_dir),
    ]
    env = os.environ.copy()
    subprocess.check_call(cmd, cwd=REPO_ROOT, env=env)


def strip_fenced_blocks(text: str) -> str:
    """Remove fenced code blocks so prose/list checks ignore examples.

    Args:
        text: Markdown source text.

    Returns:
        Input text with fenced code blocks removed.
    """
    return re.sub(r"```.*?```", "", text, flags=re.S)


def prose_regions(text: str) -> str:
    """Return prose-only text with frontmatter and fenced blocks removed.

    Args:
        text: Markdown source text.

    Returns:
        Prose-only Markdown suitable for list and formatting checks.
    """
    text = FRONTMATTER_RE.sub("", text, count=1)
    return strip_fenced_blocks(text)


def bare_fence_openings(text: str) -> list[int]:
    """Return line numbers of opening fences missing a language tag.

    Args:
        text: Markdown source text.

    Returns:
        One-based line numbers for bare opening fences (`` ``` ``).
    """
    in_fence = False
    violations: list[int] = []
    for idx, line in enumerate(text.splitlines(), start=1):
        m = re.match(r"^```(\w*)", line)
        if not m:
            continue
        lang = m.group(1)
        if not in_fence:
            if not lang:
                violations.append(idx)
            in_fence = True
        else:
            in_fence = False
    return violations


class QuietHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Silent handler for the in-test static site server."""

    def log_message(self, format: str, *args: object) -> None:
        """Suppress request logging so test output stays clean.

        Args:
            format: Log message format string from ``SimpleHTTPRequestHandler``.
            *args: Format arguments for the log message.
        """
        pass


def start_static_server(
    site_dir: Path,
) -> tuple[str, threading.Thread, socketserver.TCPServer]:
    """Start a local HTTP server serving the built site on a free port.

    Args:
        site_dir: Directory containing the rendered static MkDocs site.

    Returns:
        Tuple of base URL, daemon server thread, and TCP server instance.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        port = s.getsockname()[1]

    def make_handler(
        request: socket.socket,
        client_address: tuple[str, int],
        server: socketserver.BaseServer,
    ) -> QuietHTTPRequestHandler:
        """Create a quiet static file handler rooted at ``site_dir``.

        Args:
            request: Client socket accepted by the TCP server.
            client_address: Remote address tuple for the client connection.
            server: TCP server instance dispatching this handler.

        Returns:
            Handler instance serving files from ``site_dir``.
        """
        return QuietHTTPRequestHandler(
            request, client_address, server, directory=str(site_dir)
        )

    httpd = socketserver.TCPServer(("", port), make_handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return f"http://localhost:{port}", thread, httpd


class TestMkDocsRender(unittest.TestCase):
    """Render-oriented integration tests for the MkDocs documentation site."""

    site_dir: Path
    server_base: str | None
    server_thread: threading.Thread | None
    httpd: socketserver.TCPServer | None

    @classmethod
    def setUpClass(cls) -> None:
        """Build the MkDocs site once and optionally start a static file server."""
        cls.site_dir = Path(tempfile.mkdtemp(prefix="mkdocs-render-test-"))
        run_mkdocs_build_strict(cls.site_dir)

        # Visual support: start an in-process static server over the built site
        # so Playwright can load real rendered pages (including JS execution for
        # Mermaid, command-vars panel, etc.).
        cls.server_base = None
        cls.server_thread = None
        cls.httpd = None
        mode = os.environ.get("MKDOCS_TEST_MODE", "all")
        need_server = mode in ("all", "visual")
        if (
            need_server
            and sync_playwright is not None
            and (cls.site_dir / "index.html").exists()
        ):
            try:
                base, thr, httpd = start_static_server(cls.site_dir)
                cls.server_base = base
                cls.server_thread = thr
                cls.httpd = httpd
            except Exception as e:
                print(f"WARNING: could not start static server for visuals: {e}", file=sys.stderr)

    @classmethod
    def tearDownClass(cls) -> None:
        """Shut down the in-process static server when it was started."""
        httpd = getattr(cls, "httpd", None)
        if httpd is not None:
            try:
                httpd.shutdown()
            except Exception:
                pass

    def test_build_produced_expected_pages(self) -> None:
        """Core nav pages exist as rendered HTML when a full build succeeds."""
        if not (self.site_dir / "index.html").exists():
            self.skipTest("Full mkdocs build not available in this test env (source checks still executed).")
        # Core pages from nav must exist in the rendered site
        expected = [
            "index.html",
            "getting-started/index.html",
            "dgx-spark-notes/index.html",
            "architecture/index.html",
            "troubleshooting/index.html",
        ]
        for rel in expected:
            self.assertTrue(
                (self.site_dir / rel).exists(),
                f"Expected rendered page missing: {rel}",
            )

    def test_frontmatter_on_nav_pages(self) -> None:
        """Every hand-written nav page must have YAML frontmatter with title + description."""
        for rel in HAND_WRITTEN_NAV_PAGES:
            md = REPO_ROOT / "docs" / rel
            self.assertTrue(md.exists(), f"Missing nav page: {rel}")
            text = md.read_text(encoding="utf-8", errors="replace")
            m = FRONTMATTER_RE.match(text)
            self.assertIsNotNone(m, f"{rel}: missing YAML frontmatter (--- title/description ---)")
            body = m.group("body") if m else ""
            self.assertRegex(body, TITLE_RE, f"{rel}: frontmatter missing title:")
            self.assertRegex(body, DESCRIPTION_RE, f"{rel}: frontmatter missing description:")

    def test_whats_on_this_page_sections(self) -> None:
        """Major pages must include scannable overview sections."""
        for rel in HAND_WRITTEN_NAV_PAGES:
            if rel == "index.md":
                continue  # index uses equivalent content under the home title
            text = (REPO_ROOT / "docs" / rel).read_text(encoding="utf-8", errors="replace")
            prose = prose_regions(text)
            self.assertIn("**What's on this page**", prose, f"{rel}: missing 'What's on this page'")
            self.assertRegex(
                prose,
                r"\*\*What this enables(?:\s*/\s*practical use)?\*\*",
                f"{rel}: missing 'What this enables' overview",
            )

    def test_code_fences_have_language_tags(self) -> None:
        """Opening code fences must specify a language (never bare ```)."""
        violations: list[str] = []
        for rel in HAND_WRITTEN_NAV_PAGES:
            md = REPO_ROOT / "docs" / rel
            text = md.read_text(encoding="utf-8", errors="replace")
            for line_no in bare_fence_openings(text):
                violations.append(f"{rel}:{line_no}")
        gen = REPO_ROOT / "docs/generated/shell/reference.md"
        if gen.exists():
            for line_no in bare_fence_openings(gen.read_text(encoding="utf-8", errors="replace")):
                violations.append(f"generated/shell/reference.md:{line_no}")
        self.assertEqual(
            violations,
            [],
            "Bare code fences without language tags:\n  " + "\n  ".join(violations),
        )

    def test_interactive_panel_present(self) -> None:
        """Cluster config interactive panel markup is present in built or source HTML."""
        # The live cluster vars panel (JS driven) must be detectable either in
        # a built HTML or (fallback) in the source md.
        if (self.site_dir / "getting-started/index.html").exists():
            html = (self.site_dir / "getting-started/index.html").read_text(encoding="utf-8")
            self.assertIn('class="cluster-config', html)
        else:
            src = (REPO_ROOT / "docs/getting-started.md").read_text(encoding="utf-8")
            self.assertIn("cluster-config", src)

    def test_mermaid_blocks_present_and_clean(self) -> None:
        """Mermaid source blocks avoid browser-only syntax errors and appear in HTML."""
        # Always validate the *source* mermaid blocks (this catches the
        # class of errors that only appear when the browser actually runs
        # the Mermaid JS). We also assert the built HTML (when present).
        bad_pattern = re.compile(r'\[[^"\]]*\{\{')
        for md in (REPO_ROOT / "docs").rglob("*.md"):
            text = md.read_text(encoding="utf-8", errors="replace")
            for m in re.finditer(r"```mermaid\s*(.*?)```", text, re.S):
                block = m.group(1)
                if bad_pattern.search(block):
                    self.fail(
                        f"Potentially unquoted {{...}} in mermaid node label in {md} "
                        "(this commonly produces 'Syntax error in text' only in the browser)."
                    )

        if (self.site_dir / "architecture/index.html").exists():
            html = (self.site_dir / "architecture/index.html").read_text(encoding="utf-8")
            self.assertIn("mermaid", html.lower())

    def test_js_assets_referenced(self) -> None:
        """Key client-side assets (command-vars, glightbox) are wired into the site."""
        # Key client-side features (command-vars, glightbox) must be wired.
        if (self.site_dir / "index.html").exists():
            html = (self.site_dir / "index.html").read_text(encoding="utf-8")
            self.assertIn("command-vars.js", html)
            self.assertIn("glightbox", html.lower())
        else:
            yml = (REPO_ROOT / "mkdocs.yml").read_text(encoding="utf-8")
            self.assertIn("command-vars.js", yml)

    def test_prose_lists_are_separated(self) -> None:
        """Prose paragraphs are separated from following lists by blank lines."""
        # Guard against collapsed lists ("text:\n- item" inside one <p>).
        # Markdown needs a blank line before a list after prose.
        violations: list[str] = []
        for md in (REPO_ROOT / "docs").rglob("*.md"):
            if "generated/" in md.as_posix():
                continue
            text = prose_regions(md.read_text(encoding="utf-8", errors="replace"))
            for m in BAD_PROSE_LIST_RE.finditer(text):
                line = text[: m.start()].count("\n") + 1
                violations.append(f"{md.relative_to(REPO_ROOT)}:{line}")
        gen = REPO_ROOT / "docs/generated/shell/reference.md"
        if gen.exists():
            gtext = prose_regions(gen.read_text(encoding="utf-8", errors="replace"))
            self.assertIn(
                "Core safety philosophy (enforced by this script and the workloads):\n\n-",
                gtext,
                "Generated reference: collapsed list after safety philosophy heading",
            )
            for m in BAD_PROSE_LIST_RE.finditer(gtext):
                line = gtext[: m.start()].count("\n") + 1
                violations.append(f"docs/generated/shell/reference.md:{line}")
        self.assertEqual(
            violations,
            [],
            "Prose immediately followed by a list (missing blank line):\n  "
            + "\n  ".join(violations),
        )
        # When full HTML build succeeded, spot-check a couple of fixed phrases render as ul
        if (self.site_dir / "models-catalog/index.html").exists():
            html = (self.site_dir / "models-catalog/index.html").read_text(encoding="utf-8")
            # After <p>It prints:</p> must come a <ul>, not - inside the same p
            self.assertNotIn("<p>It prints:\n-", html)
            self.assertIn("It prints:</p>\n<ul>", html)

    # ------------------------------------------------------------------
    # Visual golden screenshot tests (real browser rendering of the site)
    # ------------------------------------------------------------------
    def _take_and_compare(self, page: Page, slug: str) -> None:
        """Capture full page screenshot and compare (or update) against golden.

        Args:
            page: Playwright page loaded with a rendered docs URL.
            slug: Stable page identifier used for golden filenames.

        Raises:
            AssertionError: When the screenshot differs from the committed golden.
        """
        err = compare_page_screenshot(page, slug)
        if err:
            self.fail(err)

    def test_visual_screenshots_key_pages(self) -> None:
        """Render key pages in real browser and compare screenshots to committed goldens."""
        if self.server_base is None or sync_playwright is None:
            self.skipTest("Playwright + static server not available; visual goldens skipped (install browsers via setup).")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()
            try:
                for slug, suffix in KEY_PAGES:
                    page = context.new_page()
                    page.goto(self.server_base + suffix)
                    err = compare_page_screenshot(page, slug)
                    page.close()
                    if err:
                        self.fail(err)
            finally:
                context.close()
                browser.close()


def compare_page_screenshot(page: Page, slug: str) -> str | None:
    """Capture a page screenshot and compare it against the committed golden.

    Args:
        page: Playwright page loaded with a rendered docs URL.
        slug: Stable page identifier used for golden and actual filenames.

    Returns:
        Error message when a visual diff is detected, otherwise ``None``.
    """
    page.set_viewport_size({"width": 1280, "height": 900})
    page.wait_for_load_state("domcontentloaded")

    for selector, timeout in (
        (".md-header, .md-header__title, .md-typeset", 8000),
        (".md-content, main, article", 5000),
        (".cluster-config, [class*='cluster-config'], .command-vars", 6000),
        (".mermaid svg, svg[id*='mermaid']", 10000),
    ):
        try:
            page.wait_for_selector(selector, timeout=timeout)
        except Exception:
            pass

    try:
        page.wait_for_function(
            "() => document.fonts && document.fonts.status === 'loaded'",
            timeout=5000,
        )
    except Exception:
        pass

    page.wait_for_timeout(700)
    screenshot = page.screenshot(full_page=True, animations="disabled")

    undeclared = os.environ.get("TEST_UNDECLARED_OUTPUTS_DIR")
    if undeclared:
        actual_dir = Path(undeclared) / "mkdocs-visual-actuals"
    else:
        actual_dir = (
            (GOLDENS_DIR.parent / "actuals")
            if GOLDENS_DIR.parent
            else Path(tempfile.gettempdir()) / "mkdocs-visual-actuals"
        )
    actual_dir.mkdir(parents=True, exist_ok=True)
    actual_path = actual_dir / f"{slug}.png"
    actual_path.write_bytes(screenshot)
    print(f"Generated screenshot (actual render): {actual_path}")

    update = os.environ.get("UPDATE_SNAPSHOTS", "").lower() in ("1", "true", "yes")
    compare_golden = GOLDENS_DIR / f"{slug}.png"

    if update:
        ws = os.environ.get("BUILD_WORKSPACE_DIRECTORY")
        golden = (
            Path(ws) / "docs" / "tests" / "visual" / "goldens" / f"{slug}.png"
            if ws
            else compare_golden
        )
        golden.parent.mkdir(parents=True, exist_ok=True)
        golden.write_bytes(screenshot)
        print(f"UPDATED golden: {golden}")
        return None

    if not compare_golden.exists():
        ws = os.environ.get("BUILD_WORKSPACE_DIRECTORY")
        golden = (
            (Path(ws) / "docs" / "tests" / "visual" / "goldens" / f"{slug}.png")
            if ws
            else compare_golden
        )
        golden.parent.mkdir(parents=True, exist_ok=True)
        golden.write_bytes(screenshot)
        print(f"CREATED golden: {golden}")
        return None

    expected = compare_golden.read_bytes()
    if screenshot != expected:
        return (
            f"Visual diff detected for site page '{slug}.png' "
            f"(new size {len(screenshot)} != golden {len(expected)}). "
            "If this is an intentional UI/docs change, approve by updating: "
            "UPDATE_SNAPSHOTS=1 bazel run //docs:visual-update  (then git add the new png and PR review)."
        )
    return None


def _run_tests() -> None:
    """Run unittest suite, optionally filtered by ``MKDOCS_TEST_MODE``."""
    mode = os.environ.get("MKDOCS_TEST_MODE", "all")
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestMkDocsRender)
    if mode == "build":
        filtered = unittest.TestSuite()
        for case in suite:
            if isinstance(case, unittest.TestCase) and "visual" not in case._testMethodName:
                filtered.addTest(case)
        suite = filtered
    elif mode == "visual":
        suite = unittest.TestSuite()
        suite.addTest(TestMkDocsRender("test_visual_screenshots_key_pages"))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        sys.exit(1 if result.failures or result.errors else 5)


if __name__ == "__main__":
    _run_tests()