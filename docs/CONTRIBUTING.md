---
title: Contributing to the Documentation
description: Guidelines for hand-written docs, structured shell comments, rich formatting rules, and the PR checklist for the documentation site.
tags: [documentation, contributing, fumadocs, nextjs, bazel]
---

# Contributing to the Documentation

**What's on this page**

- Guidelines for contributing docs, code comments, and generated content
- Rich formatting requirements
- Process for shell reference, visuals, etc.

**What this enables**

- Keeping docs as code (never stale)
- Consistent experience across the site and generated refs

For code, shell, Kubernetes, Ansible, config, and dashboard conventions, see [project-conventions.md](project-conventions.md). The repo-root [CONTRIBUTING.md](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/CONTRIBUTING.md) is the short contribution hub.

Thank you for helping improve the documentation for nvidia-dgx-spark-lab!

All changes to documentation must follow the same rigor as code changes.

## Quick Start

Bazel (primary):

```bash
bazelisk run //docs:serve                     # Dev server with hot reload (opens a browser)
bazelisk run //docs:serve -- --port 3007 --no-browser
# Make edits...
bazelisk run //docs:docs                      # Static export into docs-site/out/
bazelisk run //docs:preview                   # Export + serve it (final check)
bazelisk run //docs-site:unit                 # Widget + content-transform unit suite
bazelisk run //docs-site:typecheck            # next typegen + tsc
```

Classic scripts (the `manage-docs.sh` wrapper installs npm dependencies when missing):

```bash
./docs/manage-docs.sh serve
./docs/manage-docs.sh build
./docs/manage-docs.sh preview
```

Inside `docs-site/` the same things are npm scripts: `npm run dev`, `npm run build`,
`npm run visual`, `npm run nav:check`.  Screenshot baselines are refreshed with
`bazelisk run //docs-site:visual-linux -- --update` (needs Docker), which renders them in the
Linux image that matches the docs CI job — never on a laptop.  See `bazelisk run //docs:status`
or the `--help` output for all options.

## Information Architecture

Sidebar groups live in `docs-site/lib/nav.json`, transcribed once from the former
`mkdocs.yml` nav.  That file is gone, so `nav.json` is the source of truth: edit it by hand
and verify with `npm run nav:check` (which fails if an entry has no page on disk).  The
groups are:

- **Home** — path cards, default stack, safety table
- **Start** — gold path, topology, profiles, learn-the-lab
- **Concepts** — architecture, NCCL, Resource Guard, stacks, glossary
- **Operate** — catalogs, dashboard, runbooks, troubleshooting
- **Reference** — project conventions, docs contributing, generated shell + dashboard API
- **Contribute** — dev environment, Bazel

Every major section has an `index.md`. Keep existing published slugs (`getting-started`,
`architecture`, …): the route is the file path without its extension, so renaming a file
breaks every bookmark and README link to it. Put **new** pages under `start/`, `learn/`,
`concepts/`, `operate/`, `contribute/`.

A new page needs three things or it will not appear in the sidebar and the coverage gate
fails: the file under `docs/`, an entry in the nav (see above), and a listing in
`_HAND_WRITTEN_MD` in `docs/BUILD.bazel` so Bazel ships it as a runfile.

Use the right-hand ToC for long pages. Keep navigation focused.

## Frontmatter (Required on every page)

```yaml
---
title: Clear Descriptive Title
description: One-sentence summary. Used for search and previews.
tags: [bazel, k3s, nvidia, safety]
---
```

## Content Guidelines

- Every page must open (after the title or any intentional top widget such as the interactive panel) with a scannable overview in this bullet-point format:
  **What's on this page**
  - Bullets describing the main content, sections, diagrams, tables, etc.
  **What this enables / practical use**
  - Bullets describing reader benefit, common use cases, or what the content lets you achieve.
  Write those labels as bold markdown plus lists, not as JSX. The site wraps the first pair into a two-column panel; later examples on the same page stay ordinary prose.
- Write for humans. Be concise. Remove filler.
- Include copy-pasteable examples.
- Use Mermaid for diagrams (supported).
- Prefer `<Callout type="info|warning|error" title="…">` for asides and `<Tabs>`/`<Tab>` for
  alternatives. The `!!!` and `=== "Title"` syntax is **not** parsed any more — the migration
  rewrote existing uses, and new content uses the components directly (see
  `docs-site/components/mdx-components.tsx` for what is importable).
- Pages that need those components are `.mdx`; pages that do not can stay `.md`. Both are
  valid MDX, so plain Markdown keeps working unchanged.
- Escape what MDX would otherwise read as JSX: a literal `<` in prose or code needs `&lt;`,
  and `{`/`}` outside a code fence must be `&#123;`/`&#125;`.
- Always link to source code or exact commands when possible.
- **Human review required**: All AI-assisted drafts must be reviewed and edited by a human before merging.

### Code-Generated Command Reference (Shell)

The [Shell Commands & Helpers](generated/shell/reference.md) page is **not** written by hand. It is produced from structured comments inside the scripts.

**Markers you must use** (these are what the generator looks for):

```bash
# ## Section or Topic Title
# Multi-line description.
# Talk about what it does, safety properties, when to use it.
#
# Usage:
#   ./scripts/manage.sh foo --bar
#
# Safety:
#   Always run stop before reboot.
#   This does a confirmation prompt for heavy models.

# @command doctor
# Short or long description of the `doctor` / `estimate` / `start-xxx` command.
# Include usage and examples. The generator turns "Usage:" and shell-looking
# lines into nice code fences and Safety blocks into admonitions.
```

**Full workflow**

1. Edit `scripts/manage.sh` or `scripts/lib/*.sh`.
2. Add or improve a `# ##` / `# @command` block with rich, accurate docs (over-document — the user asked for this).
3. `bazelisk run //docs:docs` (or serve).
4. Check `docs/generated/shell/reference.md` and the rendered site page.
5. Use the live variables panel on getting-started to verify `{{PLACEHOLDER}}` still works in the new content.
6. Commit the *source* script (the generated file is derived).

See the Mermaid pipeline in [BUILDING_WITH_BAZEL.md](BUILDING_WITH_BAZEL.md#documentation-generation--efficiency) for how comments become the published reference.

The generator lives in `docs/generate_shell_docs.py`. It is intentionally kept simple (stdlib only) but is being improved for even nicer output formatting.

**Dashboard API docs** are generated the same way via TypeDoc — see `dashboard/typedoc.json` and `bazel run //dashboard:docs`.

Always keep the generated reference and the prose docs about it in sync with reality. Prefer over-documenting.

## Style & Formatting

- Headings: Start with `##` inside pages (title comes from frontmatter).
- Code: Use language hints. Enable copy buttons (enabled globally).
- Links: Prefer relative within docs/. For root files use full GitHub URLs or add them under `docs/`.
- "Last updated" is shown automatically when the git plugin is active.

## Pre-commit Hooks (Optional)

For fast local checks before commit, install [pre-commit](https://pre-commit.com/) and enable the repo hooks (buildifier, shfmt, shellcheck — same trusted tools as Bazel lint/`//:fix`):

```bash
pip install --user pre-commit
pre-commit install
pre-commit run --all-files   # optional dry run
```

The devcontainer image already includes these CLIs; on the host, install them or use the devcontainer.

## Before Submitting a PR

- [ ] `bazelisk run //:validate` is green (it runs the docs gates when `docs/**` or
      `docs-site/**` changed; add `-- --all` before a merge that touches the site).
- [ ] `bazelisk run //docs:docs` builds the export with no errors and no broken links.
- [ ] `bazelisk run //docs-site:visual` passes, or the golden diff is intentional and was
      refreshed with `bazelisk run //docs-site:visual-linux -- --update` (never on a laptop —
      see `MIGRATION.md` in the repo root).
- [ ] Navigation (sidebar groups, ToC, breadcrumbs) feels logical.
- [ ] New or changed behavior is documented.
- [ ] Frontmatter present and accurate.
- [ ] Spell-checked (run codespell or manual review).

## Editing This Site

Click **Edit this page** on the live site. The link is stamped from the published alias
(`main` for **latest**, `development` for **development**), so it opens the matching long-lived
branch rather than a stale default. The same ref drives in-page GitHub `blob`/`tree` source
links; override it locally with `DGX_DOCS_GIT_REF=development` (or `main`) when you need to
check where a link lands.

## Questions?

Open an issue or discuss in the relevant PR. Documentation changes are reviewed with the same care as the rest of the Bazel-based project.
