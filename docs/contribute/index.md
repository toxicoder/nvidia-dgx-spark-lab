---
title: Contribute
description: Contributor path — devcontainer, Bazel, docs-as-code, and conventions for nvidia-dgx-spark-lab.
tags: [contributing, bazel, documentation]
---

# Contribute

**What's on this page**

- How to open a working environment
- Which Bazel targets to run
- Where prose rules and generated docs live

**What this enables**

- Changing this repo without weakening safety gates
- Keeping the docs site, shell reference, and dashboard API in sync with source

## Setup

1. Open [`.devcontainer/`](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/.devcontainer/) (linux/amd64 + linux/arm64). Guide: [Developer environment](../dev-environment.md).
2. `bazelisk run //:doctor`
3. `bazelisk run //:fix` then `bazelisk run //:validate`

Branch from the tip of `main`, the only long-lived branch. PR into `main`. Conventional commits. Never force-push trunk. Unfinished work ships behind a flag in `config/flags.yaml`, off by default. Full model: [Branching](../branching.md) and [CONTRIBUTING.md](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/CONTRIBUTING.md).

## Daily targets

```bash
bazelisk run //:validate
bazelisk run //:fix
bazelisk run //docs:docs
bazelisk run //docs:serve
bazelisk run //docs:preview
```

Makefile is a shim. Prefer Bazel.

## Docs contract

Prose rules: [Contributing to docs](../CONTRIBUTING.md). Shared patterns: [Project conventions](../project-conventions.md). Agent workflow: [AGENTS.md](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/AGENTS.md).

- Frontmatter `title` / `description` / `tags`
- **What's on this page** and **What this enables** (bold markdown plus lists; the site renders the first pair as a two-column panel)
- New pages in **both** `docs-site/lib/nav.json` (hand-edited, then `bazelisk test //docs-site:nav_test`) and `docs/BUILD.bazel`
- Shell: `# ##` / `# @command` / `# @function` then `bazelisk run //docs:docs`
- Dashboard JSDoc then `bazelisk run //dashboard:docs`
- Do not hand-edit `docs/generated/**`

Building with Bazel (targets, CI, hermetic dashboard): [BUILDING_WITH_BAZEL.md](../BUILDING_WITH_BAZEL.md).
