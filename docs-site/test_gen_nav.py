#!/usr/bin/env python3
"""Unit tests for the nav transcriber (docs-site/scripts/gen_nav.py).

Run: bazelisk test //docs-site:gen_nav_test   (or: python3 -m unittest -v test_gen_nav.py)

The transcriber is the bridge between the ``mkdocs.yml`` nav and the Fumadocs sidebar, and
``//tests:doc_coverage`` trusts its output. These tests pin the parsing rules against
fixtures plus the real ``mkdocs.yml`` while it still exists.
"""

from __future__ import annotations

import contextlib
import io
import json
import re
import pathlib
import sys
import tempfile
import unittest
from itertools import chain

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "scripts"))

import gen_nav  # noqa: E402

GEN_NAV_SCRIPT = pathlib.Path(gen_nav.__file__).resolve()

TWO_TABS = """
site_name: x
nav:
  - Home: index.md
  - Start:
      - Overview: start/index.md
      - Getting Started: getting-started.md
      - Subsection:
          - Deep: start/deep.md
  - Operate:
      - Overview: operate/index.md
plugins:
  - search
"""

INDENTED_TABS = """
nav:
    - Home: index.md
    - Guide:
        - Intro: guide/index.md
"""


class ParseNavTests(unittest.TestCase):
    """Tab, page, and nested-group entries are read out of the nav block."""

    def test_tabs_and_pages_are_parsed_in_order(self) -> None:
        tabs = gen_nav.parse_nav(TWO_TABS)
        self.assertEqual(["Home", "Start", "Operate"], [tab["title"] for tab in tabs])
        self.assertEqual(["index.md"], [p["path"] for p in tabs[0]["pages"]])
        self.assertEqual(
            ["start/index.md", "getting-started.md", "start/deep.md"],
            [p["path"] for p in tabs[1]["pages"]],
        )

    def test_leaf_titles_are_preserved_verbatim(self) -> None:
        tabs = gen_nav.parse_nav(TWO_TABS)
        self.assertEqual("Getting Started", tabs[1]["pages"][1]["title"])

    def test_nested_group_leaves_stay_in_their_tab(self) -> None:
        tabs = gen_nav.parse_nav(TWO_TABS)
        self.assertEqual(3, len(tabs[1]["pages"]))
        self.assertEqual(["operate/index.md"], [p["path"] for p in tabs[2]["pages"]])

    def test_siblings_indented_like_tabs_are_read_as_tabs(self) -> None:
        tabs = gen_nav.parse_nav(INDENTED_TABS)
        self.assertEqual(["Home", "Guide"], [tab["title"] for tab in tabs])

    def test_nav_block_stops_at_the_next_top_level_key(self) -> None:
        tabs = gen_nav.parse_nav(TWO_TABS)
        self.assertNotIn("search", str(tabs))

    def test_missing_nav_raises(self) -> None:
        with self.assertRaises(ValueError):
            gen_nav.parse_nav("site_name: x\n")

    def test_empty_nav_raises(self) -> None:
        with self.assertRaises(ValueError):
            gen_nav.parse_nav("nav:\nplugins: []\n")

    def test_unparsable_line_raises(self) -> None:
        with self.assertRaises(ValueError):
            gen_nav.parse_nav("nav:\n  - just text\n")

    def test_leaf_before_any_tab_raises(self) -> None:
        """A page listed outside a tab has no sidebar to land in, so it is refused.

        The bullet sits deeper than the tab bullet that follows it, so it cannot belong to
        any group.
        """
        with self.assertRaises(ValueError):
            gen_nav.parse_nav("nav:\n    - Orphan: orphan.md\n  - Start:\n      - Deep: deep.md\n")


class ValidateTests(unittest.TestCase):
    """The validator reports missing and duplicated pages instead of passing silently."""

    def test_missing_page_is_reported(self) -> None:
        tabs = [{"title": "T", "pages": [{"title": "x", "path": "definitely-not-here.md"}]}]
        problems = gen_nav.validate(tabs)
        self.assertEqual(1, len(problems))
        self.assertIn("definitely-not-here.md", problems[0])

    def test_duplicate_page_is_reported(self) -> None:
        page = {"title": "x", "path": "index.md"}
        problems = gen_nav.validate(
            [{"title": "A", "pages": [page]}, {"title": "B", "pages": [dict(page)]}]
        )
        self.assertIn("listed twice", " ".join(problems))

    def test_real_nav_validates_clean(self) -> None:
        """Every page the current mkdocs.yml nav points at exists on disk."""
        if not gen_nav.MKDOCS_YML.is_file():
            self.skipTest("mkdocs.yml retired; nav.json is the source of truth now")
        problems = gen_nav.validate(
            gen_nav.parse_nav(gen_nav.MKDOCS_YML.read_text(encoding="utf-8"))
        )
        self.assertEqual([], problems)


class RepoContractTests(unittest.TestCase):
    """The committed nav.json matches mkdocs.yml and covers every hand-written page."""

    def test_committed_nav_json_matches_mkdocs_nav(self) -> None:
        if not gen_nav.MKDOCS_YML.is_file():
            self.skipTest("mkdocs.yml retired; nav.json is the source of truth now")
        if not gen_nav.OUT_JSON.is_file():
            self.fail("docs-site/lib/nav.json was never generated")
        committed = json.loads(gen_nav.OUT_JSON.read_text(encoding="utf-8"))
        self.assertEqual(
            gen_nav.parse_nav(gen_nav.MKDOCS_YML.read_text(encoding="utf-8")), committed
        )

    def test_nav_covers_every_hand_written_page(self) -> None:
        if not gen_nav.OUT_JSON.is_file():
            self.skipTest("nav.json not generated yet")
        listed = {
            page["path"]
            for tab in json.loads(gen_nav.OUT_JSON.read_text(encoding="utf-8"))
            for page in tab["pages"]
        }
        docs = gen_nav.REPO_ROOT / "docs"
        on_disk = {
            str(path.relative_to(docs))
            for path in chain(docs.rglob("**/*.md"), docs.rglob("**/*.mdx"))
            if not {"generated", "includes", "assets", "tests", "__pycache__"}
            & set(path.relative_to(docs).parts)
        }
        generated = {"generated/shell/reference.md", "generated/dashboard-api/README.md"}
        # nav.json transcribed the MkDocs nav, which names pages by their pre-migration
        # `.md` path; pages that needed JSX were renamed, so compare without the suffix.
        strip = lambda names: {re.sub(r"\.mdx?$", "", name) for name in names}
        self.assertEqual(set(), strip(on_disk) - strip(listed), "pages on disk are missing from nav.json")
        self.assertEqual(
            set(),
            strip(listed) - strip(on_disk) - strip(generated),
            "nav.json points at pages that are neither on disk nor generated",
        )


class CheckWithoutMkdocsTests(unittest.TestCase):
    """After mkdocs.yml is retired, --check still guards nav.json against the tree."""

    def test_check_passes_against_disk_when_mkdocs_is_gone(self) -> None:
        """The committed nav.json is validated against files on disk, not a missing YAML."""
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root / "docs-site" / "lib").mkdir(parents=True)
            (root / "docs").mkdir()
            (root / "docs" / "index.mdx").write_text("# Home\n", encoding="utf-8")
            (root / "docs-site" / "lib" / "nav.json").write_text(
                json.dumps(
                    [{"title": "Home", "pages": [{"title": "Home", "path": "index.md"}]}],
                    indent=2,
                    ensure_ascii=False,
                )
                + "\n",
                encoding="utf-8",
            )
            with _point_at(root):
                self.assertEqual(0, gen_nav.main(["--check"]))

    def test_check_fails_when_a_nav_page_went_missing(self) -> None:
        """A nav entry that no longer has a page on disk is still caught."""
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root / "docs-site" / "lib").mkdir(parents=True)
            (root / "docs").mkdir()
            (root / "docs-site" / "lib" / "nav.json").write_text(
                json.dumps(
                    [{"title": "Home", "pages": [{"title": "Gone", "path": "gone.md"}]}]
                ),
                encoding="utf-8",
            )
            with _point_at(root):
                self.assertEqual(1, gen_nav.main(["--check"]))


class MainCliTests(unittest.TestCase):
    """``main()`` is what Bazel and the docs scripts call, so its modes are contract."""

    def _fixture(self, root: pathlib.Path, *, with_mkdocs: bool = True) -> None:
        """Lay out a minimal checkout whose pages cover every path the fixture nav lists."""
        (root / "docs-site" / "lib").mkdir(parents=True)
        docs = root / "docs"
        for path in (
            "index.md",
            "start/index.md",
            "getting-started.md",
            "start/deep.md",
            "operate/index.md",
        ):
            page = docs / path
            page.parent.mkdir(parents=True, exist_ok=True)
            page.write_text(f"# {page.stem}\n", encoding="utf-8")
        if with_mkdocs:
            (root / "mkdocs.yml").write_text(TWO_TABS, encoding="utf-8")

    def test_writes_nav_json_from_mkdocs(self) -> None:
        """The generator emits the committed file and reports what it covered."""
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            self._fixture(root)
            with _point_at(root):
                self.assertEqual(0, gen_nav.main([]))
            written = json.loads((root / "docs-site" / "lib" / "nav.json").read_text(encoding="utf-8"))
            self.assertEqual(["Home", "Start", "Operate"], [tab["title"] for tab in written])

    def test_print_mode_writes_stdout_only(self) -> None:
        """--print feeds the pipeline without touching the working tree."""
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            self._fixture(root)
            buffer = io.StringIO()
            with _point_at(root), contextlib.redirect_stdout(buffer):
                self.assertEqual(0, gen_nav.main(["--print"]))
            self.assertEqual(["Home", "Start", "Operate"], [tab["title"] for tab in json.loads(buffer.getvalue())])
            self.assertFalse((root / "docs-site" / "lib" / "nav.json").is_file())

    def test_check_reports_stale_nav_json(self) -> None:
        """A committed file that no longer matches the nav fails instead of riding along."""
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            self._fixture(root)
            (root / "docs-site" / "lib" / "nav.json").write_text("[]\n", encoding="utf-8")
            with _point_at(root), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(1, gen_nav.main(["--check"]))

    def test_check_accepts_an_up_to_date_nav_json(self) -> None:
        """The green case for the gate //tests:doc_coverage relies on."""
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            self._fixture(root)
            with _point_at(root):
                self.assertEqual(0, gen_nav.main([]))
            buffer = io.StringIO()
            with _point_at(root), contextlib.redirect_stdout(buffer):
                self.assertEqual(0, gen_nav.main(["--check"]))
            self.assertIn("up to date", buffer.getvalue())

    def test_missing_mkdocs_without_check_is_an_error(self) -> None:
        """With no nav to read and no committed file to verify, the run must fail loudly.

        The message has to say what to do instead, because in a migrated repository
        ``mkdocs.yml`` is gone and this is the command a contributor reaches for first.
        """
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            self._fixture(root, with_mkdocs=False)
            errors = io.StringIO()
            with _point_at(root), contextlib.redirect_stderr(errors):
                self.assertEqual(1, gen_nav.main([]))
            self.assertIn("nav:check", errors.getvalue())
            self.assertIn("nav.json", errors.getvalue())

    def test_main_module_guard(self) -> None:
        """The script form the Bazel target and docs scripts invoke works.

        Re-executing the module re-reads its paths from its own file location, so the patching
        fixtures cannot apply here; ``--check`` is used because it is the mode CI runs and it
        only reads the committed ``nav.json`` and the docs tree.
        """
        import runpy

        with _captured_args(["--check"]), contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(SystemExit) as raised:
                runpy.run_path(str(GEN_NAV_SCRIPT), run_name="__main__")
        self.assertEqual(raised.exception.code, 0, "the committed nav.json must be current")


@contextlib.contextmanager
def _captured_args(argv: list[str]):
    """Pin ``sys.argv`` so a module run as ``__main__`` sees a known command line."""
    original = sys.argv
    sys.argv = ["gen_nav.py", *argv]
    try:
        yield
    finally:
        sys.argv = original


class _point_at:
    """Temporarily repoint the transcriber's module-level paths at a fixture root."""

    def __init__(self, root: pathlib.Path) -> None:
        self._paths = {
            "REPO_ROOT": root,
            "MKDOCS_YML": root / "mkdocs.yml",
            "OUT_JSON": root / "docs-site" / "lib" / "nav.json",
        }
        self._saved: dict[str, pathlib.Path] = {}

    def __enter__(self) -> "_point_at":
        for name, value in self._paths.items():
            self._saved[name] = getattr(gen_nav, name)
            setattr(gen_nav, name, value)
        return self

    def __exit__(self, *_exc: object) -> None:
        for name, value in self._saved.items():
            setattr(gen_nav, name, value)


if __name__ == "__main__":
    unittest.main(verbosity=2)
