"""Unit tests for docs/hooks.py (MkDocs on_post_page GitHub API patch)."""

from __future__ import annotations

import os
import unittest

from hooks import on_post_page


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
        prev = os.environ.get("DGX_DOCS_VERSION")
        os.environ["DGX_DOCS_VERSION"] = "development"
        try:
            out = on_post_page(html)
        finally:
            if prev is None:
                os.environ.pop("DGX_DOCS_VERSION", None)
            else:
                os.environ["DGX_DOCS_VERSION"] = prev
        self.assertIn("dgx-docs-dev-banner", out)
        self.assertIn("Development docs", out)

    def test_no_banner_for_latest(self) -> None:
        """Latest/default builds must not show the development banner."""
        html = (
            "<html><head></head><body>"
            '<article class="md-content__inner md-typeset"><h1>Title</h1></article>'
            "</body></html>"
        )
        prev = os.environ.pop("DGX_DOCS_VERSION", None)
        prev_m = os.environ.pop("MIKE_DOCS_VERSION", None)
        try:
            out = on_post_page(html)
        finally:
            if prev is not None:
                os.environ["DGX_DOCS_VERSION"] = prev
            if prev_m is not None:
                os.environ["MIKE_DOCS_VERSION"] = prev_m
        self.assertNotIn("dgx-docs-dev-banner", out)

    def test_development_banner_falls_back_to_h1(self) -> None:
        """When article wrapper is missing, banner is injected before the first h1."""
        html = "<html><head></head><body><h1>Only heading</h1></body></html>"
        prev = os.environ.get("MIKE_DOCS_VERSION")
        os.environ["MIKE_DOCS_VERSION"] = "development"
        try:
            out = on_post_page(html)
        finally:
            if prev is None:
                os.environ.pop("MIKE_DOCS_VERSION", None)
            else:
                os.environ["MIKE_DOCS_VERSION"] = prev
        self.assertIn("dgx-docs-dev-banner", out)
        self.assertLess(out.index("dgx-docs-dev-banner"), out.index("<h1>"))


if __name__ == "__main__":
    unittest.main()
