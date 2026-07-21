"""Unit tests for docs/hooks.py (MkDocs on_post_page GitHub API patch)."""

from __future__ import annotations

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


if __name__ == "__main__":
    unittest.main()