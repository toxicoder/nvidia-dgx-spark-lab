#!/usr/bin/env python3
"""Unit tests for documentation coverage pure helpers (inline embeds, mkdocs/Bazel)."""

from __future__ import annotations

import unittest

from doc_coverage import (
    bazel_listed_md_files,
    find_inline_configmap_language_keys,
    find_inline_script_keys,
    has_multiline_shell_args,
    mkdocs_nav_md_pages,
)


class TestInlineConfigMapLanguageKeys(unittest.TestCase):
    """find_inline_configmap_language_keys detects polyglot ConfigMap embeds."""

    def test_detects_shell_python_json_yaml_and_json_env(self) -> None:
        """Embedded language keys with multi-line blocks are reported."""
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
  lab-note.json: |
    {"id": 1}
  settings.yml: |
    use_default_settings: true
  DOC_SOURCES_JSON: |
    []
  any: |-
    version: v1
"""
        self.assertEqual(
            find_inline_configmap_language_keys(text),
            [
                "DOC_SOURCES_JSON",
                "any",
                "install-comfy.sh",
                "lab-note.json",
                "patch_get_free_memory.py",
                "settings.yml",
            ],
        )

    def test_allows_generator_and_plain_scalars(self) -> None:
        """ConfigMapGenerator files: and plain scalars are fine."""
        text = """
data:
  NOTE: "Legacy static dashboard removed."
  plain_key: value
configMapGenerator:
  - name: x
    files:
      - install-comfy.sh=scripts/install-comfy.sh
      - lab-flux-fast.json=workflows/lab-flux-fast.json
"""
        self.assertEqual(find_inline_configmap_language_keys(text), [])

    def test_script_helper_is_subset(self) -> None:
        """find_inline_script_keys remains shell/python only."""
        text = """
data:
  install-comfy.sh: |
    true
  lab-note.json: |
    {}
"""
        self.assertEqual(find_inline_script_keys(text), ["install-comfy.sh"])


class TestMultilineShellArgs(unittest.TestCase):
    """has_multiline_shell_args detects shell-in-Deployment anti-pattern."""

    def test_detects_sh_c_with_block_args(self) -> None:
        """Command sh -c plus multi-line args is flagged."""
        text = """
          command: ["/bin/sh", "-c"]
          args:
            - |
              apt-get update
              exec foo
"""
        self.assertTrue(has_multiline_shell_args(text))

    def test_allows_entrypoint_path(self) -> None:
        """Direct entrypoint path without multi-line body is fine."""
        text = """
          command: ["/bin/sh", "/scripts/entrypoint.sh"]
"""
        self.assertFalse(has_multiline_shell_args(text))


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
