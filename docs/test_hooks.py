"""Unit tests for docs/hooks.py (MkDocs hooks: patch, banner, branch links)."""

from __future__ import annotations

import os
import unittest
from typing import Any, Iterator
from contextlib import contextmanager

from hooks import docs_git_ref, docs_version, on_config, on_page_markdown, on_post_page


@contextmanager
def _isolated_docs_env(**overrides: str | None) -> Iterator[None]:
    """Clear docs-related env vars, apply overrides, then restore.

    Args:
        **overrides: Env var name → value. ``None`` removes the variable.
    """
    keys = ("DGX_DOCS_VERSION", "MIKE_DOCS_VERSION", "DGX_DOCS_GIT_REF")
    saved: dict[str, str | None] = {k: os.environ.get(k) for k in keys}
    try:
        for k in keys:
            os.environ.pop(k, None)
        for name, value in overrides.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value
        yield
    finally:
        for k, prev in saved.items():
            if prev is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = prev


class TestDocsVersionAndGitRef(unittest.TestCase):
    """Tests for version/ref helpers used by edit_uri and link rewrite."""

    def test_docs_version_empty_default(self) -> None:
        """With no env set, docs_version is empty."""
        with _isolated_docs_env():
            self.assertEqual(docs_version(), "")

    def test_docs_version_prefers_mike_over_dgx(self) -> None:
        """MIKE_DOCS_VERSION wins over DGX_DOCS_VERSION."""
        with _isolated_docs_env(
            MIKE_DOCS_VERSION="development",
            DGX_DOCS_VERSION="latest",
        ):
            self.assertEqual(docs_version(), "development")

    def test_docs_version_normalizes_case(self) -> None:
        """Version is lowercased and stripped."""
        with _isolated_docs_env(DGX_DOCS_VERSION="  Development "):
            self.assertEqual(docs_version(), "development")

    def test_docs_git_ref_default_main(self) -> None:
        """Empty/latest version maps git ref to main."""
        with _isolated_docs_env():
            self.assertEqual(docs_git_ref(), "main")
        with _isolated_docs_env(DGX_DOCS_VERSION="latest"):
            self.assertEqual(docs_git_ref(), "main")

    def test_docs_git_ref_development(self) -> None:
        """Development docs alias maps git ref to development branch."""
        with _isolated_docs_env(DGX_DOCS_VERSION="development"):
            self.assertEqual(docs_git_ref(), "development")

    def test_docs_git_ref_override(self) -> None:
        """DGX_DOCS_GIT_REF override wins even when version is latest."""
        with _isolated_docs_env(
            DGX_DOCS_VERSION="latest",
            DGX_DOCS_GIT_REF="development",
        ):
            self.assertEqual(docs_git_ref(), "development")


class TestOnConfig(unittest.TestCase):
    """Tests for branch-aware edit_uri via on_config."""

    def test_edit_uri_main_by_default(self) -> None:
        """Default/latest builds set edit_uri to main."""
        with _isolated_docs_env():
            cfg: dict[str, Any] = {"edit_uri": "edit/main/docs/"}
            out = on_config(cfg)
            self.assertEqual(out["edit_uri"], "edit/main/docs/")

    def test_edit_uri_development(self) -> None:
        """Development alias points Edit this page at the development branch."""
        with _isolated_docs_env(DGX_DOCS_VERSION="development"):
            cfg: dict[str, Any] = {"edit_uri": "edit/main/docs/"}
            out = on_config(cfg)
            self.assertEqual(out["edit_uri"], "edit/development/docs/")

    def test_on_config_returns_same_mapping(self) -> None:
        """on_config mutates and returns the config object MkDocs passed in."""
        with _isolated_docs_env():
            cfg: dict[str, Any] = {"edit_uri": "edit/main/docs/", "site_name": "x"}
            out = on_config(cfg)
            self.assertIs(out, cfg)


class TestOnPageMarkdown(unittest.TestCase):
    """Tests for rewriting in-repo GitHub blob/tree links by docs git ref."""

    _REPO = "https://github.com/toxicoder/nvidia-dgx-spark-lab"

    def test_rewrites_blob_main_to_development(self) -> None:
        """blob/main links become blob/development under the development alias."""
        md = f"See [AGENTS]({self._REPO}/blob/main/AGENTS.md)."
        with _isolated_docs_env(DGX_DOCS_VERSION="development"):
            out = on_page_markdown(md)
        self.assertIn(f"{self._REPO}/blob/development/AGENTS.md", out)
        self.assertNotIn("/blob/main/", out)

    def test_rewrites_tree_main_to_development(self) -> None:
        """tree/main links become tree/development under the development alias."""
        md = f"See [dir]({self._REPO}/tree/main/hermes/profiles)."
        with _isolated_docs_env(MIKE_DOCS_VERSION="development"):
            out = on_page_markdown(md)
        self.assertIn(f"{self._REPO}/tree/development/hermes/profiles", out)

    def test_rewrites_development_to_main_for_latest(self) -> None:
        """Source links hardcoding development become main for latest builds."""
        md = f"See [AGENTS]({self._REPO}/blob/development/AGENTS.md)."
        with _isolated_docs_env(DGX_DOCS_VERSION="latest"):
            out = on_page_markdown(md)
        self.assertIn(f"{self._REPO}/blob/main/AGENTS.md", out)
        self.assertNotIn("/blob/development/", out)

    def test_preserves_fragment(self) -> None:
        """URL fragments survive rewrite."""
        md = f"[x]({self._REPO}/blob/main/README.md#development--testing)"
        with _isolated_docs_env(DGX_DOCS_VERSION="development"):
            out = on_page_markdown(md)
        self.assertIn(
            f"{self._REPO}/blob/development/README.md#development--testing",
            out,
        )

    def test_leaves_external_github_links(self) -> None:
        """Third-party GitHub URLs are not rewritten."""
        md = "See [mike](https://github.com/jimporter/mike/blob/main/README.md)."
        with _isolated_docs_env(DGX_DOCS_VERSION="development"):
            out = on_page_markdown(md)
        self.assertIn("https://github.com/jimporter/mike/blob/main/README.md", out)

    def test_rewrites_master_alias_to_main(self) -> None:
        """Legacy master ref is normalized to the active docs git ref."""
        md = f"[x]({self._REPO}/blob/master/CONTRIBUTING.md)"
        with _isolated_docs_env():
            out = on_page_markdown(md)
        self.assertIn(f"{self._REPO}/blob/main/CONTRIBUTING.md", out)


class TestOnPostPage(unittest.TestCase):
    """Tests for GitHub API patch injection in rendered HTML."""

    def test_injects_script_after_head(self) -> None:
        """Patch script is inserted immediately after ``<head>`` and before content."""
        html = "<html><head><title>x</title></head><body></body></html>"
        out = on_post_page(html)
        self.assertIn("<head>", out)
        self.assertIn("api.github.com/repos/toxicoder/nvidia-dgx-spark-lab", out)
        self.assertLess(out.index("<script>"), out.index("<title>"))

    def test_preserves_head_attributes(self) -> None:
        """Existing attributes on the ``<head>`` tag are not stripped."""
        html = '<html><head lang="en"><meta charset="utf-8"/></head></html>'
        out = on_post_page(html)
        self.assertIn('<head lang="en">', out)

    def test_development_banner_when_env_set(self) -> None:
        """Development docs alias injects a visible non-production banner."""
        html = (
            "<html><head></head><body>"
            '<article class="md-content__inner md-typeset"><h1>Title</h1></article>'
            "</body></html>"
        )
        with _isolated_docs_env(DGX_DOCS_VERSION="development"):
            out = on_post_page(html)
        self.assertIn("dgx-docs-dev-banner", out)
        self.assertIn("Development docs", out)

    def test_no_banner_for_latest(self) -> None:
        """Latest/default builds must not show the development banner."""
        html = (
            "<html><head></head><body>"
            '<article class="md-content__inner md-typeset"><h1>Title</h1></article>'
            "</body></html>"
        )
        with _isolated_docs_env():
            out = on_post_page(html)
        self.assertNotIn("dgx-docs-dev-banner", out)

    def test_development_banner_falls_back_to_h1(self) -> None:
        """When article wrapper is missing, banner is injected before the first h1."""
        html = "<html><head></head><body><h1>Only heading</h1></body></html>"
        with _isolated_docs_env(MIKE_DOCS_VERSION="development"):
            out = on_post_page(html)
        self.assertIn("dgx-docs-dev-banner", out)
        self.assertLess(out.index("dgx-docs-dev-banner"), out.index("<h1>"))


if __name__ == "__main__":
    unittest.main()
