#!/usr/bin/env python3
"""Unit tests for prometheus_scrape.dump_yaml_literal."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prometheus_scrape import dump_yaml_literal  # noqa: E402


class TestDumpYamlLiteral(unittest.TestCase):
    """dump_yaml_literal must not NameError and should preserve multi-line style."""

    def test_multiline_string_literal_style(self) -> None:
        out = dump_yaml_literal({"body": "line1\nline2\n", "n": 1})
        self.assertIn("line1", out)
        self.assertIn("line2", out)
        self.assertIn("n: 1", out)
        # Literal block style for multi-line values.
        self.assertIn("|", out)

    def test_plain_string(self) -> None:
        out = dump_yaml_literal({"k": "simple"})
        self.assertIn("k: simple", out)


if __name__ == "__main__":
    unittest.main()
