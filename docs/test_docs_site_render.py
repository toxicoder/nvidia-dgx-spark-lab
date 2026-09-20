#!/usr/bin/env python3
"""Render-oriented checks for the Fumadocs documentation site.

These checks inspect the content the site actually serves.  Half of them run against the
sources under `docs/` and always execute; the rest need the exported site under
`docs-site/out/` and are skipped when that build has not been produced in this test env.

The point of the source-level checks is that a page can pass the Markdown/MDX parse and
still be wrong once a reader opens it: a code fence with no language renders unhighlighted,
a `{{TOKEN}}` that was frozen into a literal can never be edited, a Mermaid node label with
an unquoted brace fails only in the browser.  Those are what this catches.

Browser-level visual regression (screenshots against committed goldens) lives in
`docs-site/tests/visual/*.spec.mjs` and runs through Playwright, not here, because the
rendering is now a Next.js client-side hydration rather than a static template.

Run via the accompanying shell wrapper as a Bazel sh_test, or directly:
    python3 docs/test_docs_site_render.py
"""

from __future__ import annotations

import json
import re
import sys
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
DOCS_DIR = REPO_ROOT / "docs"
SITE_DIR = REPO_ROOT / "docs-site"
EXPORT_DIR = SITE_DIR / "out"
NAV_JSON = SITE_DIR / "lib" / "nav.json"

# Frontmatter block at the very top of a page.
FRONTMATTER_RE = re.compile(r"^---\s*\n(?P<body>.*?)\n---\s*\n", re.S)
TITLE_RE = re.compile(r"^title:\s*.+$", re.M)
DESCRIPTION_RE = re.compile(r"^description:\s*.+$", re.M)
TAGS_RE = re.compile(r"^tags:\s*\[", re.M)
# Colon at the end of a prose line, then a list on the very next line: the two collapse
# into a single paragraph because Markdown wants a blank line between them.
BAD_PROSE_LIST_RE = re.compile(r"[^\n]:[ \t]*\n-\s")
# An unquoted `{...}` inside a Mermaid node label is accepted by the parser but throws
# "Syntax error in text" once the browser runs the diagram.
BAD_MERMAID_LABEL_RE = re.compile(r'\[[^"\]]*\{\{')
# Architecture sections on the published site must be Mermaid, not ASCII.
ARCH_HEADING_RE = re.compile(r"^## Architecture\b", re.M)
MERMAID_FENCE_RE = re.compile(r"^```mermaid\b", re.M)
TEXT_FENCE_RE = re.compile(r"^```text[^\n]*\n(.*?)```", re.S | re.M)
# Arrow flows and box-drawing trees in ```text fences are diagrams, not samples.
ASCII_FLOW_RE = re.compile(r"[→├└│]")
# Asset references the exported HTML asks the browser to fetch, used to prove the export is
# self-consistent with the prefix it is served under.
_ASSET_REF_RE = re.compile(
    r'''(?:"|')((?:/[A-Za-z0-9._@~-][A-Za-z0-9._@~+/%-]*|_next/[A-Za-z0-9._@~+/%-]+))'''
    r'''(?:"|')'''
)
# Spark CX-7 is 200 Gb/s per QSFP port. This lab uses one 200G cable or a 200G ring.
# CRS804 "400G QSFP-DD" switch-port language is allowed (no dual- / ~400G / "400G each").
FORBIDDEN_400G_RE = re.compile(
    r"(?:dual[\s-]*~?400\s*[Gg]|~400G|400G\s+aggregate|400G\s+each|2-node\s+400G)",
    re.IGNORECASE,
)


def load_nav_pages() -> list[str]:
    """Return the content paths listed in the site navigation, as repo-relative paths.

    The navigation is generated from the former `mkdocs.yml` nav by
    `docs-site/scripts/gen_nav.py`, so it is the single source of truth for which pages a
    reader can reach.  Generated reference trees are excluded: they are emitted by the
    doc generators and are covered by `//docs:test_generate_shell_docs`.

    Returns:
        POSIX paths relative to `docs/`, e.g. ``operate/index.mdx``.

    Raises:
        FileNotFoundError: If the generated navigation file is missing.
        AssertionError: If the navigation lists no pages at all.
    """
    tree = json.loads(NAV_JSON.read_text(encoding="utf-8"))
    pages: list[str] = []
    for group in tree:
        for entry in group.get("pages", []):
            path = entry.get("path")
            if path:
                pages.append(path)
    assert pages, f"{NAV_JSON} lists no pages; run npm run nav:generate in docs-site/"
    return pages


def hand_written_nav_pages() -> list[str]:
    """Return the navigable pages that an author maintains, minus the generated trees.

    Returns:
        POSIX paths relative to `docs/` for the hand-written pages only.
    """
    return [p for p in load_nav_pages() if not p.startswith("generated/")]


def page_source(rel: str) -> str:
    """Read a content page, accepting either extension the source loader accepts.

    Args:
        rel: Path relative to `docs/` as recorded in the navigation.

    Returns:
        The page text.

    Raises:
        AssertionError: If neither the `.mdx` nor the `.md` form exists.
    """
    stem = rel[: rel.rfind(".")] if "." in rel else rel
    for candidate in (DOCS_DIR / f"{stem}.mdx", DOCS_DIR / f"{stem}.md"):
        if candidate.exists():
            return candidate.read_text(encoding="utf-8", errors="replace")
    raise AssertionError(f"Missing content page for nav entry {rel!r} (looked for {stem}.mdx/.md)")


def strip_fenced_blocks(text: str) -> str:
    """Remove fenced code blocks so prose and list checks ignore examples.

    Args:
        text: Markdown or MDX source text.

    Returns:
        The input with fenced code blocks removed.
    """
    return re.sub(r"^```.*?^```", "", text, flags=re.S | re.M)


def prose_regions(text: str) -> str:
    """Return prose-only text with frontmatter, imports and fenced blocks removed.

    Args:
        text: Markdown or MDX source text.

    Returns:
        Prose-only text suitable for list and formatting checks.
    """
    text = FRONTMATTER_RE.sub("", text, count=1)
    text = re.sub(r"(?m)^import\s+\S+\s+from\s+\S+\s*$", "", text)
    return strip_fenced_blocks(text)


def bare_fence_openings(text: str) -> list[int]:
    """Return line numbers of opening fences that omit a language tag.

    Args:
        text: Markdown or MDX source text.

    Returns:
        One-based line numbers of bare opening fences.
    """
    in_fence = False
    violations: list[int] = []
    for idx, line in enumerate(text.splitlines(), start=1):
        match = re.match(r"^```(\w*)", line)
        if not match:
            continue
        if not in_fence:
            if not match.group(1):
                violations.append(idx)
            in_fence = True
        else:
            in_fence = False
    return violations


def exported_pages() -> list[str]:
    """Return exported route directories, or an empty list when the build is absent.

    Returns:
        Route paths such as ``/getting-started/``, empty if `docs-site/out/` was not built.
    """
    if not (EXPORT_DIR / "index.html").exists():
        return []
    routes: list[str] = []
    for html in EXPORT_DIR.rglob("index.html"):
        rel = html.parent.relative_to(EXPORT_DIR).as_posix()
        routes.append("/" if rel == "." else f"/{rel}/")
    return routes


def hand_written_doc_paths() -> list[Path]:
    """Return hand-written Markdown/MDX pages under `docs/`, excluding generated trees.

    Returns:
        Paths to author-maintained pages the GitHub Pages site publishes.
    """
    paths: list[Path] = []
    for path in DOCS_DIR.rglob("*"):
        if path.suffix not in {".md", ".mdx"}:
            continue
        if "generated/" in path.as_posix():
            continue
        paths.append(path)
    return paths


def wording_scan_paths() -> list[Path]:
    """Return markdown files that must not claim a dual-400G Spark interconnect.

    Always includes the published ``docs/`` tree (hand-written, includes, generated).
    Also includes the repo README, root CONTRIBUTING, and workload READMEs when those
    files are present next to the test (full checkout or extra Bazel data).
    """
    paths: list[Path] = [
        path for path in DOCS_DIR.rglob("*") if path.suffix in {".md", ".mdx"} and path.is_file()
    ]
    for extra in (REPO_ROOT / "README.md", REPO_ROOT / "CONTRIBUTING.md"):
        if extra.is_file():
            paths.append(extra)
    workloads = REPO_ROOT / "k8s" / "workloads"
    if workloads.is_dir():
        paths.extend(path for path in workloads.rglob("README.md") if path.is_file())
    return paths


def forbidden_400g_hits(text: str) -> list[str]:
    """Return each dual-400G / ~400G-aggregate match in ``text``.

    Args:
        text: Markdown or other operator-facing prose.

    Returns:
        The matched substrings, in appearance order.
    """
    return [match.group(0) for match in FORBIDDEN_400G_RE.finditer(text)]


def is_directory_tree(body: str) -> bool:
    """Return whether a text fence is a directory listing rather than a diagram.

    A directory tree's first non-empty line ends with ``/`` (for example ``k8s/``).
    Architecture ASCII (Hermes host trees, request flows) does not.

    Args:
        body: Contents of a `` ```text `` fence, without the fences.

    Returns:
        True when the fence should be left as text.
    """
    for line in body.splitlines():
        stripped = line.strip()
        if stripped:
            return stripped.endswith("/")
    return False


def ascii_flow_offenders(text: str, rel: str) -> list[str]:
    """Return locations of `` ```text `` fences that are ASCII architecture diagrams.

    Args:
        text: Markdown or MDX source.
        rel: Repo-relative path used in failure messages.

    Returns:
        Strings ``path:line`` for each offending fence.
    """
    found: list[str] = []
    for match in TEXT_FENCE_RE.finditer(text):
        body = match.group(1)
        if is_directory_tree(body):
            continue
        if ASCII_FLOW_RE.search(body):
            line = text[: match.start()].count("\n") + 1
            found.append(f"{rel}:{line}")
    return found


def read_export(route: str) -> str:
    """Read the exported HTML for one route.

    Args:
        route: Route path beginning with ``/``.

    Returns:
        The exported HTML.

    Raises:
        AssertionError: If that route was not exported.
    """
    target = EXPORT_DIR / (route.strip("/") or ".") / "index.html"
    assert target.exists(), f"Route not exported: {route}"
    return target.read_text(encoding="utf-8", errors="replace")


class TestDocsSiteRender(unittest.TestCase):
    """Checks that run on the content the documentation site serves."""

    maxDiff = 1500

    def test_navigation_lists_every_page(self) -> None:
        """The generated navigation covers the pages the old site published."""
        pages = load_nav_pages()
        self.assertGreaterEqual(len(pages), 40, "navigation looks far too small")
        for required in ("index.mdx", "index.md", "getting-started.mdx", "resource-guard.mdx"):
            stems = {f"{p[: p.rfind('.')]}.{e}" for p in [required] for e in ("md", "mdx")}
            self.assertTrue(
                any(p in pages or p in stems for p in (required,)),
                f"navigation is missing {required}",
            )
        # The generated reference trees are reachable from the navigation, exactly as the
        # former mkdocs.yml published them; the generators that fill them are covered by
        # //docs:test_generate_shell_docs, not here.
        for expected in ("generated/shell/reference.md", "generated/dashboard-api/README.md"):
            self.assertIn(expected, pages, f"generated reference is missing from the nav: {expected}")

    def test_frontmatter_on_nav_pages(self) -> None:
        """Every hand-written navigable page carries title, description and tags frontmatter.

        The generated reference trees are excluded: they are emitted by the shell/dashboard
        doc generators, which have their own tests, and they carry no author frontmatter.
        """
        for rel in hand_written_nav_pages():
            body = FRONTMATTER_RE.match(page_source(rel))
            self.assertIsNotNone(body, f"{rel}: missing YAML frontmatter block")
            fields = body.group("body") if body else ""
            self.assertRegex(fields, TITLE_RE, f"{rel}: frontmatter has no title:")
            self.assertRegex(fields, DESCRIPTION_RE, f"{rel}: frontmatter has no description:")
            self.assertRegex(fields, TAGS_RE, f"{rel}: frontmatter has no tags:")

    def test_whats_on_this_page_sections(self) -> None:
        """Every navigable page opens with the two scannable overview sections."""
        for rel in hand_written_nav_pages():
            prose = prose_regions(page_source(rel))
            self.assertIn("**What's on this page**", prose, f"{rel}: missing 'What's on this page'")
            self.assertRegex(
                prose,
                r"\*\*What this enables(?:\s*/\s*practical use)?\*\*",
                f"{rel}: missing 'What this enables' overview",
            )

    def test_code_fences_have_language_tags(self) -> None:
        """Opening code fences always name a language; a bare fence renders unhighlighted."""
        violations: list[str] = []
        for rel in hand_written_nav_pages():
            for line_no in bare_fence_openings(page_source(rel)):
                violations.append(f"{rel}:{line_no}")
        generated = DOCS_DIR / "generated/shell/reference.md"
        if generated.exists():
            for line_no in bare_fence_openings(generated.read_text(encoding="utf-8", errors="replace")):
                violations.append(f"generated/shell/reference.md:{line_no}")
        self.assertEqual(violations, [], "Bare code fences without a language tag: " + ", ".join(violations))

    def test_prose_lists_are_separated(self) -> None:
        """A list that follows prose is separated from it by a blank line."""
        violations: list[str] = []
        for path in DOCS_DIR.rglob("*.md*"):
            if "generated/" in path.as_posix():
                continue
            text = prose_regions(path.read_text(encoding="utf-8", errors="replace"))
            for match in BAD_PROSE_LIST_RE.finditer(text):
                line = text[: match.start()].count("\n") + 1
                violations.append(f"{path.relative_to(REPO_ROOT)}:{line}")
        self.assertEqual(violations, [], "Prose immediately followed by a list: " + ", ".join(violations))

    def test_mermaid_labels_are_quoted(self) -> None:
        """Mermaid node labels that contain braces are quoted, else the browser errors."""
        offenders: list[str] = []
        blocks = 0
        for path in DOCS_DIR.rglob("*.md*"):
            text = path.read_text(encoding="utf-8", errors="replace")
            for match in re.finditer(r"```mermaid\s*(.*?)```", text, re.S):
                blocks += 1
                if BAD_MERMAID_LABEL_RE.search(match.group(1)):
                    offenders.append(path.relative_to(REPO_ROOT).as_posix())
        self.assertGreater(blocks, 0, "no mermaid diagrams found; the port lost them")
        self.assertEqual(offenders, [], "Unquoted {…} in a mermaid node label: " + ", ".join(sorted(set(offenders))))

    def test_architecture_headings_have_mermaid(self) -> None:
        """A ## Architecture section on a published page is drawn as Mermaid, not prose or ASCII."""
        missing: list[str] = []
        for path in hand_written_doc_paths():
            text = path.read_text(encoding="utf-8", errors="replace")
            if not ARCH_HEADING_RE.search(text):
                continue
            if not MERMAID_FENCE_RE.search(text):
                missing.append(path.relative_to(REPO_ROOT).as_posix())
        self.assertEqual(
            missing,
            [],
            "Architecture heading without a mermaid fence: " + ", ".join(sorted(missing)),
        )

    def test_forbidden_400g_hits_allows_switch_hardware(self) -> None:
        """CRS804 400G QSFP-DD port language is switch hardware, not a Spark dual-400G pair."""
        self.assertEqual(forbidden_400g_hits("managed 4-port 400G QSFP-DD device"), [])
        self.assertEqual(forbidden_400g_hits("one 400G port split into two 200G breakout lanes"), [])
        self.assertIn("~400G", forbidden_400g_hits("dual QSFP ~400G aggregate"))
        self.assertEqual(forbidden_400g_hits("400G aggregate"), ["400G aggregate"])
        self.assertTrue(forbidden_400g_hits("dual-400G pair"))
        self.assertTrue(forbidden_400g_hits("2-node 400G NCCL vars"))
        self.assertTrue(forbidden_400g_hits("400G each"))

    def test_docs_do_not_claim_dual_400g_interconnect(self) -> None:
        """Operator docs describe 200 Gb/s links or a QSFP ring, not a dual-400G pair."""
        scanned = 0
        offenders: list[str] = []
        for path in wording_scan_paths():
            scanned += 1
            text = path.read_text(encoding="utf-8", errors="replace")
            hits = forbidden_400g_hits(text)
            if hits:
                rel = path.relative_to(REPO_ROOT).as_posix() if path.is_relative_to(REPO_ROOT) else str(path)
                offenders.append(f"{rel}: {', '.join(hits[:4])}")
        self.assertGreater(scanned, 20, "wording scan found too few markdown files")
        self.assertEqual(offenders, [], "dual-400G Spark interconnect wording: " + "; ".join(offenders))

    def test_no_ascii_flow_diagrams(self) -> None:
        """Arrow flows and box-drawing trees in ```text fences must be Mermaid instead.

        Directory listings (first non-empty line ends with ``/``) stay text.
        """
        offenders: list[str] = []
        for path in hand_written_doc_paths():
            rel = path.relative_to(REPO_ROOT).as_posix()
            offenders.extend(ascii_flow_offenders(path.read_text(encoding="utf-8", errors="replace"), rel))
        self.assertEqual(offenders, [], "ASCII architecture diagram in a text fence: " + ", ".join(offenders))

    def test_no_mistakes_in_information_architecture(self) -> None:
        """The six top-level sections of the old site are all present."""
        groups = [group["title"] for group in json.loads(NAV_JSON.read_text(encoding="utf-8"))]
        self.assertEqual(groups, ["Home", "Start", "Concepts", "Operate", "Reference", "Contribute"])

    def test_search_index_is_generated_and_tagged(self) -> None:
        """The build emits a search index, and it carries the frontmatter tags."""
        candidates = (EXPORT_DIR / "api/search/index.json", EXPORT_DIR / "api/search")
        index = next((c for c in candidates if c.is_file()), None)
        if index is None:
            self.skipTest("No exported search index; run the docs-site build first.")
        data = json.loads(index.read_text(encoding="utf-8"))
        self.assertEqual(data.get("type"), "advanced", "unexpected search index flavour")
        body = data.get("docs") or {}
        records = body.get("docs") if isinstance(body, dict) else None
        self.assertIsInstance(records, dict, "search index has no document table")
        self.assertGreater(len(records), 100, "search index looks empty")
        pages = [r for r in records.values() if r.get("type") == "page"]
        tagged = [r for r in records.values() if r.get("type") == "page" and r.get("tags")]
        self.assertGreater(len(pages), 30, "search index has no page entries")
        self.assertGreater(len(tagged), 30, "search index has no tag-derived entries")
        # Tags are what make "find by tag" work; prove one known tag is actually indexed.
        all_tags = {t for r in records.values() for t in (r.get("tags") or [])}
        self.assertIn("kubernetes", all_tags, "expected the kubernetes tag to be searchable")

    def test_exported_pages_have_interactive_cluster_panel(self) -> None:
        """The cluster-variables panel is present and keeps its tokens editable."""
        routes = exported_pages()
        if not routes:
            self.skipTest("No exported site; run the docs-site build first.")
        html = read_export("/getting-started/")
        self.assertIn("cluster-config", html)
        self.assertIn("data-var", html)
        self.assertIn("data-profile", html)
        self.assertIn("SPARK0_IP", html)

    def test_exported_home_wraps_page_overview(self) -> None:
        """The first What's on this page pair renders as the two-column panel."""
        routes = exported_pages()
        if not routes:
            self.skipTest("No exported site; run the docs-site build first.")
        html = read_export("/")
        self.assertIn("page-overview", html)
        self.assertIn('data-kind="contents"', html)
        self.assertIn('data-kind="enables"', html)
        self.assertIn("on this page", html)
        self.assertIn("What this enables", html)

    def test_exported_pages_render_mermaid_and_callouts(self) -> None:
        """Diagrams and callouts survive the export as real elements, not raw syntax."""
        routes = exported_pages()
        if not routes:
            self.skipTest("No exported site; run the docs-site build first.")
        html = read_export("/architecture/")
        self.assertIn("mermaid", html.lower())
        callout_html = read_export("/start/profiles/")
        self.assertIn("--callout-color", callout_html)
        self.assertIn("Modes collide", callout_html)

    def test_export_assets_resolve_at_the_served_root(self) -> None:
        """The export a reader gets has asset URLs that resolve where it is published.

        A build made with a ``basePath`` (the ``/latest`` and ``/development`` aliases) bakes
        that prefix into every script and stylesheet URL.  Serving such an export at the root
        404s all of them, which silently drops hydration: pages look right but Mermaid, the
        search dialog and the cluster-variables panel never come up.  That is invisible to a
        string check, so the referenced files are resolved on disk here.
        """
        routes = exported_pages()
        if not routes:
            self.skipTest("No exported site; run the docs-site build first.")
        missing: list[str] = []
        checked = 0
        for route in ("/", "/architecture/"):
            if route not in routes:
                continue
            html = read_export(route)
            for reference in _ASSET_REF_RE.findall(html):
                if reference.startswith(("http:", "https:", "//", "data:")):
                    continue
                # Internal page links look the same but resolve to a directory holding an
                # index file; only references that name a file are the browser's assets.
                if "." not in reference.rsplit("/", 1)[-1]:
                    continue
                target = EXPORT_DIR / reference.lstrip("/")
                checked += 1
                if not target.is_file():
                    missing.append(f"{route} -> {reference}")
        self.assertGreater(checked, 0, "no asset references found in the export")
        self.assertEqual([], missing[:10], "assets do not resolve from the export root")

    def test_exported_pages_link_to_the_repository(self) -> None:
        """Site chrome points at the repository and the edit link is branch aware."""
        routes = exported_pages()
        if not routes:
            self.skipTest("No exported site; run the docs-site build first.")
        html = read_export("/")
        self.assertIn("github.com/toxicoder/nvidia-dgx-spark-lab", html)
        self.assertIn("blob/main/docs/", html.replace("&amp;", "&"))
        self.assertNotIn("Material for MkDocs", html)


if __name__ == "__main__":
    unittest.main(verbosity=2)
