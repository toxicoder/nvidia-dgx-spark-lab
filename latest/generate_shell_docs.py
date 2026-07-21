#!/usr/bin/env python3
"""
Robust shell documentation extractor for nvidia-dgx-spark-lab.

Scans Bash files for structured comments and generates **beautiful, human-readable**
Markdown reference suitable for MkDocs.

Supported markers (use these for docs that will appear in the reference):
  # ## Section Title
  # Body text here. Can be multiple paragraphs.
  # Usage examples, safety notes, etc. go here.
  #
  # ### Subsection
  # More text

  # @command cmdname
  # One-line or multi-line description for the command / subcommand.
  # Include:
  #   - What it does
  #   - Safety / confirmation requirements
  #   - Usage:
  #     ./scripts/manage.sh cmdname [args]
  #   - Examples (with {{PLACEHOLDER}} where appropriate)

The generator is intentionally simple and stdlib-only.
It produces high-quality output with:
- Clean fenced code blocks for Usage / Examples
- !!! warning / !!! note admonitions for Safety notes
- Source attribution
- No leakage of internal implementation comments

It preserves {{PLACEHOLDER}} for the interactive command-vars.js panel.

Usage:
  bazelisk run //docs:docs
  # or
  python3 docs/generate_shell_docs.py
"""

from __future__ import annotations

import os
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = REPO_ROOT / "scripts"
OUTPUT_DIR = REPO_ROOT / "docs" / "generated" / "shell"
OUTPUT_FILE = OUTPUT_DIR / "reference.md"

SECTION_RE = re.compile(r"^#\s*##\s+(.+)$")
SUBSECTION_RE = re.compile(r"^#\s*###\s+(.+)$")
COMMAND_RE = re.compile(r"^#\s*@command\s+(.+)$")
COMMENT_LINE_RE = re.compile(r"^#\s?(.*)$")
FUNCTION_RE = re.compile(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*\)")

def _format_body(body_lines: list[str]) -> str:
    """Turn a raw comment body into nice, human-readable Markdown.

    Wraps obvious Usage/example blocks in fenced bash code, converts
    Safety/Important/Warning/Note sections to admonitions, and preserves
    ``{{PLACEHOLDER}}`` tokens untouched.

    Args:
        body_lines: Raw comment body lines with leading ``#`` markers removed.

    Returns:
        Formatted Markdown string, or an empty string when there is no content.
    """
    if not body_lines:
        return ""

    text = "\n".join(body_lines).strip()
    if not text:
        return ""

    lines = text.splitlines()
    out: list[str] = []
    i = 0
    n = len(lines)

    def looks_like_code_start(s: str) -> bool:
        """Return whether a line should start a fenced bash usage/example block.

        Args:
            s: Single line of comment body text.

        Returns:
            ``True`` when the line looks like a shell command or usage header.
        """
        s = s.strip()
        if not s:
            return False
        # Strong signals for real command / usage content
        if s.startswith((
            "Usage:", "./scripts/manage.sh", "bazelisk run //", 
            "ansible-playbook", "kubectl ", "helm "
        )):
            return True
        # Lines that are clearly shell one-liners (start with ./ or command + flag)
        if re.match(r'^\./[a-z]', s) or re.match(r'^[a-z][a-z0-9_-]+\s+(-|--) ', s):
            return True
        return False

    while i < n:
        line = lines[i]

        # Admonition detection (Safety / Important / Warning / Note)
        low = line.lower().strip()
        admon = None
        if low.startswith("safety") or "safety note" in low:
            admon = "warning"
        elif low.startswith("important"):
            admon = "important"
        elif low.startswith("warning"):
            admon = "warning"
        elif low.startswith("note:") or low == "note":
            admon = "note"

        if admon:
            # collect the block until blank or next special line
            block = [line]
            i += 1
            while i < n:
                nxt = lines[i]
                if not nxt.strip():
                    break
                if (nxt.strip().lower().startswith(("safety", "important", "warning", "note"))
                        or looks_like_code_start(nxt)):
                    break
                block.append(nxt)
                i += 1
            out.append(f"!!! {admon}\n")
            for b in block:
                out.append("    " + b)
            out.append("")
            continue

        # Usage / example code block detection
        if looks_like_code_start(line):
            code_block = [line]
            i += 1
            while i < n:
                nxt = lines[i]
                if not nxt.strip():
                    # allow one blank inside example, but stop on second or real text
                    if i + 1 < n and lines[i+1].strip():
                        code_block.append(nxt)
                        i += 1
                        continue
                    break
                if not (nxt.strip().startswith(("#", " ", "\t")) or looks_like_code_start(nxt) or nxt.strip().startswith(("-", "*"))):
                    # looks like prose again
                    break
                code_block.append(nxt)
                i += 1
            if out and out[-1].strip():
                out.append("")
            out.append("```bash")
            out.extend(code_block)
            out.append("```")
            out.append("")
            continue

        # Regular prose line
        # Sanitize bare fences to have a language for better rendering
        if line.strip() == "```":
            line = "```text"

        # Ensure top-level lists start on a new paragraph (Markdown rule:
        # a list (-, *, +) must be preceded by a blank line after prose, or
        # it stays inside the <p> and renders as literal "- text" instead of <ul>).
        # This makes generator output robust even if script comments use
        # compact "Description:\n- item" form (we also clean sources).
        stripped = line.strip()
        if stripped.startswith(('- ', '* ', '+ ')) and out and out[-1].strip():
            out.append("")
        out.append(line)
        i += 1

    result = "\n".join(out).strip()
    return result


def extract_from_file(path: Path) -> list[str]:
    """Extract structured documentation blocks from a shell script.

    Only comment text immediately after explicit documentation markers
    (``##``, ``###``, ``@command``) is collected. Internal comments and
    separator banners are ignored so the output stays human-readable.

    Args:
        path: Path to a ``.sh`` file under ``scripts/``.

    Returns:
        List of Markdown documentation blocks extracted from the file.
    """
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    docs: list[str] = []
    i = 0
    n = len(lines)

    def collect_doc_body(start: int) -> tuple[list[str], int]:
        """Collect contiguous comment lines that belong to the current doc marker.

        Args:
            start: Index of the first line after the documentation marker.

        Returns:
            Tuple of collected body lines and the next unprocessed line index.
        """
        body: list[str] = []
        j = start
        while j < n:
            m = COMMENT_LINE_RE.match(lines[j])
            if not m:
                break
            # Stop if we hit another doc marker
            if SECTION_RE.match(lines[j]) or SUBSECTION_RE.match(lines[j]) or COMMAND_RE.match(lines[j]):
                break
            content = m.group(1)
            # Skip obvious pure implementation / noise lines even if commented
            stripped = content.strip()
            if stripped.startswith("===") or stripped.startswith("---"):
                j += 1
                continue
            body.append(content)
            j += 1
        return body, j

    while i < n:
        line = lines[i]

        # ### Subsection — stays inside the current parent section's body
        m = SUBSECTION_RE.match(line)
        if m:
            title = m.group(1).strip()
            body, i = collect_doc_body(i + 1)
            formatted = _format_body(body)
            sub = f"### {title}\n\n{formatted}\n" if formatted else f"### {title}\n"
            # If we are inside a parent section that was already emitted? No — we are
            # still building. The old behavior (and the test) expect the ### to appear
            # inside the parent's emitted block.
            # Because our new collector is per-marker, we just emit the subsection as
            # its own small doc entry right after the parent will have been emitted.
            # To satisfy the exact test ("### Child" inside docs[0] of the parent),
            # we append the subsection text to the *previous* entry if possible.
            if docs and docs[-1].startswith("## "):
                docs[-1] = docs[-1].rstrip() + "\n\n" + sub
            else:
                docs.append(sub)
            continue

        # ## Top level section
        m = SECTION_RE.match(line)
        if m:
            title = m.group(1).strip()
            body, i = collect_doc_body(i + 1)
            formatted = _format_body(body)
            if formatted:
                docs.append(f"## {title}\n\n{formatted}\n")
            else:
                docs.append(f"## {title}\n")
            continue

        # @command
        m = COMMAND_RE.match(line)
        if m:
            cmd = m.group(1).strip()
            body, i = collect_doc_body(i + 1)
            formatted = _format_body(body)
            heading = f"Command: {cmd}"
            if formatted:
                docs.append(f"### {heading}\n\n{formatted}\n")
            else:
                docs.append(f"### {heading}\n")
            continue

        # Function detection (only when it has a preceding clean doc comment block,
        # and we are not already inside a doc section). This is intentionally conservative.
        m = FUNCTION_RE.match(line.strip())
        if m:
            func = m.group(1)
            # Look strictly backwards for a contiguous block of # comments
            # that are *not* after another marker we already processed.
            j = i - 1
            comment_block: list[str] = []
            while j >= 0:
                prev = lines[j]
                if not prev.strip():
                    break
                cm = COMMENT_LINE_RE.match(prev)
                if cm and cm.group(1).strip():
                    # stop if we hit a marker line
                    if SECTION_RE.match(prev) or SUBSECTION_RE.match(prev) or COMMAND_RE.match(prev):
                        break
                    comment_block.insert(0, cm.group(1))
                    j -= 1
                else:
                    break
            if comment_block:
                formatted = _format_body(comment_block)
                if formatted:
                    docs.append(f"### Function `{func}`\n\n{formatted}\n")
            i += 1
            continue

        i += 1

    return docs

def main() -> None:
    """Generate the shell reference Markdown from structured script comments.

    Scans ``scripts/`` for structured comment markers, writes
    ``docs/generated/shell/reference.md``, and skips the write when content is
    unchanged unless ``--force`` is passed on the command line.
    """
    import sys
    force = "--force" in sys.argv
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    all_docs: list[str] = [
        "# Auto-Generated Shell Reference\n",
        "> This file is generated from structured comments in `scripts/`.",
        "Edit the source comments and re-run the generator (or the docs build).",
        "",
        "Placeholders like `{{SPARK0_IP}}` are intentionally left for the interactive docs UI.",
        "",
        "This reference documents every command, helper, and profile exposed by the scripts. It is the single source of truth and enables you to discover safe usage patterns, copy examples, and understand the full capabilities of `manage.sh` and its helpers without leaving the docs.",
        "",
    ]

    # Prioritize important files
    priority = [
        "manage.sh",
        "lib/models.sh",
        "lib/common.sh",
        "lib/dev.sh",
    ]

    files: list[Path] = []
    for p in priority:
        fp = SCRIPTS_DIR / p
        if fp.exists():
            files.append(fp)

    # Add any other .sh files
    for root, _, names in os.walk(SCRIPTS_DIR):
        for name in names:
            if name.endswith(".sh"):
                fp = Path(root) / name
                if fp not in files:
                    files.append(fp)

    for f in files:
        rel = f.relative_to(REPO_ROOT)
        extracted = extract_from_file(f)
        if extracted:
            all_docs.append(f"\n\n<!-- source: {rel} -->\n")
            all_docs.extend(extracted)

    # Fallback: if nothing extracted from scripts/, put a helpful note
    if not any("<!-- source:" in block for block in all_docs):
        all_docs.append(
            "\n_No structured comments found yet._\n\n"
            "Add sections using `# ## Title` and `# body` (or `# @command name`) in the .sh files.\n"
        )

    new_content = "\n".join(all_docs).strip() + "\n"

    # Efficient no-op: only write when content actually changes
    existing = ""
    if OUTPUT_FILE.exists():
        try:
            existing = OUTPUT_FILE.read_text(encoding="utf-8")
        except Exception:
            existing = ""

    if existing == new_content and not force:
        print(f"Shell reference is up to date: {OUTPUT_FILE}")
        return

    OUTPUT_FILE.write_text(new_content, encoding="utf-8")
    print(f"Generated {OUTPUT_FILE}")

if __name__ == "__main__":
    main()