#!/usr/bin/env python3
"""Unit tests for docs/generate_shell_docs.py.

These tests ensure the generator (the code that produces ``{{PLACEHOLDER}}``
content used by the interactive command-vars panel) works correctly.
"""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Sequence

# Import the module under test
sys.path.insert(0, str(Path(__file__).parent))
from generate_shell_docs import OUTPUT_FILE, extract_from_file, main


class TestExtractFromFile(unittest.TestCase):
    """Tests for structured comment extraction from shell scripts."""

    def test_section_and_body(self) -> None:
        """``##`` markers produce a section heading with formatted body text."""
        lines = [
            "# ## My Section",
            "# body line 1",
            "# body line 2",
            "",
            "some code",
        ]
        docs = extract_from_file_from_lines(lines)
        self.assertEqual(len(docs), 1)
        self.assertIn("## My Section", docs[0])
        self.assertIn("body line 1", docs[0])

    def test_command_marker(self) -> None:
        """``@command`` markers produce a command heading and description body."""
        lines = [
            "# @command start-test",
            "# Starts the safe test workload.",
            "# Uses lower resources.",
            "echo hello",
        ]
        docs = extract_from_file_from_lines(lines)
        self.assertEqual(len(docs), 1)
        self.assertIn("Command: start-test", docs[0])
        self.assertIn("Starts the safe test workload", docs[0])

    def test_subsection(self) -> None:
        """``###`` subsections are nested inside the parent section output."""
        lines = [
            "# ## Parent",
            "# intro",
            "# ### Child",
            "# child body",
        ]
        docs = extract_from_file_from_lines(lines)
        # Subsections are emitted inside the parent section body
        self.assertIn("### Child", docs[0])
        self.assertIn("child body", docs[0])

    def test_function_with_comments(self) -> None:
        """Function detection does not crash when preceding comments are present."""
        lines = [
            "# comment for func",
            "# more comment",
            "def my_func():",
            "    pass",
        ]
        docs = extract_from_file_from_lines(lines)
        # The generator only picks up if no current_section
        # In this isolated test it may not trigger full, but we check no crash
        self.assertIsInstance(docs, list)

    def test_preserves_placeholders(self) -> None:
        """Critical for interactive command-vars.js: {{PLACEHOLDER}} must survive."""
        lines = [
            "# ## Example",
            "# Run ./scripts/manage.sh status   # host: {{SPARK0_IP}}",
        ]
        docs = extract_from_file_from_lines(lines)
        self.assertIn("{{SPARK0_IP}}", docs[0])

    def test_ignores_non_comment_code(self) -> None:
        """Non-comment shell lines before markers do not produce doc blocks."""
        lines = [
            "echo 'not a comment'",
            "# ## Only real",
            "# doc here",
        ]
        docs = extract_from_file_from_lines(lines)
        self.assertEqual(len(docs), 1)
        self.assertIn("## Only real", docs[0])


def extract_from_file_from_lines(lines: Sequence[str]) -> list[str]:
    """Call ``extract_from_file`` against a temporary shell script.

    Args:
        lines: Shell script lines to write into a temporary ``.sh`` file.

    Returns:
        Documentation blocks extracted by the generator.
    """
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sh", delete=False) as f:
        f.write("\n".join(lines))
        tmp = f.name
    try:
        from generate_shell_docs import extract_from_file as real_extract

        return real_extract(Path(tmp))
    finally:
        os.unlink(tmp)


def run_main_with_temp_output(argv: list[str] | None = None) -> str:
    """Run ``main()`` while redirecting output to a temporary directory.

    Args:
        argv: Optional command-line arguments to pass via ``sys.argv``.

    Returns:
        Generated reference Markdown content, or an empty string when no file
        was written.
    """
    from generate_shell_docs import OUTPUT_DIR as real_output_dir

    with tempfile.TemporaryDirectory() as td:
        tmp_dir = Path(td)
        import generate_shell_docs as mod

        orig_out = mod.OUTPUT_FILE
        mod.OUTPUT_FILE = tmp_dir / "reference.md"
        mod.OUTPUT_DIR = tmp_dir
        try:
            if argv:
                old = sys.argv
                sys.argv = argv
                try:
                    mod.main()
                finally:
                    sys.argv = old
            else:
                mod.main()
            return mod.OUTPUT_FILE.read_text(encoding="utf-8") if mod.OUTPUT_FILE.exists() else ""
        finally:
            mod.OUTPUT_FILE = orig_out
            mod.OUTPUT_DIR = real_output_dir


class TestFormatBody(unittest.TestCase):
    """Tests for Markdown formatting of extracted comment bodies."""

    def test_empty_body(self) -> None:
        """Empty or whitespace-only bodies format to an empty string."""
        from generate_shell_docs import _format_body

        self.assertEqual(_format_body([]), "")
        self.assertEqual(_format_body([""]), "")

    def test_admonitions_and_usage_blocks(self) -> None:
        """Safety, usage, and note lines are converted to admonitions and bash fences."""
        from generate_shell_docs import _format_body

        body = [
            "Safety: do not run on production without confirmation.",
            "",
            "Usage:",
            "./scripts/manage.sh status",
            "kubectl get pods",
            "",
            "Note: hermetic tests mock kubectl.",
            "```",
            "- list item after prose",
        ]
        out = _format_body(body)
        self.assertIn("!!! warning", out)
        self.assertIn("```bash", out)
        self.assertIn("!!! note", out)

    def test_important_and_warning_admonitions(self) -> None:
        """Important and warning prefixes map to the correct admonition types."""
        from generate_shell_docs import _format_body

        out = _format_body(["Important: read AGENTS.md", "Warning: heavy jobs need yes"])
        self.assertIn("!!! important", out)
        self.assertIn("!!! warning", out)

    def test_bare_fence_gets_text_language(self) -> None:
        """Bare triple-backtick fences receive a ``text`` language tag."""
        from generate_shell_docs import _format_body

        out = _format_body(["prose line", "```", "more prose"])
        self.assertIn("```text", out)

    def test_usage_block_allows_internal_blank_line(self) -> None:
        """A single blank line inside a usage block is preserved."""
        from generate_shell_docs import _format_body

        body = [
            "./scripts/manage.sh status",
            "",
            "kubectl get pods -A",
        ]
        out = _format_body(body)
        self.assertIn("kubectl get pods -A", out)

    def test_usage_block_stops_on_consecutive_blank(self) -> None:
        """Consecutive blank lines end a usage block and resume prose formatting."""
        from generate_shell_docs import _format_body

        # Two consecutive blank lines inside a usage block: the first is kept; the
        # second triggers break (line 137). Trailing prose keeps blanks from .strip().
        body = ["./scripts/manage.sh status", "", "", "After the example."]
        out = _format_body(body)
        self.assertIn("./scripts/manage.sh status", out)
        self.assertIn("```bash", out)
        self.assertIn("After the example.", out)

    def test_subsection_orphan_and_function_docs(self) -> None:
        """Orphan subsections and function comment blocks are extracted correctly."""
        lines = [
            "# ### Orphan Sub",
            "# orphan body",
            "# ## Parent",
            "# parent body",
            "# helper docs",
            "# more",
            "my_helper() {",
            "  :",
            "}",
        ]
        docs = extract_from_file_from_lines(lines)
        joined = "\n".join(docs)
        self.assertIn("Orphan Sub", joined)
        self.assertIn("Function `my_helper`", joined)

    def test_skips_separator_comments(self) -> None:
        """Banner separator comments (``===``) are omitted from section bodies."""
        lines = [
            "# ## Section",
            "# === noise ===",
            "# real body",
        ]
        docs = extract_from_file_from_lines(lines)
        self.assertIn("real body", docs[0])
        self.assertNotIn("===", docs[0])


class TestMainIdempotent(unittest.TestCase):
    """Tests for idempotent reference generation and CLI behavior."""

    def test_does_not_crash_and_respects_force(self) -> None:
        """``main()`` runs successfully and writes reference output with ``--force``."""
        content = run_main_with_temp_output(["generate_shell_docs.py", "--force"])
        self.assertIn("Auto-Generated Shell Reference", content)

    def test_skips_write_when_unchanged_without_force(self) -> None:
        """Unchanged content hits the early-return path when ``--force`` is absent.

        Uses a single temp output path for both runs so the second invocation
        actually sees existing content (unlike two separate TemporaryDirectory calls).
        """
        import generate_shell_docs as mod
        from unittest.mock import patch
        from io import StringIO

        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "reference.md"
            orig_out = mod.OUTPUT_FILE
            orig_dir = mod.OUTPUT_DIR
            mod.OUTPUT_FILE = out
            mod.OUTPUT_DIR = Path(td)
            try:
                old_argv = sys.argv
                sys.argv = ["generate_shell_docs.py", "--force"]
                try:
                    mod.main()
                finally:
                    sys.argv = old_argv
                self.assertTrue(out.is_file())
                first = out.read_text(encoding="utf-8")
                mtime_after_write = out.stat().st_mtime_ns

                buf = StringIO()
                sys.argv = ["generate_shell_docs.py"]
                try:
                    with patch("sys.stdout", buf):
                        mod.main()
                finally:
                    sys.argv = old_argv

                self.assertIn("Shell reference is up to date", buf.getvalue())
                self.assertEqual(out.read_text(encoding="utf-8"), first)
                self.assertEqual(out.stat().st_mtime_ns, mtime_after_write)
            finally:
                mod.OUTPUT_FILE = orig_out
                mod.OUTPUT_DIR = orig_dir

    def test_read_existing_handles_io_errors(self) -> None:
        """``main()`` tolerates read errors when comparing existing reference content."""
        import generate_shell_docs as mod

        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "reference.md"
            content = run_main_with_temp_output(["generate_shell_docs.py", "--force"])
            out.write_text(content, encoding="utf-8")
            orig = mod.OUTPUT_FILE
            mod.OUTPUT_FILE = out
            try:
                real_read = Path.read_text

                def selective_read(
                    self: Path,
                    encoding: str | None = None,
                    errors: str | None = None,
                ) -> str:
                    """Simulate a read failure for the output file under test.

                    Args:
                        self: Path instance being read.
                        encoding: Optional text encoding passed to ``Path.read_text``.
                        errors: Optional decode error handler passed to ``Path.read_text``.

                    Returns:
                        File contents from the real ``read_text`` implementation.

                    Raises:
                        OSError: When reading the temporary reference output path.
                    """
                    if self == out:
                        raise OSError("denied")
                    return real_read(self, encoding=encoding, errors=errors)

                from unittest.mock import patch

                with patch.object(Path, "read_text", selective_read):
                    mod.main()
            finally:
                mod.OUTPUT_FILE = orig

    def test_main_module_guard(self) -> None:
        """The module executes without error when run as ``__main__``."""
        import runpy

        runpy.run_path(str(Path(__file__).parent / "generate_shell_docs.py"), run_name="__main__")

    def test_fallback_when_no_docs_extracted(self) -> None:
        """An empty scripts tree produces the helpful no-docs fallback message."""
        import generate_shell_docs as mod

        with tempfile.TemporaryDirectory() as td:
            empty_scripts = Path(td) / "scripts"
            empty_scripts.mkdir()
            orig_scripts = mod.SCRIPTS_DIR
            orig_out = mod.OUTPUT_FILE
            orig_dir = mod.OUTPUT_DIR
            mod.SCRIPTS_DIR = empty_scripts
            mod.OUTPUT_DIR = Path(td)
            mod.OUTPUT_FILE = Path(td) / "reference.md"
            try:
                mod.main()
                content = mod.OUTPUT_FILE.read_text(encoding="utf-8")
                self.assertIn("_No structured comments found yet._", content)
            finally:
                mod.SCRIPTS_DIR = orig_scripts
                mod.OUTPUT_DIR = orig_dir
                mod.OUTPUT_FILE = orig_out


if __name__ == "__main__":
    unittest.main()