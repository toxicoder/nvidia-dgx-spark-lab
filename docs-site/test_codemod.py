#!/usr/bin/env python3
"""Unit tests for the MkDocs-to-MDX codemod (docs-site/scripts/codemod_mkdocs_to_mdx.py).

Run: bazelisk test //docs-site:codemod_test   (or: python3 -m unittest -v test_codemod.py)

These tests pin the two properties the migration depends on:
1. every MkDocs-only syntax form is rewritten to the expected MDX component, and
2. no wording is ever changed (the prose-projection guard).
"""

from __future__ import annotations

import contextlib
import io
import pathlib
import re
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "scripts"))

import codemod_mkdocs_to_mdx as codemod  # noqa: E402

CODEMOD_SCRIPT = pathlib.Path(codemod.__file__).resolve()


class AdmonitionTests(unittest.TestCase):
    """``!!!`` admonitions map onto ``<Callout>`` with the documented type table."""

    def test_note_becomes_info_calloout_with_title(self) -> None:
        source = '!!! note "Heads up"\n\n    Body text here.\n'
        result = codemod.transform_text(source)
        self.assertIn('<Callout type="info" title="Heads up">', result)
        self.assertIn("Body text here.", result)
        self.assertIn("</Callout>", result)
        self.assertNotIn("!!!", result)

    def test_type_mapping_covers_all_repo_classes(self) -> None:
        cases = {
            "danger": "error",
            "warning": "warning",
            "tip": "info",
            "note": "info",
            "bug": "error",
            "unknown-class": None,
        }
        for admonition_class, expected in cases.items():
            with self.subTest(admonition_class=admonition_class):
                result = codemod.transform_text(f'!!! {admonition_class}\n\n    Body.\n')
                if expected is None:
                    self.assertIn(f"!!! {admonition_class}", result)
                    continue
                self.assertIn(f'<Callout type="{expected}">', result)

    def test_untitled_admonition_omits_title_attribute(self) -> None:
        result = codemod.transform_text("!!! warning\n\n    Careful.\n")
        self.assertEqual('<Callout type="warning">\n  Careful.\n</Callout>', result)

    def test_multiline_body_keeps_relative_indentation(self) -> None:
        source = "!!! danger\n\n    - one\n    - two\n\n        nested\n"
        result = codemod.transform_text(source)
        self.assertIn("  - one", result)
        self.assertIn("      nested", result)

    def test_title_only_admonition_keeps_its_warning(self) -> None:
        """MkDocs rendered a title-only admonition; the heading is the content."""
        source = "intro\n\n!!! danger \"Do not reboot during a run\"\n\n## Next\n"
        result = codemod.transform_text(source)
        self.assertIn('<Callout type="error" title="Do not reboot during a run" />', result)
        self.assertNotIn("!!!", result)
        self.assertIn("## Next", result)

    def test_untitled_empty_admonition_is_left_for_review(self) -> None:
        """A marker with neither title nor body has no content to preserve; leave it."""
        source = "intro\n\n!!! danger\n\n## Next\n"
        result = codemod.transform_text(source)
        self.assertIn("!!! danger", result)
        self.assertNotIn("<Callout", result)

    def test_marker_inside_code_fence_is_left_alone(self) -> None:
        source = "```text\n!!! note \"example of the syntax\"\n\n    not a real admonition\n```\n"
        self.assertEqual(source, codemod.transform_text(source))


class TabsTests(unittest.TestCase):
    """Consecutive ``===`` blocks collapse into one ``<Tabs>`` group."""

    def test_two_tabs_share_one_group(self) -> None:
        source = '=== "Bazel"\n\n    ```bash\n    bazelisk run //:validate\n    ```\n\n=== "Classic"\n\n    make validate\n'
        result = codemod.transform_text(source)
        self.assertEqual(1, result.count("<Tabs "), f"expected one Tabs group:\n{result}")
        self.assertEqual(2, result.count("<Tab "))
        self.assertIn('groupId="bazel-classic"', result)
        self.assertIn('items={["Bazel", "Classic"]}', result)
        self.assertIn("bazelisk run //:validate", result)
        self.assertIn("make validate", result)
        self.assertNotIn('=== "', result)

    def test_four_separated_by_prose_stay_separate_groups(self) -> None:
        source = (
            '=== "1-node"\n\n    one\n\n=== "2-node"\n\n    two\n\n'
            "Some prose between the groups.\n\n"
            '=== "Bazel"\n\n    three\n\n=== "Classic"\n\n    four\n'
        )
        result = codemod.transform_text(source)
        self.assertEqual(2, result.count("<Tabs "), f"expected two groups:\n{result}")
        self.assertIn('groupId="1-node-2-node"', result)
        self.assertIn('groupId="bazel-classic"', result)

    def test_duplicate_titles_are_never_merged(self) -> None:
        """Same-label tabs stay distinct; neither label is renamed or dropped."""
        source = '=== "Same"\n\n    a\n\n=== "Same"\n\n    b\n'
        result = codemod.transform_text(source)
        self.assertNotRegex(r'(?m)^\s*===\s+"', result)
        self.assertEqual(2, result.count("<Tabs "), f"each tab keeps its own group:\n{result}")
        self.assertEqual(2, result.count('value="Same"'))
        self.assertIn("    a\n", result)
        self.assertIn("    b\n", result)

    def test_tab_marker_inside_code_fence_is_left_alone(self) -> None:
        source = '```text\n=== "Title"\n\n    literal\n```\n'
        self.assertEqual(source, codemod.transform_text(source))


class SnippetTests(unittest.TestCase):
    """``--8<--`` directives become the component that owns that content."""

    def test_cluster_config_include_becomes_panel(self) -> None:
        result = codemod.transform_text('intro\n--8<-- "docs/includes/cluster-config.md"\nafter\n')
        self.assertIn("<ClusterConfigPanel />", result)
        self.assertNotIn("--8<--", result)
        self.assertIn("intro", result)
        self.assertIn("after", result)

    def test_abbreviations_include_becomes_loader_marker(self) -> None:
        result = codemod.transform_text('--8<-- "docs/includes/abbreviations.md"\n')
        self.assertIn("glossary", result)
        self.assertNotIn("--8<--", result)

    def test_unknown_include_is_preserved_for_review(self) -> None:
        source = '--8<-- "docs/includes/mystery.md"\n'
        self.assertIn("--8<--", codemod.transform_text(source))


class CardGridTests(unittest.TestCase):
    """The ``grid cards`` md_in_html block becomes ``<Cards>``/``<Card>``."""

    SOURCE = (
        '<div class="grid cards" markdown>\n\n'
        "-   **First cluster**\n\n"
        "    ---\n\n"
        "    Inventory then bootstrap.\n\n"
        "    [Getting Started](getting-started.md)\n\n"
        "-   **Run a model**\n\n"
        "    ---\n\n"
        "    Pick a profile.\n\n"
        "</div>\n"
    )

    def test_cards_render_as_components(self) -> None:
        result = codemod.transform_text(self.SOURCE)
        self.assertIn("<Cards>", result)
        self.assertIn('<Card title="First cluster">', result)
        self.assertIn('<Card title="Run a model">', result)
        self.assertNotIn('<div class="grid cards"', result)
        self.assertIn("Inventory then bootstrap.", result)
        self.assertIn("[Getting Started](getting-started.md)", result)

    def test_card_count_matches_items(self) -> None:
        result = codemod.transform_text(self.SOURCE)
        self.assertEqual(2, result.count("<Card title="))


class ProsePreservationTests(unittest.TestCase):
    """The guard: no run may alter wording, and the guard must actually fire."""

    def test_projection_ignores_syntax_only_differences(self) -> None:
        before = '!!! warning "Safety"\n\n    Never reboot during a run.\n'
        after = codemod.transform_text(before)
        self.assertEqual(codemod.prose_projection(before), codemod.prose_projection(after))

    def test_projection_detects_edited_wording(self) -> None:
        before = "!!! warning\n\n    Original sentence.\n"
        tampered = before.replace("Original sentence.", "Rewritten sentence!")
        self.assertNotEqual(
            codemod.prose_projection(before), codemod.prose_projection(tampered)
        )

    def test_projection_keeps_tab_titles_as_prose(self) -> None:
        before = '=== "Bazel"\n\n    run it\n'
        self.assertIn("Bazel", codemod.prose_projection(before))
        self.assertIn("run it", codemod.prose_projection(before))

    def test_transform_is_idempotent(self) -> None:
        once = codemod.transform_text(self.SOURCE_MIX)
        self.assertEqual(once, codemod.transform_text(once))

    SOURCE_MIX = (
        '=== "Bazel"\n\n    bazelisk run //:validate\n\n'
        '=== "Classic"\n\n    make validate\n\n'
        '!!! danger "apply_now"\n\n    Can reboot the node.\n\n'
        '<div class="grid cards" markdown>\n\n'
        "-   **Path**\n\n"
        "    ---\n\n"
        "    Body.\n\n"
        "</div>\n"
    )


class MdxSafetyTests(unittest.TestCase):
    """Pages compiled as MDX must not have prose swallowed by the JSX parser.

    ``format: "mdx"`` treats ``<word`` as the start of an element and ``{`` as a JavaScript
    expression, so those characters have to be escaped in prose.  Fenced code, inline code
    and the component tags the codemod itself emits are exempt.
    """

    def test_angle_bracket_in_prose_is_escaped(self) -> None:
        result = codemod.to_mdx("- Coder: http://<node-ip>:32080\n")
        self.assertIn("\\<node-ip>", result)
        self.assertNotIn("http://<node-ip>", result)

    def test_braces_in_prose_are_escaped(self) -> None:
        result = codemod.to_mdx("Use {{SPARK0_IP}} to reach the node.\n")
        self.assertIn("\\{\\{SPARK0_IP\\}\\}", result)

    def test_html_comment_becomes_an_invisible_mdx_comment(self) -> None:
        """``<!--`` is rejected by the MDX parser and an escaped form would be printed."""
        result = codemod.to_mdx("before\n\n<!-- a note -->\n\nafter\n")
        self.assertIn("{/* a note */}", result)
        self.assertNotIn("<!--", result)

    def test_autolink_becomes_an_explicit_link(self) -> None:
        """``<https://…>`` is rejected as an element name; a link keeps it clickable."""
        result = codemod.to_mdx("see <https://example.com/a> ok\n")
        self.assertIn("[https://example.com/a](https://example.com/a)", result)
        self.assertNotIn("<https://", result)

    def test_code_fence_content_is_not_escaped(self) -> None:
        source = "```bash\n{{SPARK0_IP:=<your-spark0>}} ./scripts/manage.sh start-kimi\n```\n"
        self.assertIn("{{SPARK0_IP:=<your-spark0>}}", codemod.to_mdx(source))

    def test_inline_code_is_not_escaped(self) -> None:
        result = codemod.to_mdx("Run `{{SPARK0_IP}}` and `echo <b>` here.\n")
        self.assertIn("`{{SPARK0_IP}}`", result)
        self.assertIn("`echo <b>`", result)

    def test_emitted_component_tags_are_not_escaped(self) -> None:
        source = '=== "Bazel"\n\n    make test\n\n=== "Classic"\n\n    make classic\n'
        result = codemod.to_mdx(codemod.transform_text(source))
        self.assertIn('items={["Bazel", "Classic"]}', result)
        self.assertIn("<Tabs groupId=", result)
        self.assertNotIn("\\<Tabs", result)

    def test_escaping_is_idempotent(self) -> None:
        source = "http://<node-ip>:32080 with {{TOKEN}}\n"
        once = codemod.to_mdx(source)
        self.assertEqual(once, codemod.to_mdx(once))

    def test_escaping_never_changes_prose(self) -> None:
        source = (
            '!!! note "Heads up"\n\n    Body with <node-ip> and {{TOKEN}}.\n\n'
            "```bash\nhttp://<node-ip>:1\n```\n"
        )
        self.assertEqual(codemod.prose_projection(source), codemod.prose_projection(codemod.to_mdx(source)))

    def test_requires_mdx_flags_pages_that_need_jsx(self) -> None:
        self.assertTrue(codemod.requires_mdx('!!! note "T"\n\n    Body.\n'))
        self.assertTrue(codemod.requires_mdx('<div class="grid cards" markdown>\n\n-   **A**\n\n    B\n\n</div>\n'))
        self.assertFalse(codemod.requires_mdx("# Plain\n\nJust prose.\n"))


class MdxNamingTests(unittest.TestCase):
    """``mdx_filename`` renames exactly the pages that need JSX."""

    def test_plain_page_keeps_markdown_suffix(self) -> None:
        path = pathlib.Path("docs/plain.md")
        self.assertEqual(path, codemod.mdx_filename(path, "# Title\n\nJust prose.\n"))

    def test_jsx_page_is_renamed_to_mdx(self) -> None:
        path = pathlib.Path("docs/page.md")
        self.assertEqual(
            pathlib.Path("docs/page.mdx"),
            codemod.mdx_filename(path, '<Callout type="info">Body</Callout>\n'),
        )

    def test_already_mdx_page_is_left_alone(self) -> None:
        path = pathlib.Path("docs/page.mdx")
        self.assertEqual(path, codemod.mdx_filename(path, '<Callout type="info">Body</Callout>\n'))


class CliTests(unittest.TestCase):
    """``main`` writes the rewritten text back and renames the pages that need MDX."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix="codemod-cli-")
        self.addCleanup(self._tmp.cleanup)
        self.root = pathlib.Path(self._tmp.name)
        self.docs = self.root / "docs"
        self.docs.mkdir()
        (self.docs / "jsx-page.md").write_text(
            '# Title\n\n!!! note "Heads up"\n\n    Body text here.\n', encoding="utf-8"
        )
        (self.docs / "plain-page.md").write_text(
            "# Title\n\nJust prose with a [link](other.md).\n", encoding="utf-8"
        )

    def test_main_rewrites_and_renames_only_jsx_pages(self) -> None:
        targets = [self.docs / "jsx-page.md", self.docs / "plain-page.md"]
        self.assertEqual(0, codemod.main([str(p) for p in targets]))
        self.assertFalse((self.docs / "jsx-page.md").exists(), "JSX page should have been renamed")
        renamed = self.docs / "jsx-page.mdx"
        self.assertTrue(renamed.is_file(), "renamed MDX page should exist")
        text = renamed.read_text(encoding="utf-8")
        self.assertIn('<Callout type="info" title="Heads up">', text)
        # A page that needs no JSX keeps its name and its content.
        plain = self.docs / "plain-page.md"
        self.assertTrue(plain.is_file(), "plain page must keep its .md name")
        self.assertIn("Just prose with a [link](other.md).", plain.read_text(encoding="utf-8"))

    def test_main_output_is_mdx_safe(self) -> None:
        """The CLI applies the escaping pass, not only the structural rewrite.

        ``dev-workspaces`` has ``http://<node-ip>:32080`` in prose; MDX parses an
        unescaped ``<`` as the start of a component and the build fails, so what
        ``main`` writes has to be what ``to_mdx`` produces.
        """
        source = (
            '# Title\n\n!!! note "Heads up"\n\n    Body text here.\n\n'
            "Open http://<node-ip>:32080 to continue.\n"
        )
        (self.docs / "jsx-page.md").write_text(source, encoding="utf-8")
        self.assertEqual(0, codemod.main([str(self.docs / "jsx-page.md")]))
        written = (self.docs / "jsx-page.mdx").read_text(encoding="utf-8")
        self.assertEqual([], codemod.mdx_hazards(written))
        self.assertIn("\\<node-ip>", written)

    def test_check_mode_writes_nothing(self) -> None:
        targets = [self.docs / "jsx-page.md"]
        before = (self.docs / "jsx-page.md").read_text(encoding="utf-8")
        self.assertEqual(1, codemod.main(["--check", *[str(p) for p in targets]]))
        self.assertEqual(before, (self.docs / "jsx-page.md").read_text(encoding="utf-8"))
        self.assertFalse((self.docs / "jsx-page.mdx").exists(), "--check must not create files")


class UnconvertibleBlockTests(unittest.TestCase):
    """Malformed MkDocs blocks are left alone rather than half-translated.

    Every branch here is a decision the tool makes about a page it cannot represent as MDX
    components.  Silently guessing would put invented markup into content that reviewers
    approved as a mechanical conversion, so the safe answer is to leave the source verbatim
    and let ``pending_markers`` report it as outstanding work.
    """

    def lines(self, text: str) -> list[str]:
        return text.split("\n")

    def test_unclosed_fence_spans_to_end_of_file(self) -> None:
        """A file that ends inside a fence must not lose the fence's contents."""
        text = "before\n\n```bash\n$ echo hi\n"
        self.assertEqual(codemod.transform_text(text), text)

    def test_blank_lines_are_trimmed_from_a_block_body(self) -> None:
        """Trailing blanks inside a block do not become blank lines inside the component."""
        converted = codemod.transform_text('!!! note "Title"\n\n    Body.\n\n\n')
        self.assertIn('<Callout type="info" title="Title">', converted)
        self.assertNotIn("\n\n\n", converted)

    def test_admonition_with_a_class_is_left_alone(self) -> None:
        """``!!! note .custom`` selects a CSS class MkDocs applied; there is no Callout prop for it."""
        source = '!!! note .custom "Title"\n\n    Body.\n'
        self.assertEqual(codemod.transform_text(source), source)

    def test_unknown_admonition_type_is_left_alone(self) -> None:
        """An unmapped type has no Callout variant, so inventing one would change meaning."""
        source = '!!! cosmos "Title"\n\n    Body.\n'
        self.assertEqual(codemod.transform_text(source), source)

    def test_marker_with_neither_title_nor_body_is_left_alone(self) -> None:
        """An empty marker carries no content; an empty box would be fabricated chrome."""
        source = "!!! note\n\n\nbody after\n"
        self.assertIn("!!! note", codemod.transform_text(source))

    def test_tab_marker_with_trailing_text_is_left_alone(self) -> None:
        """Text after the closing quote is not a tab title, so the run is not a tab run."""
        source = '=== "One" extra\n\n    body\n\n=== "Two"\n\n    body\n'
        self.assertIn('=== "One" extra', codemod.transform_text(source))

    def test_empty_tab_body_is_left_alone(self) -> None:
        """A tab with no body would render as an empty pane the source does not describe."""
        source = '=== "One"\n\n=== "Two"\n\n    body\n'
        self.assertIn('=== "One"', codemod.transform_text(source))

    def test_duplicate_tab_titles_get_their_own_groups(self) -> None:
        """Repeated labels are content: sharing a persisted group would couple two panels.

        The duplicate-label path is the one place the tool has to invent an identifier, so it
        has to stay stable and separate from the ordinary group id.
        """
        source = '=== "Same"\n\n    first\n\n=== "Same"\n\n    second\n'
        converted = codemod.transform_text(source)
        self.assertEqual(converted.count("<Tabs "), 2, "each duplicate label needs its own group")
        group_ids = re.findall(r'groupId="([^"]+)"', converted)
        self.assertEqual(len(group_ids), len(set(group_ids)), "the two groups must not share an id")
        self.assertEqual(converted.count("<Tab "), 2)
        self.assertEqual(codemod.prose_projection(source), codemod.prose_projection(converted))

    def test_duplicate_titles_with_an_empty_tab_are_left_alone(self) -> None:
        """The duplicate-label path refuses an empty pane just as the normal path does.

        Both tab renderers have to agree on what counts as unconvertible, otherwise a page
        with repeated labels would get a different answer to the same malformed block.
        """
        source = '=== "Same"\n\n=== "Same"\n\n    second\n'
        self.assertIn('=== "Same"', codemod.transform_text(source))

    def test_card_grid_without_items_is_left_alone(self) -> None:
        """An empty card grid has nothing to render; emitting <Cards> would add chrome."""
        source = '<div class="grid cards" markdown>\n\n</div>\n'
        self.assertEqual(codemod.transform_text(source), source)

    def test_card_grid_with_prose_before_the_first_item_is_left_alone(self) -> None:
        """Leading prose has no card to attach to, so the block is not a card grid."""
        source = '<div class="grid cards" markdown>\n\n'
        source += "loose prose\n\n-   **Path**\n\n    Body.\n\n</div>\n"
        self.assertEqual(codemod.transform_text(source), source)

    def test_card_without_a_title_is_left_alone(self) -> None:
        """A card whose first line is not a bold title cannot get a title attribute."""
        source = '<div class="grid cards" markdown>\n\n'
        source += "-   not a title\n\n    Body.\n\n</div>\n"
        self.assertEqual(codemod.transform_text(source), source)

    def test_unterminated_card_grid_is_left_alone(self) -> None:
        """Without a closing div the extent is unknown, so nothing is consumed."""
        source = '<div class="grid cards" markdown>\n\n-   **Path**\n\n    Body.\n'
        self.assertEqual(codemod.transform_text(source), source)

    def test_an_unconvertible_tab_run_is_kept_whole(self) -> None:
        """A run containing one bad marker is left verbatim rather than half-rendered.

        The run's markers share a consumed range, so rendering only its convertible members
        drops the bodies belonging to the skipped marker.  Keeping the run intact instead
        leaves it reported as pending work, which is the only outcome that preserves content.
        """
        source = '=== "One"\n\n    body one\n\n'
        source += '=== "Two" extra\n\n    body two\n\n'
        source += '=== "Three"\n\n    body three\n'
        converted = codemod.transform_text(source)
        for fragment in ("body one", "body two", "body three"):
            self.assertIn(fragment, converted, f"{fragment} must survive the run")
        self.assertIn('=== "One"', converted, "the run must stay verbatim")
        self.assertIn('=== "Two" extra', converted)
        self.assertNotIn("body one", converted.split("=== ")[0], "no partial render before the bad marker")
        self.assertEqual(codemod.prose_projection(source), codemod.prose_projection(converted))

    def test_hazards_report_raw_markup_outside_code_and_emitted_tags(self) -> None:
        """Prose MDX would parse as a tag is flagged, and only there.

        ``mdx_hazards`` is the pre-write gate, so both its misses and its false positives
        cost something: a miss breaks the build, a false positive blocks a clean page.  An
        already-escaped ``\\<`` is the fix the tool applies, so it must read as safe.
        """
        raw = "Open http://<node-ip>:32080 now.\n"
        self.assertEqual([line for _, line in codemod.mdx_hazards(raw)], [raw.strip()])
        self.assertEqual(codemod.mdx_hazards(raw.replace("<node-ip>", "\\<node-ip>")), [])
        self.assertEqual(codemod.mdx_hazards("value is {x} here.\n"), [(1, "value is {x} here.")])
        self.assertEqual(codemod.mdx_hazards("```\n<u>x</u>\n```\n"), [])

    def test_pending_markers_ignore_fenced_examples(self) -> None:
        """Documentation about MkDocs syntax quotes it in fences; that is not pending work.

        Only markers the transform declined to rewrite stay in the output, so the fixture uses
        an empty tab block and an unmapped admonition type: both survive verbatim outside the
        fence, and the fenced copies must not be counted.
        """
        text = '=== "Solo"\n\n!!! cosmos "Title"\n\n    Body.\n\n```text\n=== "Tab"\n```\n'
        positions = [line for _, line in codemod.pending_markers(text)]
        self.assertEqual(len(positions), 2, "only the two declined markers outside the fence count")
        self.assertIn('=== "Solo"', " ".join(positions))
        self.assertIn("!!! cosmos", " ".join(positions))


class MainGuardTests(unittest.TestCase):
    """``main`` is the entry point Bazel and the docs scripts run, so its exits are contract."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix="codemod-main-")
        self.addCleanup(self._tmp.cleanup)
        self.root = pathlib.Path(self._tmp.name)
        self.docs = self.root / "docs"
        self.docs.mkdir()

    def _write(self, name: str, text: str) -> pathlib.Path:
        path = self.docs / name
        path.write_text(text, encoding="utf-8")
        return path

    def test_reports_unchanged_files_when_verbose(self) -> None:
        """--verbose lists pages that need nothing, which is how a reviewer sees coverage."""
        plain = self._write("plain.md", "# Title\n\nJust prose.\n")
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            self.assertEqual(0, codemod.main(["--verbose", str(plain)]))
        self.assertIn("plain.md", buffer.getvalue())

    def test_refuses_a_page_whose_prose_would_change(self) -> None:
        """The content-preservation guarantee is enforced at the one place that writes.

        A page whose conversion would drop or reword a sentence has to exit non-zero without
        writing, so a migration run cannot quietly ship an editorial change.
        """
        tampered = '!!! note "Title"\n\n    Body.\n'

        def lying_transform(text: str) -> str:
            return text.replace("Body.", "Body rewritten.")

        real = codemod.transform_text
        codemod.transform_text = lying_transform
        try:
            buffer = io.StringIO()
            with contextlib.redirect_stdout(buffer), contextlib.redirect_stderr(io.StringIO()):
                status = codemod.main([str(self._write("lying.md", tampered))])
        finally:
            codemod.transform_text = real
        self.assertEqual(status, 1, "a prose change must fail the run")
        self.assertEqual((self.docs / "lying.md").read_text(encoding="utf-8"), tampered)
        self.assertFalse((self.docs / "lying.mdx").exists(), "nothing may be written")

    def test_main_module_guard(self) -> None:
        """The script form the Bazel target invokes works and exits cleanly."""
        import runpy

        path = self._write("plain.md", "# Title\n\nJust prose.\n")
        original = sys.argv
        sys.argv = ["codemod_mkdocs_to_mdx.py", str(path)]
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(SystemExit) as raised:
                    runpy.run_path(str(CODEMOD_SCRIPT), run_name="__main__")
        finally:
            sys.argv = original
        self.assertEqual(raised.exception.code, 0, "the CLI must exit successfully")

class RealContentTests(unittest.TestCase):
    """The guard holds across every hand-written page in the repository."""

    def test_all_hand_written_pages_survive_the_guard(self) -> None:
        """The tool is idempotent: re-running it on the migrated tree changes nothing."""
        paths = codemod.default_targets()
        self.assertGreater(len(paths), 30, "expected to scan the hand-written docs")
        for path in paths:
            with self.subTest(file=str(path.name)):
                original = path.read_text(encoding="utf-8")
                updated = codemod.to_mdx(codemod.transform_text(original))
                self.assertEqual(
                    codemod.prose_projection(original),
                    codemod.prose_projection(updated),
                    f"{path}: codemod changed prose",
                )
                self.assertEqual(original, updated, f"{path}: re-running the codemod was not idempotent")

    def test_no_mkdocs_syntax_survives_the_transform(self) -> None:
        """Every hand-written page converts fully: no declined markers are tolerated."""
        declined = {
            str(path.relative_to(codemod.REPO_ROOT)): [
                (number, line) for number, line in codemod.pending_markers(
                    path.read_text(encoding="utf-8")
                )
            ]
            for path in codemod.default_targets()
        }
        offenders = {name: hits for name, hits in declined.items() if hits}
        self.assertEqual({}, offenders, "MkDocs markers were left unconverted")

    def test_no_mdx_hostile_prose_survives_the_transform(self) -> None:
        """Nothing compiles as MDX with an unescaped `<` or `{` sitting in prose."""
        offenders = {}
        for path in codemod.default_targets():
            result = codemod.to_mdx(codemod.transform_text(path.read_text(encoding="utf-8")))
            hits = codemod.mdx_hazards(result)
            if hits:
                offenders[str(path.relative_to(codemod.REPO_ROOT))] = hits
        self.assertEqual({}, offenders, "prose would be parsed as JSX by MDX")

    def test_plain_pages_stay_markdown(self) -> None:
        """Post-migration split: every page that needs JSX is ``.mdx``, the rest are ``.md``.

        The MDX compiler silently drops literal JSX when the file is read as ``md``, so a
        page that needs a component and keeps the ``.md`` suffix would lose its callouts,
        tabs or cards without any build error — this is the check that catches that.
        """
        needs_mdx = {
            str(path.relative_to(codemod.REPO_ROOT))
            for path in codemod.default_targets()
            if codemod.requires_mdx(path.read_text(encoding="utf-8"))
        }
        on_disk = {
            str(path.relative_to(codemod.REPO_ROOT)) for path in codemod.default_targets()
        }
        self.assertGreater(len(needs_mdx), 20, "expected the JSX pages to be detected")
        self.assertGreater(len(on_disk - needs_mdx), 5, "expected some pages to stay plain markdown")
        misplaced = [name for name in sorted(needs_mdx) if not name.endswith(".mdx")]
        self.assertEqual([], misplaced, "pages needing JSX must carry the .mdx suffix")
        surplus = [
            str(path.relative_to(codemod.REPO_ROOT))
            for path in codemod.default_targets()
            if path.suffix == ".mdx"
            and not codemod.requires_mdx(path.read_text(encoding="utf-8"))
        ]
        self.assertEqual([], surplus, "plain pages should not have been renamed for nothing")


if __name__ == "__main__":
    unittest.main(verbosity=2)
