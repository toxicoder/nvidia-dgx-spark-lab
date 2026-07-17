#!/usr/bin/env python3
"""Unit tests for documentation coverage pure helpers (inline scripts, mkdocs/Bazel)."""

from __future__ import annotations

import unittest

from doc_coverage import (
    bazel_listed_md_files,
    find_inline_script_keys,
    mkdocs_nav_md_pages,
)


class TestInlineScriptKeys(unittest.TestCase):
    """find_inline_script_keys detects ConfigMap data: | anti-pattern."""

    def test_detects_shell_and_python_keys(self) -> None:
        """Embedded .sh / .py multi-line keys are reported."""
        text = """
apiVersion: v1
kind: ConfigMap
data:
  install-comfy.sh: |
    #!/usr/bin/env bash
    set -euo pipefail
  patch_get_free_memory.py: |
    #!/usr/bin/env python3
    print("x")
"""
        self.assertEqual(
            find_inline_script_keys(text),
            ["install-comfy.sh", "patch_get_free_memory.py"],
        )

    def test_allows_json_and_plain_literals(self) -> None:
        """Non-script ConfigMap data and configMapGenerator files: are fine."""
        text = """
data:
  lab-note.json: |
    {"id": 1}
  DOC_SOURCES_JSON: '[]'
configMapGenerator:
  - name: x
    files:
      - install-comfy.sh=scripts/install-comfy.sh
"""
        self.assertEqual(find_inline_script_keys(text), [])


class TestMkdocsBazel(unittest.TestCase):
    """mkdocs nav ↔ docs/BUILD.bazel listing helpers."""

    def test_nav_extraction(self) -> None:
        """Nav tree yields bare markdown paths."""
        yml = """
nav:
  - Home: index.md
  - Concepts:
      - Visual: visual-generative-ai.md
      - Generated: generated/shell/reference.md
"""
        self.assertEqual(
            mkdocs_nav_md_pages(yml),
            [
                "generated/shell/reference.md",
                "index.md",
                "visual-generative-ai.md",
            ],
        )

    def test_bazel_md_listing(self) -> None:
        """BUILD data strings are collected."""
        build = """
data = [
    "index.md",
    "visual-generative-ai.md",
    "generated",
]
"""
        self.assertEqual(
            bazel_listed_md_files(build),
            {"index.md", "visual-generative-ai.md"},
        )


if __name__ == "__main__":
    raise SystemExit(unittest.main())
