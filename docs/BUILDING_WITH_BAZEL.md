---
title: Building and Testing with Bazel
description: Bazel-first build, test, lint, and documentation workflow for the DGX Spark lab — targets, validation discipline, and dev container setup.
tags: [bazel, testing, documentation, devcontainer]
---

# Building and Testing with Bazel

**What's on this page**

- Why Bazel is the primary build/test/launcher system for the lab
- List of what Bazel is used for (tests, lint, docs, wrappers)
- Prerequisites and installation
- Common commands and specific targets
- Documentation generation details
- Validation discipline and CI setup
- How to use Bazel day-to-day and inside the dev container

**What this enables**

- Reproducible, hermetic builds and tests even on different developer machines
- Single command entry points (e.g. `bazelisk run //docs:docs`, `bazelisk run //:manage -- doctor`)
- Easy onboarding via the `.devcontainer`
- Confidence that changes don't break the automation or docs pipeline

The traditional Makefile and direct `ansible-playbook` / `./scripts/manage.sh` invocations remain available for compatibility and for people who have not installed bazelisk.

## Prerequisites

- Bazelisk (strongly recommended)
- Or a recent Bazel 8.x+

```bash
# macOS
brew install bazelisk

# Linux (example)
# amd64:
curl -L https://github.com/bazelbuild/bazelisk/releases/latest/download/bazelisk-linux-amd64 -o /usr/local/bin/bazelisk
# arm64 (Apple Silicon):
# curl -L https://github.com/bazelbuild/bazelisk/releases/latest/download/bazelisk-linux-arm64 -o /usr/local/bin/bazelisk
chmod +x /usr/local/bin/bazelisk
```

The `.bazelversion` pins the version.

## Common Commands

```bash
# Primary day-to-day commands
bazelisk run //:validate           # git-aware: core + docs/dashboard when paths change
bazelisk run //:validate -- --all # full suite (docs Playwright + dashboard Docker)
bazelisk test //:test              # Bazel test_suite (test-fast + docs render)
bazelisk test //:test-fast         # CI core (excludes slow docs Playwright)
bazelisk test //:lint --test_tag_filters=manual
bazelisk run //:manage -- status
bazelisk run //docs:serve
bazelisk run //ansible:bootstrap

# Specific targets
bazelisk run //docs:docs          # strict production build of the docs site
bazelisk run //dashboard:dev
bazelisk run //ansible:verify -- -i inventory/hosts.ini

# Build / test everything declared
bazelisk test //...
bazelisk build //...

# Queries (very useful)
bazelisk query 'kind(".*_test", //...)'
bazelisk query 'deps(//tests:bats_manage_test)'
```

## Documentation Generation & Efficiency

Documentation for commands, helpers, and internal APIs is generated from source so it **never goes stale**.

### Shell Commands & Helpers (the main auto-generated reference)

`docs/generate_shell_docs.py` is a tiny stdlib-only extractor that turns specially formatted comments in the shell scripts into a beautiful, human-readable reference page.

Markers (documented extensively in getting-started.md and CONTRIBUTING.md):

- `# ## Title` + rich body
- `# @command name` + description + Usage + Safety + Examples (with `{{PLACEHOLDER}}`)
- `# ### Subsection`

The generator now produces:

- Proper fenced code blocks using the `bash` language
- `!!! warning` / `!!! note` admonitions
- Clean separation between intentional docs and implementation comments
- Source attribution

It is deliberately strict about what it includes so the output is pleasant to read.

Run it with:
```bash
bazelisk run //docs:docs
```

The output is at `docs/generated/shell/reference.md` and appears in the site under **Reference > Code-Generated Reference**.

Because `//docs:docs` and `//docs:serve` list the script sources as data dependencies (via `//scripts:doc_sources`), Bazel only re-runs generation when comments actually change.

### Dashboard API reference

Produced by TypeDoc from JSDoc in the Next.js/TypeScript code:

```bash
bazel run //dashboard:docs     # after npm ci in dashboard/
```

See `dashboard/typedoc.json` and the package.json `docs:generate` script.

### Visual regression tests for the rendered docs site (goldens + approval)

Docs render tests are split for speed:

- `//docs:test_mkdocs_build` — mkdocs strict build + HTML/source checks (local fail-fast; **not** in `//:test-fast` — needs MkDocs installed)
- `//docs:test_mkdocs_visual` — Playwright screenshots vs goldens only
- `//docs:test_mkdocs_render` — combined (one MkDocs build + visual); **CI docs job** and `bazel test //:test`

CI runs build + visual as separate steps in **docs-and-render**; `//:test-fast` covers the fast build path without Playwright.

- mkdocs build --strict (to temp)
- Start an in-process static HTTP server over the output (CSS/JS assets served)
- Playwright (chromium, headless) loads many key pages (index + getting-started + architecture + models-catalog + troubleshooting + reboot-safety + dgx-spark-notes + monitoring-observability + dev-workspaces + gitea-ci-setup, ...)
- Fixed viewport + strong waits: domcontentloaded + networkidle + Material CSS elements (`.md-header`, `.md-content`) + custom command-vars / cluster panel + Mermaid SVG + fonts.ready + settle. CSS is always applied in the captured image; JS is waited for where it affects rendering (Mermaid, panels).
- `page.screenshot(full_page=True, animations="disabled")` compared byte-for-byte to committed goldens in `docs/tests/visual/goldens/`.
- Actual/current screenshots are **always generated** (written to test outputs/actuals dir) whenever the test runs.

This ensures that **rendering the dgx spark lab site (with CSS + JS) and taking screenshots (goldens + actuals) is part of the main test suite**.

- Any change to Markdown, templates, JS, CSS, or generated content that affects the final pixels will cause the test to fail with a message guiding approval.
- To accept an intentional change (e.g. new section, style tweak, new generated reference text):
  ```bash
  UPDATE_SNAPSHOTS=1 bazel run //docs:visual-update
  ```
  This reruns the build + browser captures and writes the new .png baselines into your source tree.
- Commit the updated goldens and open a PR. The visual diff is part of review (humans must approve pixel changes just like code).

The test gracefully skips the browser portion if playwright or browsers are missing (source + HTML checks still run). Full enforcement requires the browsers (installed automatically by the test runner on first use, or via `python -m playwright install chromium`).

See also the top of `docs/test_mkdocs_render.py` and `test_mkdocs_render.sh`.

### Why this design?

- Comments that describe behavior live right next to the code that implements it.
- One change in a script comment → reference, examples on the site, and live panel examples all update together.
- Over-documenting in the scripts is explicitly encouraged (see user request and AGENTS guidance).

See the very long "Documentation from Code (Auto-Generated & Always Up-to-Date)" section in getting-started.md for the full picture, Mermaid diagram, and contribution instructions.

The previous short paragraph has been replaced by this more complete description.

## Validation Discipline (used during development)

After any change, use the unified orchestrator:

```bash
bazelisk run //:validate                    # default: git-aware slices
bazelisk run //:validate -- --all           # full suite before merge
bazelisk run //:validate -- --update-goldens  # regenerate visual baselines (review + commit)
bazelisk run //:fix                         # formatters + auto-fix linters (trusted tools)
```

`//:validate` always runs core checks (`build //... --nobuild`, `//:test-fast`, `//:lint`, key builds). When docs-relevant paths change (`docs/**`, shell doc sources under `scripts/manage.sh` / `lib` / `utilities`) it also runs `//docs:docs` + `//docs:test_mkdocs_build` (fast). Use `--all` for `//docs:test_mkdocs_render` (visual) and `//dashboard:hermetic-test` (Docker + Playwright). Default dashboard slice uses `//dashboard:fast-test` (host Vitest + lint + typecheck).

`//:fix` uses only well-trusted software (buildifier, shfmt, ruff, prettier) and is the recommended one-command way to programmatically clean the tree.

CI uses path-filtered parallel jobs (optimized for wall time):

| Job | When | What |
| --- | --- | --- |
| **bazel-core** | scripts/k8s/… or CI graph/workflow | `//:test-fast` + `//:lint` + key builds |
| **dashboard-unit** | dashboard/** or CI graph | Host Vitest + lint + tsc |
| **dashboard-hermetic** | after unit success | Docker build + Playwright (`DASHBOARD_TEST_MODE=visual` skips re-Vitest) |
| **docs-and-render** | docs/**, shell doc sources, or CI graph | **Single** `//docs:test_mkdocs_render` (one MkDocs build) |
| **validate-gate** | always | Pure bash `scripts/ci_check_only.sh` (no Bazel cold start) |

**Path filter notes:** `scripts/**` no longer always runs docs — only `scripts/manage.sh`, `scripts/lib/**`, and `scripts/utilities/**` (shell doc sources). Editing only `.github/workflows/*` runs bazel-core (and gate), not hermetic/docs. Shared setup: `.github/actions/setup-bazel` (pinned Bazelisk + disk/repo + lint-tool caches). See `.github/workflows/ci.yml`, `.gitea/workflows/ci.yml`, and `.bazelrc` (`--config=ci`).

Use queries heavily:

```bash
bazelisk query 'deps(//tests:bats_manage_test)'
bazelisk query 'kind(".*_test", //...)'
bazelisk query 'rdeps(//scripts:manage, //k8s/...)'
```

## CI

See `.github/workflows/ci.yml` (path-filtered jobs + `validate-gate`). **bazel-core** is authoritative for hermetic core tests; docs Playwright runs only in **docs-and-render** (not duplicated in bazel-core).

Use `--config=ci` on CI runners (higher `--jobs`, `--remote_download_minimal`).

The classic make-based paths remain for compatibility/legacy.

For Gitea: see [gitea-ci-setup.md](gitea-ci-setup.md) and `.gitea/workflows/ci.yml` (self-hosted runners + persistent cache volumes recommended).

Bazel jobs restore disk/repo cache via `.github/actions/setup-bazel` (keyed on `MODULE.bazel.lock` + `.bazelversion`).

## Security Notes

- Never commit real `ansible/inventory/hosts.ini` (it is gitignored).
- Kubeconfig, tokens, and SSH material are excluded.
- The BATS tests mock external commands (including kubectl) so they never touch real clusters or credentials.
- Bazel runfiles + explicit data dependencies make exactly what is needed visible (no accidental leakage of host files).
- `MODULE.bazel.lock` is committed (standard for reproducible Bzlmod) and contains only public registry metadata.

See the root `.gitignore` and `.bazelignore` for the full exclusion list.

## Current Bazel Coverage

The following are modeled with first-class Bazel targets:

- `scripts/manage.sh` as `sh_binary` (`//:manage`)
- Full hermetic BATS suite (vendored bats-core)
- Kubernetes manifests and overlays as `filegroup` data
- Documentation site (`//docs:serve`, `//docs:docs`, etc.)
  - Includes `test_generate_shell_docs` + `test_mkdocs_render` (full build + HTML/mermaid/asset validation + **real browser screenshots + goldens** of the rendered site; visual diffs fail the test and require explicit approval via `UPDATE_SNAPSHOTS=1 bazel run //docs:visual-update` + PR review).
- Ansible validation + convenient playbook launchers (`//ansible:*`)
- Dashboard dev / build / test wrappers (`//dashboard:*`)
- Comprehensive root aliases and test suites

Runtime operations against real hardware (full Ansible playbooks with real inventories, heavy cluster workloads) intentionally remain outside pure Bazel "build" semantics and are launched via the sh_binary wrappers or classic commands.

## Using Bazel for Daily Work

Bazel is now the established primary system. The Makefile and direct commands remain available purely for compatibility and convenience.

## Development Container

First-class multi-arch contributor environment (`.devcontainer/`): **linux/amd64 + linux/arm64**.

| Host | Notes |
| --- | --- |
| macOS Apple Silicon / Intel | Docker Desktop |
| Windows x86_64 | Docker Desktop + WSL2 |
| Linux amd64/arm64 | Docker Engine / Podman |
| NVIDIA DGX Spark (Grace arm64) | Docker/Podman on-box |

Pinned tools (see `.devcontainer/tool-versions.env`, shared with CI): bazelisk, buildifier, shfmt, shellcheck, kubeconform, kubectl, helm, ansible, ruff, mypy, Node **22**, Python **3.11**, prettier, bats, kcov.

Full onboarding: **[dev-environment.md](dev-environment.md)**.

### Using the Dev Container

1. Open the repo in VS Code or Cursor (Docker running).
2. Command Palette → **Dev Containers: Reopen in Container**.
3. After `post-create` + doctor:

```bash
bash .devcontainer/doctor.sh
bazelisk run //:fix
bazelisk run //:validate
bazelisk test //:test-fast --config=ci
bazelisk test //:lint --test_tag_filters=manual
```

Docker for hermetic dashboard tests uses **docker-outside-of-docker** (host engine). Create does **not** gate on the full suite; use `//:validate` before PRs.

### Code-Driven Documentation

Reference material for commands, helpers, and dashboard internals is generated from source comments (`docs/generate_shell_docs.py` + TypeDoc in `dashboard/`).

After changing comments in `scripts/` or JSDoc in `dashboard/`:

```bash
bazelisk run //docs:docs
```

Generated content lands in `docs/generated/` and is part of the MkDocs site (Reference).

See `AGENTS.md` for AI coding assistant workflow.
