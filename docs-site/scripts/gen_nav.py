#!/usr/bin/env python3
"""Generate the Fumadocs navigation tree from the MkDocs ``nav`` declaration.

The MkDocs site declared its information architecture in ``mkdocs.yml`` under ``nav``.
Fumadocs builds its sidebar from a content source plus ``meta.json`` files, which cannot
express this repository's shape: most pages sit flat in ``docs/`` yet belong to different
sidebar tabs. So the nav is transcribed once into ``docs-site/lib/nav.json`` and applied by
the page-tree builder in ``docs-site/lib/source.ts``.

This script is the transcription. It is deterministic and checked in, so the generated file
can be diffed in review; run it with ``--check`` in CI to catch drift while ``mkdocs.yml``
still exists.

Usage:
    python3 docs-site/scripts/gen_nav.py [--check] [--print]

Options:
    --check   Exit 1 if the committed nav.json differs from what mkdocs.yml says.
    --print   Print the JSON to stdout without writing.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
MKDOCS_YML = REPO_ROOT / "mkdocs.yml"
OUT_JSON = REPO_ROOT / "docs-site" / "lib" / "nav.json"

#: ``- Label: path/to/page.md`` (a nav leaf).
_NAV_LEAF_RE = re.compile(r"^[ \t]*-[ \t]+(?P<label>[^:\n]+?):[ \t]+(?P<path>[A-Za-z0-9_.\-/]+\.md)[ \t]*$")
#: ``- Label:`` with no value (a nav group).
_NAV_GROUP_RE = re.compile(r"^[ \t]*-[ \t]+(?P<label>[^:\n]+?):[ \t]*$")


def _nav_block(lines: list[str]) -> list[str]:
    """Slice the ``nav:`` block out of a mkdocs.yml.

    Args:
        lines: All lines of ``mkdocs.yml``.

    Returns:
        The lines belonging to the ``nav`` list, excluding the key itself.
    """
    try:
        start = next(i for i, line in enumerate(lines) if line.startswith("nav:"))
    except StopIteration:
        raise ValueError("mkdocs.yml has no top-level nav: key") from None
    body: list[str] = []
    for line in lines[start + 1 :]:
        if line.strip() and not line.startswith((" ", "\t", "#")):
            break
        body.append(line)
    return body


def _dash_column(line: str) -> int:
    """Return the column of a nav line's ``-`` bullet.

    Args:
        line: A nav line whose first non-space character is ``-``.

    Returns:
        Zero-based column index of the bullet.
    """
    return len(line) - len(line.lstrip(" \t"))


def parse_nav(mkdocs_text: str) -> list[dict[str, object]]:
    """Convert the MkDocs ``nav`` list into the Fumadocs group layout.

    Nesting is read from the bullet column rather than from indentation size, so a tab
    entry and its children are told apart regardless of how the file happens to be
    indented. A tab may be a bare page (``- Home: index.md``) or a list of pages, and a
    tab's list may contain nested groups whose leaves still belong to that tab.

    Args:
        mkdocs_text: Contents of ``mkdocs.yml``.

    Returns:
        One entry per top-level tab: ``{"title", "pages"}`` where ``pages`` holds the
        ordered ``{"title", "path"}`` leaves declared under that tab.
    """
    lines = [
        line
        for line in _nav_block(mkdocs_text.split("\n"))
        if line.strip() and not line.lstrip().startswith("#")
    ]
    if not lines:
        raise ValueError("mkdocs.yml nav is empty")
    tab_column = min(_dash_column(line) for line in lines)

    tabs: list[dict[str, object]] = []
    current: dict[str, object] | None = None
    for line in lines:
        is_tab_level = _dash_column(line) == tab_column
        leaf = _NAV_LEAF_RE.match(line)
        group = _NAV_GROUP_RE.match(line)

        if is_tab_level and group:
            current = {"title": group.group("label").strip(), "pages": []}
            tabs.append(current)
            continue
        if is_tab_level and leaf:
            tabs.append(
                {
                    "title": leaf.group("label").strip(),
                    "pages": [
                        {"title": leaf.group("label").strip(), "path": leaf.group("path").strip()}
                    ],
                }
            )
            current = tabs[-1]
            continue
        if leaf:
            if current is None:
                raise ValueError(f"nav leaf appears before any tab: {line!r}")
            assert isinstance(current["pages"], list)
            current["pages"].append(
                {"title": leaf.group("label").strip(), "path": leaf.group("path").strip()}
            )
            continue
        if group:
            continue  # Nested group heading; its leaves attach to the enclosing tab.
        raise ValueError(f"unparsed nav line: {line!r}")

    if not tabs:  # pragma: no cover
        # Unreachable by construction: ``tab_column`` is the shallowest bullet, so the first
        # such line either opens a tab or raises below, and an empty nav fails earlier. Kept
        # as an invariant guard against a future parser letting an empty tree through.
        raise ValueError("mkdocs.yml nav produced no tabs")
    return tabs


def validate(tabs: list[dict[str, object]]) -> list[str]:
    """Check the parsed nav against the files on disk.

    Args:
        tabs: Output of :func:`parse_nav`.

    Returns:
        Human-readable problems; empty when the nav is consistent.
    """
    problems: list[str] = []
    docs = REPO_ROOT / "docs"
    seen: set[str] = set()
    for tab in tabs:
        for page in tab["pages"]:  # type: ignore
            # The nav names pages as MkDocs had them; a page that needed JSX was renamed to
            # `.mdx` by the codemod, so either suffix counts as present.
            declared = docs / page["path"]
            if not declared.is_file() and not declared.with_suffix(".mdx").is_file():
                problems.append(f"nav page missing on disk: docs/{page['path']}")
            if page["path"] in seen:
                problems.append(f"nav page listed twice: docs/{page['path']}")
            seen.add(page["path"])
    return problems


def main(argv: list[str] | None = None) -> int:
    """Generate or verify ``docs-site/lib/nav.json``.

    While ``mkdocs.yml`` exists the nav is transcribed from it.  Once it is gone,
    ``--check`` validates the committed tree against the pages on disk instead, so the
    gate keeps working rather than passing vacuously.

    Args:
        argv: Argument vector (defaults to ``sys.argv[1:]``).

    Returns:
        ``0`` on success, ``1`` on a validation problem or ``--check`` drift.
    """
    parser = argparse.ArgumentParser(description="Generate or verify docs-site/lib/nav.json.")
    parser.add_argument("--check", action="store_true", help="fail if the committed file is stale")
    parser.add_argument("--print", action="store_true", dest="print_only", help="write to stdout")
    args = parser.parse_args(argv)

    if MKDOCS_YML.is_file():
        tabs = parse_nav(MKDOCS_YML.read_text(encoding="utf-8"))
    elif args.check and OUT_JSON.is_file():
        # mkdocs.yml has been retired: the committed tree is the source of truth and the
        # job of this mode is to keep it honest against what is actually on disk.
        tabs = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    else:
        # mkdocs.yml has been retired in this repository, so there is nothing to transcribe
        # from.  The committed tree is edited by hand and verified, not regenerated.
        print(
            f"missing {MKDOCS_YML}: the nav is hand-maintained in "
            f"{OUT_JSON.relative_to(REPO_ROOT)} now — edit that file, then run "
            "scripts/gen_nav.py --check (or npm run nav:check)",
            file=sys.stderr,
        )
        return 1

    problems = validate(tabs)
    if problems:
        for problem in problems:
            print(f"nav problem: {problem}", file=sys.stderr)
        return 1

    payload = json.dumps(tabs, indent=2, ensure_ascii=False) + "\n"
    if args.print_only:
        sys.stdout.write(payload)
        return 0

    existing = OUT_JSON.read_text(encoding="utf-8") if OUT_JSON.is_file() else None
    if args.check:
        if existing != payload:
            print("docs-site/lib/nav.json is stale; run docs-site/scripts/gen_nav.py", file=sys.stderr)
            return 1
        print("nav.json is up to date.")
        return 0
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(payload, encoding="utf-8")
    pages = sum(len(tab["pages"]) for tab in tabs)
    print(f"wrote {OUT_JSON.relative_to(REPO_ROOT)} ({len(tabs)} tabs, {pages} pages)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
