---
title: Gitea CI Integration Plans
description: Adapting the lab's Bazel CI (parallel jobs, caches, lint, safety) to Gitea/Forgejo Actions with example workflow and rollout tips.
tags: [ci, gitea, forgejo, bazel, github-actions]
---

# Gitea CI Integration Plans

**What's on this page**

- Gitea/Forgejo Actions setup and compatibility overview
- Full example workflow YAML for Bazel test + lint + build
- Differences from GitHub (runners, caching, secrets)
- Recommended ultra-optimized rollout mirroring GitHub CI parallel structure
- Caching & parallelism tips (Bazel disk/repo, npm, Playwright, docs deploy)

**What this enables**

- Running the same fast, hermetic Bazel-centric CI (core, dashboard, docs, safety) on self-hosted Gitea/Forgejo
- Massive speedups via persistent Bazel caches and actions/cache on private instances
- Maintaining CI feature parity and best practices outside GitHub

Gitea (and Forgejo) support **Actions** (compatible with GitHub Actions syntax via runners like `act` or native).

## Setup

1. Enable Actions in your Gitea instance (admin settings or per repo).
2. Use a runner (e.g. `gitea-act-runner` or self-hosted GitHub runner compatible).
3. Place workflow files in `.gitea/workflows/` (or `.forgejo/workflows/`).

This repo ships `.gitea/workflows/ci.yml` as a mirror of the optimized GitHub CI (path filters, `//:test-fast`, cached dashboard Docker, docs render job).

## Example Workflow (copy to .gitea/workflows/ci.yml)

```yaml
name: Gitea - Bazel + Lint

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  bazel-test:
    runs-on: ubuntu-latest   # or your runner label
    steps:
      - uses: actions/checkout@v4

      - name: Install Bazelisk
        run: |
          curl -L https://github.com/bazelbuild/bazelisk/releases/latest/download/bazelisk-linux-amd64 -o /tmp/bazelisk
          sudo install /tmp/bazelisk /usr/local/bin/bazelisk

      - name: Install lint tools
        run: |
          sudo apt-get update -qq
          sudo apt-get install -y -qq shellcheck yamllint
          pip install ansible-lint
          curl -sL https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz | tar xz
          sudo mv kubeconform /usr/local/bin/

      - name: Bazel test + lint
        run: |
          bazelisk test //:test-fast //:lint --config=ci --test_tag_filters=manual

      - name: Bazel build
        run: |
          bazelisk build //:manage //:all --config=ci
```

## Differences from GitHub

- Runner labels may differ (configure in Gitea).
- Secrets and variables are configured in Gitea UI (same names).
- For self-hosted, ensure docker or the execution environment has the tools.
- Caching: Use the same disk_cache in .bazelrc or Gitea cache actions if available.
- No official "setup-bazelisk" but the curl method works.

## Recommended Rollout for Gitea (Ultra Optimized)

- Use `.gitea/workflows/ci.yml` (mirrors `.github/workflows/ci.yml`: path-filtered bazel-core, dashboard, docs-and-render).
- Self-hosted runners (gitea-act-runner or compatible): mount persistent volume for `~/.cache/bazel-disk` and `~/.cache/bazel-repo` (and node_modules) for massive cache hits across builds (5-10x+ on incremental per research; key on MODULE.bazel.lock etc.).
- Use `actions/cache` (supported) in workflows for the same keys as GitHub.
- Runner labels: configure in Gitea admin (e.g. `self-hosted`, `linux`); use in `runs-on`.
- Update .bazelrc --config=ci usage for higher resources on beefy self-hosted.
- Keep Makefile as fallback for local dev without Bazel.

See also the GitHub CI in `.github/workflows/ci.yml` (now split for parallelism) and .bazelrc for cache/parallel flags.

## Caching & Parallelism Tips for Gitea

- Bazel: restore disk + repo cache in job steps (see .bazelrc comments).
- Non-hermetic: separate npm cache (setup-node), Python (setup-python cache).
- Parallel: jobs run concurrently; self-hosted can run multiple in parallel (configure runner).
- For visuals/goldens: pre-install Playwright browsers in runner image or cache.
- Deploy docs: prefer `bazelisk run //docs:docs` for consistency (update workflow if possible).
