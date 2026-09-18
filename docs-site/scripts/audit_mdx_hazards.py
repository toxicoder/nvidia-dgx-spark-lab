#!/usr/bin/env python3
"""Audit markdown files for constructs that break when compiled as MDX.

MDX (``format: mdx``) parses ``{`` as a JavaScript expression and ``<word`` as a JSX
element, even where Markdown authors intended literal prose.  Fenced code blocks and
inline code spans are exempt.  This reports what the migration has to escape so that
content keeps its meaning when the pages compile as MDX.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

BACKTICK = chr(96)
_FENCE_RE = re.compile(r"^(?P<indent>[ \t]*)(?P<fence>" + BACKTICK + r"{3,}|~{3,})(?P<info>.*)$")
_INLINE_CODE_RE = re.compile(r"(?P<tick>" + BACKTICK + r"+)(?P<code>.+?)(?P=tick)")
_BRACE_RE = re.compile(r"[{}]")
_JSXISH_RE = re.compile(r"</?[A-Za-z][A-Za-z0-9._-]*")
_AUTOLINK_RE = re.compile(r"<https?://[^>\s]+>")
_HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
_ESCAPED_RE = re.compile(r"\\([{}<>\[\]`#*_~|>+])")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DOCS_DIR = REPO_ROOT / "docs"
EXCLUDED = frozenset({"node_modules", "__pycache__", ".git"})


def _fenced_ranges(lines: list[str]) -> list[tuple[int, int]]:
    """Return half-open line ranges covered by fenced code blocks."""
    ranges: list[tuple[int, int]] = []
    open_at: int | None = None
    marker = ""
    for index, line in enumerate(lines):
        match = _FENCE_RE.match(line)
        if match is None:
            continue
        fence = match.group("fence")
        if open_at is None:
            open_at, marker = index, fence
        elif fence[0] == marker[0] and len(fence) >= len(marker):
            ranges.append((open_at, index + 1))
            open_at = None
    if open_at is not None:
        ranges.append((open_at, len(lines)))
    return ranges


def _blank_out(text: str) -> str:
    """Remove constructs that MDX accepts verbatim so they are not reported."""
    text = _AUTOLINK_RE.sub(lambda m: " " * len(m.group()), text)
    text = _HTML_COMMENT_RE.sub(lambda m: " " * len(m.group()), text)
    text = _INLINE_CODE_RE.sub(lambda m: " " * len(m.group()), text)
    return _ESCAPED_RE.sub("  ", text)


def audit(text: str) -> list[tuple[int, str, str]]:
    """Return ``(line_number, reason, line)`` for every MDX-hostile line."""
    lines = text.split("\n")
    fenced = _fenced_ranges(lines)
    hits: list[tuple[int, str, str]] = []
    for index, line in enumerate(lines):
        if any(start <= index < end for start, end in fenced):
            continue
        probe = _blank_out(line)
        if _BRACE_RE.search(probe):
            hits.append((index + 1, "brace", line))
        elif _JSXISH_RE.search(probe):
            hits.append((index + 1, "jsxish", line))
    return hits


def main(argv: list[str] | None = None) -> int:
    """Run the audit over the docs tree."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=str(DOCS_DIR))
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--limit", type=int, default=6)
    parser.add_argument(
        "--scope",
        choices=("all", "hand", "generated"),
        default="all",
        help="only report hand-written pages, generated pages, or both",
    )
    args = parser.parse_args(argv)

    root = Path(args.root)
    files = sorted(
        p for p in root.rglob("*.md") if not EXCLUDED & set(p.parts)
    )
    if args.scope == "hand":
        files = [p for p in files if "generated" not in p.relative_to(root).parts]
    elif args.scope == "generated":
        files = [p for p in files if "generated" in p.relative_to(root).parts]
    report: dict[str, list[list]] = {}
    for path in files:
        hits = audit(path.read_text(encoding="utf-8"))
        if hits:
            report[str(path.relative_to(REPO_ROOT))] = [list(h) for h in hits]

    if args.json:
        print(json.dumps(report, indent=2))
        return 0

    total = sum(len(v) for v in report.values())
    braces = sum(1 for v in report.values() for h in v if h[1] == "brace")
    print(f"{len(report)} of {len(files)} files, {total} hostile lines ({braces} brace, {total - braces} jsxish)")
    for path, hits in report.items():
        print(f"\n{path} ({len(hits)})")
        for number, reason, text in hits[: args.limit]:
            print(f"  {number:>4} {reason:<7} {text[:100]}")
        if len(hits) > args.limit:
            print(f"  ... {len(hits) - args.limit} more")
    return 0


if __name__ == "__main__":
    sys.exit(main())
