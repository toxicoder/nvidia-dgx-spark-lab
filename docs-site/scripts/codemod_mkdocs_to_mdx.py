#!/usr/bin/env python3
"""Codemod: rewrite MkDocs-only markdown syntax to MDX components, in place.

The docs site moved from Material for MkDocs to Fumadocs (Next.js). Fumadocs renders plain
markdown plus MDX, so the four MkDocs extension syntaxes have no parser and are mapped to
components instead:

- ``--8<-- "path"`` (pymdownx.snippets)             -> ``<ClusterConfigPanel />``
- ``!!! type "Title"`` + indented body (admonition) -> ``<Callout type=".." title="..">``
- ``=== "Tab"`` + indented body (pymdownx.tabbed)   -> ``<Tabs>`` / ``<Tab>``
- ``<div class="grid cards" markdown>`` (md_in_html) -> ``<Cards>`` / ``<Card>``

This is a *syntax* transform only. Before writing, the tool compares a prose projection of
the document (markup removed, whitespace collapsed) and refuses to write a file whose prose
changed, so ``git diff`` shows markup lines and nothing else.

Usage:
    python3 docs-site/scripts/codemod_mkdocs_to_mdx.py [--check] [--verbose] [path ...]

Options:
    --check     Report what would change and exit 1 if anything would; write nothing.
    --verbose   List every file inspected, not just the ones that change.
    path        Files to process (default: hand-written pages under docs/).

Safety:
    Run on a clean tree and review the diff. Idempotent: a second run reports no changes.
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys
from itertools import chain

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
DOCS_DIR = REPO_ROOT / "docs"

#: MkDocs admonition classes -> Fumadocs Callout types. Mirrors fumadocs-core's
#: remark-directive-admonition map so both spellings render identically.
CALLOUT_TYPES = {
    "note": "info",
    "info": "info",
    "tip": "info",
    "abstract": "info",
    "question": "info",
    "example": "info",
    "quote": "info",
    "success": "info",
    "warning": "warning",
    "failure": "warning",
    "bug": "error",
    "danger": "error",
}

#: Trees that are generated or non-page content (mirrors mkdocs.yml exclude_docs).
_EXCLUDED_PARTS = frozenset({"generated", "includes", "assets", "tests", "node_modules", "__pycache__"})

_FENCE_RE = re.compile(r"^(?P<indent>[ \t]*)(?P<fence>`{3,}|~{3,})(?P<info>.*)$")
#: Inline code spans; their content is literal and must not be escaped.
_INLINE_CODE_RE = re.compile(r"(?P<tick>`+)(?P<code>[^`]*?)(?P=tick)")
#: HTML comments, which MDX rejects as malformed element names.
_HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
_ADMON_RE = re.compile(
    r'^(?P<indent>[ \t]*)!!!(?P<cls>[ \t]*)(?P<type>\S+)(?:[ \t]+"(?P<title>[^"]*)"|(?P<tail>.*))$'
)
_TABS_RE = re.compile(r'^(?P<indent>[ \t]*)===[ \t]+"(?P<title>[^"]*)"(?P<tail>.*)$')
_SNIPPET_RE = re.compile(r'^[ \t]*--8<--[ \t]*"(?P<path>[^"]+)"(?P<tail>[^\n]*)$')
_CARD_GRID_OPEN_RE = re.compile(r'^[ \t]*<div[ \t]+class=["\']grid cards["\'][^>]*>[ \t]*$')
_CARD_GRID_CLOSE_RE = re.compile(r"^[ \t]*</div>[ \t]*$")
_CARD_ITEM_RE = re.compile(r"^(?P<dash>-)[ \t]{1,4}(?P<text>.*)$")
_CARD_TITLE_RE = re.compile(r"^\*\*(?P<title>.+)\*\*$")

#: Component tags the codemod emits or deletes, used by the prose projection.
_COMPONENT_TAG_RE = re.compile(
    r"</?(?:Callout|Tabs|Tab|Cards|Card|ClusterConfigPanel)\b(?P<attrs>[^>]*?)/?>|"
    r"<div\b[^>]*>|</div>",
    re.IGNORECASE,
)
#: Attributes whose values carry body text and must stay in the prose projection.
_PROSE_ATTR_RE = re.compile(r'(?P<name>title|value)=(?P<quote>["\'])(?P<value>[^"\']*)\2')
_PROSE_LINE_RULES = (
    # ``!!! danger "Title" tail`` -> keep the title and tail; the class word is syntax.
    (
        re.compile(r'(?m)^[ \t]*!!![ \t]*(?P<cls>\S+)(?:[ \t]+"(?P<title>[^"]*)")?(?P<tail>.*)$'),
        lambda m: f" {m.group('title') or ''} {m.group('tail') or ''} ",
    ),
    # ``=== "Title"`` -> keep the title.
    (
        re.compile(r'(?m)^[ \t]*===[ \t]+"(?P<title>[^"]*)"(?P<tail>.*)$'),
        lambda m: f" {m.group('title')} {m.group('tail') or ''} ",
    ),
    # ``--8<-- "path"`` -> a file reference, entirely syntax.
    (re.compile(r'(?m)^[ \t]*--8<--[ \t]*"[^"]*"[^\n]*$'), lambda _m: " "),
)


def _leading(text: str) -> int:
    """Count leading spaces in a line.

    Args:
        text: A single line.

    Returns:
        The number of leading space characters.
    """
    return len(text) - len(text.lstrip(" "))


def _fenced_ranges(lines: list[str]) -> list[tuple[int, int]]:
    """Collect ``[start, end)`` line ranges covered by fenced code blocks.

    Content inside a fence is literal: admonition, tab, and snippet markers there are
    documentation examples and must not be rewritten.

    Args:
        lines: Source lines of one file.

    Returns:
        Non-overlapping half-open line ranges in ascending order.
    """
    ranges: list[tuple[int, int]] = []
    open_at: int | None = None
    marker = ""
    marker_len = 0
    for index, line in enumerate(lines):
        match = _FENCE_RE.match(line)
        if not match:
            continue
        fence = match.group("fence")
        if open_at is None:
            open_at, marker, marker_len = index + 1, fence[0], len(fence)
        elif fence[0] == marker and len(fence) >= marker_len:
            ranges.append((open_at, index + 1))
            open_at, marker, marker_len = None, "", 0
    if open_at is not None:
        ranges.append((open_at, len(lines)))
    return ranges


def _in_fenced(ranges: list[tuple[int, int]], index: int) -> bool:
    """Report whether a line index falls inside a fenced code block.

    Args:
        ranges: Output of :func:`_fenced_ranges`.
        index: Zero-based line index.

    Returns:
        ``True`` when the line is inside a fence.
    """
    return any(start <= index < end for start, end in ranges)


def _block_end(lines: list[str], marker_index: int) -> int:
    """Find where the nested-content block opened by a marker line ends.

    Follows the Python-Markdown rule MkDocs relies on: a line continues the block when it
    is indented deeper than the marker (top-level markers indent by four, markers nested
    under a list item indent by eight), blank lines are absorbed while deeper content
    follows, and the first non-blank line at or shallower than the marker terminates it.
    The returned boundary therefore doubles as the lookahead position for a following
    sibling marker.

    Args:
        lines: Source lines of one file.
        marker_index: Index of the ``!!!`` or ``===`` marker line.

    Returns:
        Index of the first line that is not part of the block.
    """
    base = _leading(lines[marker_index])
    index = marker_index + 1
    while index < len(lines):
        if lines[index].strip():
            if _leading(lines[index]) > base:
                index += 1
                continue
            break
        index += 1
    return index


def _dedent(lines: list[str], start: int, end: int) -> list[str]:
    """Strip the common indentation from a nested-content block body.

    Args:
        lines: Source lines of one file.
        start: First line index of the body.
        end: Line index to stop at (exclusive).

    Returns:
        The body with shared indentation removed and trailing blanks trimmed.
    """
    body = lines[start:end]
    indents = [_leading(line) for line in body if line.strip()]
    common = min(indents) if indents else 0
    stripped = [line[common:] if line.strip() else "" for line in body]
    while stripped and not stripped[0].strip():
        stripped.pop(0)
    while stripped and not stripped[-1].strip():
        stripped.pop()
    return stripped


def _indented(text: str, indent: str) -> str:
    """Prefix every non-blank line of ``text`` with ``indent``.

    Args:
        text: Block body text.
        indent: Literal indentation to add.

    Returns:
        The indented text.
    """
    return "\n".join(indent + line if line.strip() else line for line in text.split("\n"))


def _attr_escape(value: str) -> str:
    """Escape a value for use inside a double-quoted JSX attribute.

    Args:
        value: Raw attribute text taken from a MkDocs title.

    Returns:
        Text safe to place between double quotes.
    """
    return value.replace('"', "&quot;")


def _render_admonition(lines: list[str], start: int, end: int) -> list[str] | None:
    """Convert one ``!!!`` admonition block into a ``<Callout>`` element.

    Args:
        lines: Source lines of one file.
        start: Index of the ``!!!`` marker line.
        end: Index one past the block.

    Returns:
        Replacement lines, or ``None`` when the block is not convertible.
    """
    marker = _ADMON_RE.match(lines[start])
    if marker is None or (marker.group("tail") or "").strip():
        # A marker with anything after the type that is not a quoted title (a ``.custom``
        # class, stray words) carries information no Callout prop can hold, so it stays put.
        return None
    admonition_type = marker.group("type")
    if admonition_type not in CALLOUT_TYPES:
        return None
    body = "\n".join(_dedent(lines, start + 1, end))
    indent = marker.group("indent")
    attrs = f'type="{CALLOUT_TYPES[admonition_type]}"'
    title = marker.group("title")
    if title:
        attrs += f' title="{_attr_escape(title)}"'
    if not body.strip():
        # A title-only admonition is real content (MkDocs rendered the heading as the
        # box), so keep it as a self-closing callout. A marker with neither title nor
        # body carries nothing: leave it verbatim so it shows up as pending work rather
        # than silently becoming an empty box.
        return [f"{indent}<Callout {attrs} />"] if title else None
    return [f"{indent}<Callout {attrs}>", *_indented(body, "  ").split("\n"), f"{indent}</Callout>"]


def _tab_group_id(titles: list[str]) -> str:
    """Derive a stable kebab-case tab-group id from its titles.

    Args:
        titles: Ordered titles of one tab group.

    Returns:
        A deterministic id so the persisted selection is shared across identical groups.
    """
    slug = "-".join(re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") for title in titles)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug or "tabs"


def _render_tabs(lines: list[str], markers: list[int], end: int) -> list[str] | None:
    """Convert a run of ``=== "Tab"`` blocks into one ``<Tabs>`` group.

    Args:
        lines: Source lines of one file.
        markers: Indices of the tab marker lines, in order.
        end: Index one past the last tab block.

    Returns:
        Replacement lines, or ``None`` when the run is not convertible.
    """
    titles: list[str] = []
    for marker_index in markers:
        match = _TABS_RE.match(lines[marker_index])
        if match is None or match.group("tail").strip():
            return None
        titles.append(match.group("title"))

    indent = _TABS_RE.match(lines[markers[0]]).group("indent")
    # Repeated labels are content: keep every label verbatim and give each tab its own
    # group so the persisted selection of one cannot drive the other.
    if len(set(titles)) != len(titles):
        groups: list[str] = []
        for position, marker_index in enumerate(markers):
            body = "\n".join(_dedent(lines, marker_index + 1, _tab_block_end(lines, markers, position, end)))
            if not body.strip():
                return None
            label = _attr_escape(titles[position])
            groups.extend(
                [
                    f'{indent}<Tabs groupId="{_tab_group_id([titles[position]])}-{position}" '
                    f'items={{["{label}"]}} persist>',
                    f'{indent}  <Tab value="{label}">',
                    *_indented(body, "    ").split("\n"),
                    f"{indent}  </Tab>",
                    f"{indent}</Tabs>",
                ]
            )
        return groups

    items = "{" + "[" + ", ".join(f'"{_attr_escape(title)}"' for title in titles) + "]" + "}"
    out = [f'{indent}<Tabs groupId="{_tab_group_id(titles)}" items={items} persist>']
    for position, marker_index in enumerate(markers):
        body = "\n".join(_dedent(lines, marker_index + 1, _tab_block_end(lines, markers, position, end)))
        if not body.strip():
            return None
        out.append(f'{indent}  <Tab value="{_attr_escape(titles[position])}">')
        out.extend(_indented(body, "    ").split("\n"))
        out.append(f"{indent}  </Tab>")
    out.append(f"{indent}</Tabs>")
    return out


def _tab_block_end(lines: list[str], markers: list[int], position: int, end: int) -> int:
    """Return the end of one tab's body inside a gathered run.

    Args:
        lines: Source lines of one file.
        markers: Marker indices of the run.
        position: Index into ``markers`` for the tab being measured.
        end: One past the final tab body of the run.

    Returns:
        Line index one past this tab's body.
    """
    return markers[position + 1] if position + 1 < len(markers) else end


def _render_card_grid(lines: list[str], start: int, end: int) -> list[str] | None:
    """Convert a ``grid cards`` md_in_html block into ``<Cards>``/``<Card>``.

    Args:
        lines: Source lines of one file.
        start: Index of the opening ``<div class="grid cards" markdown>``.
        end: Index of the matching ``</div>``.

    Returns:
        Replacement lines, or ``None`` when the block shape is unrecognised.
    """
    body = _dedent(lines, start + 1, end)
    items: list[list[str]] = []
    current: list[str] | None = None
    for line in body:
        match = _CARD_ITEM_RE.match(line)
        if match and _leading(line) == 0:
            current = [match.group("text")]
            items.append(current)
            continue
        if current is None:
            return None
        current.append(line)
    if not items:
        return None

    out = ["<Cards>"]
    for item in items:
        title = _CARD_TITLE_RE.match(item[0].strip())
        if title is None:
            return None
        content = _dedent(item, 1, len(item))
        out.append(f'  <Card title="{_attr_escape(title.group("title"))}">')
        out.extend(_indented("\n".join(content).strip("\n"), "    ").split("\n"))
        out.append("  </Card>")
    out.append("</Cards>")
    return out


def _transform_snippets(lines: list[str]) -> list[str]:
    """Replace ``--8<--`` snippet directives with the component they include.

    Args:
        lines: Source lines.

    Returns:
        Lines with snippet directives replaced.
    """
    fenced = _fenced_ranges(lines)
    out: list[str] = []
    for index, line in enumerate(lines):
        match = _SNIPPET_RE.match(line)
        if match is None or _in_fenced(fenced, index):
            out.append(line)
            continue
        indent = line[: _leading(line)]
        target = match.group("path")
        if target.endswith("cluster-config.md"):
            out.append(f"{indent}<ClusterConfigPanel />")
        elif target.endswith("abbreviations.md"):
            out.append(f"{indent}{{/* glossary definitions are appended by the docs source loader */}}")
        else:
            out.append(line)
    return out


def _transform_admonitions(lines: list[str]) -> list[str]:
    """Convert every top-level ``!!!`` admonition block to a ``<Callout>``.

    Args:
        lines: Source lines.

    Returns:
        Converted lines.
    """
    fenced = _fenced_ranges(lines)
    out: list[str] = []
    index = 0
    while index < len(lines):
        if _in_fenced(fenced, index):
            out.append(lines[index])
            index += 1
            continue
        if not _ADMON_RE.match(lines[index]):
            out.append(lines[index])
            index += 1
            continue
        end = _block_end(lines, index)
        rendered = _render_admonition(lines, index, end)
        if rendered is None:
            out.append(lines[index])
            index += 1
            continue
        out.extend(rendered)
        index = end
    return out


def _transform_tabs(lines: list[str]) -> list[str]:
    """Convert each run of ``=== "Tab"`` blocks into one ``<Tabs>`` group.

    Args:
        lines: Source lines.

    Returns:
        Converted lines.
    """
    fenced = _fenced_ranges(lines)
    out: list[str] = []
    index = 0
    while index < len(lines):
        if _in_fenced(fenced, index) or not _TABS_RE.match(lines[index]):
            out.append(lines[index])
            index += 1
            continue
        markers, end = _collect_tab_run(lines, fenced, index)
        rendered = _render_tabs(lines, markers, end)
        if rendered is None:
            # Leave the whole run verbatim.  Rendering only the convertible part of a run
            # would drop the bodies of the markers it skips, because those bodies live inside
            # the range the run consumed; the untouched source then shows up as pending work
            # for a human instead of losing content silently.
            out.extend(lines[index:end])
            index = end
            continue
        out.extend(rendered)
        index = end
    return out


def _collect_tab_run(lines: list[str], fenced: list[tuple[int, int]], start: int) -> tuple[list[int], int]:
    """Gather the consecutive ``=== "Tab"`` markers that begin at ``start``.

    Args:
        lines: Source lines of one file.
        fenced: Fenced ranges of the file, so examples are skipped.
        start: Index of the first tab marker line.

    Returns:
        ``(marker_indices, end)`` where ``end`` is one past the final tab block.
    """
    markers = [start]
    end = _block_end(lines, start)
    while end < len(lines) and _TABS_RE.match(lines[end]) and not _in_fenced(fenced, end):
        markers.append(end)
        end = _block_end(lines, end)
    return markers, end


def _transform_card_grids(lines: list[str]) -> list[str]:
    """Convert ``<div class="grid cards" markdown>`` blocks to ``<Cards>``.

    Args:
        lines: Source lines.

    Returns:
        Converted lines.
    """
    fenced = _fenced_ranges(lines)
    out: list[str] = []
    index = 0
    while index < len(lines):
        if _in_fenced(fenced, index) or not _CARD_GRID_OPEN_RE.match(lines[index]):
            out.append(lines[index])
            index += 1
            continue
        close = next(
            (i for i in range(index + 1, len(lines)) if _CARD_GRID_CLOSE_RE.match(lines[i])),
            None,
        )
        rendered = None if close is None else _render_card_grid(lines, index, close)
        if rendered is None:
            out.append(lines[index])
            index += 1
            continue
        out.extend(rendered)
        index = close + 1
    return out


def transform_text(text: str) -> str:
    """Apply every MkDocs-to-MDX mapping to one document.

    Args:
        text: Raw markdown source.

    Returns:
        Markdown with MkDocs-only syntax replaced by MDX components.
    """
    lines = text.split("\n")
    lines = _transform_snippets(lines)
    lines = _transform_admonitions(lines)
    lines = _transform_tabs(lines)
    lines = _transform_card_grids(lines)
    return "\n".join(lines)


#: Tags the codemod emits.  They are real MDX elements, so their markup must survive
#: :func:`to_mdx` unescaped.
_EMITTED_TAG_RE = re.compile(
    r"^[ \t]*</?(?:Callout|Tabs|Tab|Cards|Card|ClusterConfigPanel|Mermaid|abbr|include)\b",
    re.IGNORECASE,
)
#: Any block-level raw HTML or component tag: such a page cannot render as plain markdown
#: because the ``md`` compiler drops block-level JSX and HTML outright.
_BLOCK_TAG_RE = re.compile(r"^[ \t]*</?[A-Za-z][\w.-]*(?=[\s/>]|$)")
#: ``<scheme://host/path>`` autolinks, which MDX rejects as a malformed element name.
_AUTOLINK_RE = re.compile(r"<((?:https?|ftps?|mailto|tel):[^\s>]*)>")
#: Characters that start a JSX element or a JavaScript expression in MDX prose.
_MDX_ESCAPABLE = "<{}"
#: Prose characters that MDX's entity decoder consumes but CommonMark leaves alone.
_MDX_ENTITY_RE = re.compile(r"&(?:[A-Za-z][A-Za-z0-9]+|#\d+;|#[xX][0-9A-Fa-f]+;)")
_COMMENT_TOKEN = "\x00MDX-COMMENT\x00"


def _split_code_and_prose(text: str) -> list[tuple[bool, str]]:
    """Split a document into ``(is_code, chunk)`` runs.

    Unlike :func:`_fenced_ranges`, which reports only the content between the delimiters,
    this keeps the fence lines themselves inside the code run: to the MDX compiler a fence
    is markup, not prose, and escaping its backticks would break the block.

    Args:
        text: Markdown source.

    Returns:
        Ordered runs of whole lines, each marked as code or prose.
    """
    lines = text.split("\n")
    runs: list[tuple[bool, str]] = []
    buffer: list[str] = []
    in_code = False
    marker = ""
    marker_len = 0

    def flush(current: bool) -> None:
        """Close the current run: append the buffered chunk as one code/prose block."""
        if buffer:
            runs.append((current, "\n".join(buffer)))
            buffer.clear()

    for line in lines:
        match = _FENCE_RE.match(line)
        if not in_code:
            if match:
                flush(False)
                buffer, in_code, marker, marker_len = [line], True, match.group("fence")[0], len(match.group("fence"))
            else:
                buffer.append(line)
            continue
        buffer.append(line)
        if match and match.group("fence")[0] == marker and len(match.group("fence")) >= marker_len:
            flush(True)
            in_code, marker, marker_len = False, "", 0
    flush(in_code)
    return runs or [(False, text)]


def _split_inline_code(prose: str) -> list[tuple[bool, str]]:
    """Split one prose run into ``(is_inline_code, chunk)`` on backtick spans.

    Backslash-escaped backticks are treated as text, matching CommonMark's precedence.

    Args:
        prose: A run of non-code lines.

    Returns:
        Ordered runs of text and inline code spans.
    """
    runs: list[tuple[bool, str]] = []
    cursor = 0
    for match in _INLINE_CODE_RE.finditer(prose):
        if match.start() > cursor:
            runs.append((False, prose[cursor:match.start()]))
        runs.append((True, match.group()))
        cursor = match.end()
    if cursor < len(prose):
        runs.append((False, prose[cursor:]))
    return runs


def _escape_prose(text: str) -> str:
    """Escape the characters MDX would otherwise read as markup or an expression.

    Args:
        text: Prose that is neither fenced nor inline code.

    Returns:
        Text where a bare ``<``, ``{`` or ``}`` carries a backslash.
    """
    out: list[str] = []
    for index, char in enumerate(text):
        if char in _MDX_ESCAPABLE and not (index and text[index - 1] == "\\"):
            out.append("\\")
        out.append(char)
    return "".join(out)


def _as_mdx_comment(match: re.Match[str]) -> str:
    """Turn an HTML comment into the MDX comment that stays invisible in both renderers.

    MDX rejects ``<!--`` as an element name, and a backslash-escaped form would print the
    delimiters as visible text, so the comment becomes an MDX expression comment instead.

    Args:
        match: A comment match from :data:`_HTML_COMMENT_RE`.

    Returns:
        The equivalent ``{/* … */}`` comment, single-line and without nested terminators.
    """
    body = re.sub(r"\s+", " ", match.group().removeprefix("<!--").removesuffix("-->")).strip()
    body = body.replace("*/", "* /")
    return f"{{/* {body} */}}" if body else "{/* */}"


def _decode_md_entities(text: str) -> str:
    """Replace Markdown-style named entities the same way CommonMark's decoder does.

    MDX hands an undecoded ``&nbsp;`` to the JSX parser, which turns it into a component
    lookup; decoding it here keeps the rendered character identical to the MkDocs page.

    Args:
        text: Prose outside code.

    Returns:
        Text with named and numeric character references resolved.
    """
    from html import unescape

    return unescape(text)


def to_mdx(text: str) -> str:
    """Rewrite a page so the MDX compiler renders it without changing what it says.

    The MDX parser is CommonMark plus JSX/expressions, and the two extra grammars disagree
    with Markdown about ``<``, ``{``, ``}``, ``<!--`` and ``<scheme://…>``.  Each is settled
    here in favour of what the MkDocs page displayed: autolinks become explicit links,
    comments become MDX comments (invisible in both), and the remaining characters are
    escaped so they render as the literal text they always were.

    Args:
        text: Markdown source, before or after :func:`transform_text`.

    Returns:
        Source that is safe to compile with ``format: "mdx"``.
    """

    def rewrite_prose(prose: str) -> str:
        """Escape raw angle-brackets/braces in a prose chunk, leaving emitted component tags and inline code untouched."""
        lines: list[str] = []
        for line in prose.split("\n"):
            if _EMITTED_TAG_RE.match(line):
                lines.append(line)
                continue
            parts = [
                _escape_prose(_decode_md_entities(chunk)) if not is_code else chunk
                for is_code, chunk in _split_inline_code(line)
            ]
            lines.append("".join(parts))
        return "\n".join(lines)

    out: list[str] = []
    for is_code, chunk in _split_code_and_prose(text):
        if is_code:
            out.append(chunk)
            continue
        chunk = _AUTOLINK_RE.sub(lambda m: f"[{m.group(1)}]({m.group(1)})", chunk)
        # Comments are parked as sentinel-free tokens: their own braces must not be escaped.
        comments: list[str] = []

        def park(match: re.Match[str]) -> str:
            """Replace an HTML comment with a numbered sentinel so its braces are not escaped, to be restored later."""
            comments.append(_as_mdx_comment(match))
            return f"{_COMMENT_TOKEN}{len(comments) - 1}{_COMMENT_TOKEN}"

        chunk = _HTML_COMMENT_RE.sub(park, chunk)
        chunk = rewrite_prose(chunk)
        for index, comment in enumerate(comments):
            chunk = chunk.replace(f"{_COMMENT_TOKEN}{index}{_COMMENT_TOKEN}", comment)
        out.append(chunk)
    return "\n".join(out)


def mdx_hazards(text: str) -> list[tuple[int, str]]:
    """List prose lines that would still be parsed as JSX by the MDX compiler.

    Args:
        text: Markdown source.

    Returns:
        ``(line_number, line)`` pairs, 1-based, for unescaped ``<``-tags or ``{``-expressions.
    """
    hazards: list[tuple[int, str]] = []
    offset = 0
    for is_code, chunk in _split_code_and_prose(text):
        if not is_code:
            for delta, line in enumerate(chunk.split("\n")):
                if _EMITTED_TAG_RE.match(line):
                    continue
                probe = " ".join(chunk for is_inline, chunk in _split_inline_code(line) if not is_inline)
                probe = _HTML_COMMENT_RE.sub(" ", probe)
                if re.search(r"(?<!\\)[<{}]", probe):
                    hazards.append((offset + delta + 1, line))
        offset += chunk.count("\n") + 1
    return hazards


def requires_mdx(text: str) -> bool:
    """Report whether a page must be compiled as MDX rather than plain markdown.

    A page needs MDX when it carries an element the ``md`` compiler cannot express: an
    admonition, tab set, card grid or include (rewritten by :func:`transform_text`), or a
    block-level raw HTML/component tag that the ``md`` compiler would drop.

    Args:
        text: Markdown source, before or after :func:`transform_text`.

    Returns:
        ``True`` when the page has to use the ``.mdx`` extension.
    """
    if transform_text(text) != text:
        return True
    for is_code, chunk in _split_code_and_prose(text):
        if is_code:
            continue
        for line in chunk.split("\n"):
            if _BLOCK_TAG_RE.match(line) and not _HTML_COMMENT_RE.match(line.strip()):
                return True
    return False


def mdx_filename(path: pathlib.Path, text: str) -> pathlib.Path:
    """Return the path a page should live at for the Fumadocs source loader.

    Args:
        path: Current file path.
        text: Final content of that file.

    Returns:
        ``path`` unchanged for a plain page, or with a ``.mdx`` suffix when MDX is required.
    """
    if path.suffix == ".mdx" or not requires_mdx(text):
        return path
    return path.with_suffix(".mdx")


def pending_markers(text: str) -> list[tuple[int, str]]:
    """Report MkDocs markers the transform deliberately declined to rewrite.

    A marker is declined when converting it would mean authoring content the tool does not
    have — an admonition with no body, a tab with no body, or an include of an unknown file.
    Those lines are left verbatim for a human, and this function is how CI lists them.

    Args:
        text: Markdown source (before or after :func:`transform_text`; both agree).

    Returns:
        ``(line_number, line)`` pairs, 1-based, for markers still present outside code fences.
    """
    transformed = transform_text(text)
    lines = transformed.split("\n")
    fenced = _fenced_ranges(lines)
    found: list[tuple[int, str]] = []
    for index, line in enumerate(lines):
        if _in_fenced(fenced, index):
            continue
        if (
            _ADMON_RE.match(line)
            or _TABS_RE.match(line)
            or _SNIPPET_RE.match(line)
            or _CARD_GRID_OPEN_RE.match(line)
        ):
            found.append((index + 1, line))
    return found


def _component_tag_projection(match: re.Match[str]) -> str:
    """Reduce one MDX component tag to the prose its attributes carry.

    ``title`` and ``value`` hold text that came out of a MkDocs title, so they stay in the
    projection; structural attributes (``type``, ``groupId``, ``items``, ``class``) encode
    the syntax mapping and are dropped on both sides of the comparison.

    Args:
        match: A component tag match from :data:`_COMPONENT_TAG_RE`.

    Returns:
        The kept attribute values, space separated.
    """
    tag = match.group(0)
    kept = [found.group("value") for found in _PROSE_ATTR_RE.finditer(tag)]
    return " " + " ".join(kept) + " "


def prose_projection(text: str) -> str:
    """Reduce markdown to comparable prose for the content-preservation guard.

    Both the MkDocs source and the MDX output are reduced with the same rules, so the
    result must be byte-identical for a purely syntactic rewrite. Fenced code is dropped
    because the codemod never rewrites it.

    Args:
        text: Markdown source, before or after the transform.

    Returns:
        A whitespace-collapsed, markup-free projection of the document.
    """
    body = re.sub(r"(?m)^[ \t]*(?:```|~~~).*?(?:\n|$)", " ", text, flags=re.DOTALL)
    for pattern, replacement in _PROSE_LINE_RULES:
        body = pattern.sub(replacement, body)
    body = _COMPONENT_TAG_RE.sub(_component_tag_projection, body)
    body = re.sub(r"\{\s*/\*.*?\*/\s*\}", " ", body, flags=re.DOTALL)
    body = re.sub(r"<!--.*?-->", " ", body, flags=re.DOTALL)
    # CommonMark decodes character references on both sides, so an entity and the character
    # it stands for are the same prose.
    body = _decode_md_entities(body)
    # MDX renders an escaped character as itself, so `\<` and `<` are the same prose.
    body = re.sub(r"\\([<>{}])", r"\1", body)
    body = re.sub(r"(?m)^[ \t]*(?:[-*+][ \t]+|>[ \t]+)", " ", body)
    body = re.sub(r"[*_`]{1,3}", "", body)
    body = re.sub(r"\s+", " ", body)
    return body.strip()


def default_targets() -> list[pathlib.Path]:
    """List the hand-written markdown pages the codemod owns.

    Returns:
        Sorted markdown and MDX files under ``docs/``, excluding generated and include
        trees.  Both extensions are scanned so the tool stays idempotent once pages have
        been renamed: a re-run finds the plain pages already converted and reports them as
        unchanged rather than skipping them.
    """
    return sorted(
        path
        for path in chain(DOCS_DIR.rglob("**/*.md"), DOCS_DIR.rglob("**/*.mdx"))
        if not _EXCLUDED_PARTS & set(path.relative_to(DOCS_DIR).parts)
    )


def main(argv: list[str] | None = None) -> int:
    """Run the codemod over the given files.

    Args:
        argv: Argument vector (defaults to ``sys.argv[1:]``).

    Returns:
        ``0`` on success, ``1`` when ``--check`` found pending work or a guard fired.
    """
    parser = argparse.ArgumentParser(description="Rewrite MkDocs syntax to MDX components.")
    parser.add_argument("--check", action="store_true", help="report changes without writing")
    parser.add_argument("--verbose", action="store_true", help="list files with no changes too")
    parser.add_argument("paths", nargs="*", help="markdown files (default: hand-written pages)")
    args = parser.parse_args(argv)

    targets = [pathlib.Path(p) for p in args.paths] or default_targets()
    changed: list[pathlib.Path] = []
    for path in targets:
        original = path.read_text(encoding="utf-8")
        updated = to_mdx(transform_text(original))
        if prose_projection(original) != prose_projection(updated):
            print(f"REFUSING {path}: prose changed — this tool must not edit content", file=sys.stderr)
            return 1
        if updated == original:
            if args.verbose:
                print(f"unchanged {_display(path)}")
            continue
        changed.append(path)
        if not args.check:
            destination = mdx_filename(path, updated)
            destination.write_text(updated, encoding="utf-8")
            if destination != path:
                path.unlink()

    verb = "would rewrite" if args.check else "rewrote"
    for path in changed:
        print(f"{verb} {_display(path)}")
    print(f"{len(changed)} of {len(targets)} file(s) {'pending' if args.check else 'changed'}.")
    return 1 if (args.check and changed) else 0


def _display(path: pathlib.Path) -> str:
    """Render a path relative to the repository root when it lives inside it.

    Args:
        path: File being reported on.

    Returns:
        Repo-relative path, or the path as given when it is outside the repository.
    """
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


if __name__ == "__main__":
    sys.exit(main())
