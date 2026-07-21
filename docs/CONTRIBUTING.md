---
title: Contributing to the Documentation
description: Guidelines for hand-written docs, structured shell comments, rich formatting rules, and the PR checklist for the MkDocs site.
tags: [documentation, contributing, mkdocs, bazel]
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
bazel run //docs:serve                    # Live preview (auto-opens browser)
bazel run //docs:serve -- --port 8080 --no-browser
# Make edits...
bazel run //docs:docs                     # Strict production build
bazel run //docs:preview                  # Strict build + static serve (final check)
```

Classic scripts (the `manage-docs.sh` wrapper auto-provisions the venv):

```bash
./docs/manage-docs.sh serve
./docs/manage-docs.sh build --strict
./docs/manage-docs.sh preview
```

See `bazel run //docs:status` or the `--help` output for all options.

## Information Architecture

We follow this mental model:

- **Home / Getting Started** — New users
- **Concepts & Notes** — Background and important constraints (safety, resources, reboot)
- **How-to Guides** — Task-oriented (Bazel docs, Gitea setup, etc.)
- **Reference** — Deeper or cross-cutting material

Every major section should have a good `index.md`.

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
- Write for humans. Be concise. Remove filler.
- Include copy-pasteable examples.
- Use Mermaid for diagrams (supported).
- Prefer admonitions (`!!! note`, `!!! warning`) and tabs for alternatives.
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

See the extensive "Documentation from Code" section in [getting-started.md](getting-started.md) for examples, a Mermaid diagram of the pipeline, and troubleshooting tips.

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

- [ ] `./docs/manage-docs.sh build --strict` passes with zero warnings.
- [ ] All links work (the build checks them in strict mode).
- [ ] Navigation (tabs, sections, breadcrumbs) feels logical.
- [ ] New or changed behavior is documented.
- [ ] Frontmatter present and accurate.
- [ ] Spell-checked (run codespell or manual review).

## Editing This Site

Click **Edit this page** on the live site. Hooks stamp `edit_uri` from the published alias (`main` for **latest**, `development` for **development**), so the link opens the matching long-lived branch. In-page GitHub `blob`/`tree` source links are rewritten the same way at build time (see `docs/hooks.py`).

## Questions?

Open an issue or discuss in the relevant PR. Documentation changes are reviewed with the same care as the rest of the Bazel-based project.
