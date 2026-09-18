#!/usr/bin/env python3
"""Unit tests for documentation coverage pure helpers (inline embeds, nav/Bazel)."""

from __future__ import annotations

import json
import pathlib
import shutil
import tempfile
import unittest

from doc_coverage import (
    _check_nav_pages_in_docs_bazel,
    bazel_listed_md_files,
    find_inline_configmap_language_keys,
    find_inline_script_keys,
    has_multiline_shell_args,
    nav_json_pages,
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


class TestDocsSiteNav(unittest.TestCase):
    """nav.json ↔ docs/BUILD.bazel listing helpers."""

    def test_nav_extraction(self) -> None:
        """Every leaf path in the nav tree is reported, groups included."""
        payload = """
[
  { "title": "Home", "pages": [ { "title": "Home", "path": "index.md" } ] },
  { "title": "Operate", "pages": [
      { "title": "Overview", "path": "operate/index.md" },
      { "title": "Deep", "path": "operate/deep.mdx" },
      { "title": "Group", "pages": [ { "title": "Gen", "path": "generated/shell/reference.md" } ] }
  ] }
]
"""
        self.assertEqual(
            nav_json_pages(payload),
            [
                "generated/shell/reference.md",
                "index.md",
                "operate/deep.mdx",
                "operate/index.md",
            ],
        )

    def test_bazel_md_listing(self) -> None:
        """BUILD data strings are collected, both markdown extensions."""
        build = """
data = [
    "index.md",
    "visual-generative-ai.mdx",
    "generated",
]
"""
        self.assertEqual(
            bazel_listed_md_files(build),
            {"index.md", "visual-generative-ai.mdx"},
        )

    def test_generated_tree_must_be_globbed(self) -> None:
        """A generated nav page is covered only when its tree is shipped as data.

        The content filegroup globs each generated reference tree; a page whose tree is not
        globbed would never reach the site's runfiles.
        """
        root = pathlib.Path(tempfile.mkdtemp())
        try:
            (root / "docs-site" / "lib").mkdir(parents=True)
            (root / "docs").mkdir()
            nav = [
                {
                    "title": "Reference",
                    "pages": [{"title": "Shell", "path": "generated/shell/reference.md"}],
                }
            ]
            (root / "docs-site" / "lib" / "nav.json").write_text(
                json.dumps(nav), encoding="utf-8"
            )

            (root / "docs" / "BUILD.bazel").write_text(
                '_RENDER_GENERATED = glob(\n    ["generated/shell/**"],\n)\n',
                encoding="utf-8",
            )
            self.assertEqual(_check_nav_pages_in_docs_bazel(root), [])

            (root / "docs" / "BUILD.bazel").write_text(
                '_RENDER_GENERATED = glob(\n    ["generated/dashboard-api/**"],\n)\n',
                encoding="utf-8",
            )
            violations = _check_nav_pages_in_docs_bazel(root)
            self.assertEqual(len(violations), 1)
            self.assertIn("generated/shell/reference.md", violations[0])
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_nav_page_may_be_listed_under_either_extension(self) -> None:
        """A nav entry written as .md is satisfied by the .mdx file on disk.

        nav.json keeps the paths as mkdocs.yml spelled them; the codemod renamed pages that
        needed JSX to .mdx.  The Bazel data array lists the real file names.
        """
        root = pathlib.Path(tempfile.mkdtemp())
        try:
            (root / "docs-site" / "lib").mkdir(parents=True)
            (root / "docs").mkdir()
            nav = [{"title": "Home", "pages": [{"title": "Home", "path": "index.md"}]}]
            (root / "docs-site" / "lib" / "nav.json").write_text(
                json.dumps(nav), encoding="utf-8"
            )
            # The page itself lives on disk under its renamed extension.
            (root / "docs" / "index.mdx").write_text("# Home\n", encoding="utf-8")
            (root / "docs" / "BUILD.bazel").write_text(
                '_HAND_WRITTEN_MD = [\n    "index.mdx",\n]\n', encoding="utf-8"
            )
            self.assertEqual(_check_nav_pages_in_docs_bazel(root), [])

            (root / "docs" / "BUILD.bazel").write_text(
                '_HAND_WRITTEN_MD = [\n    "other.md",\n]\n', encoding="utf-8"
            )
            violations = _check_nav_pages_in_docs_bazel(root)
            self.assertEqual(len(violations), 1)
            self.assertIn("index.mdx", violations[0])
        finally:
            shutil.rmtree(root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(unittest.main())
