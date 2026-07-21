---
title: Gitea CI Integration Plans
description: Adapting the lab's Bazel CI (parallel jobs, caches, lint, safety) to Gitea/Forgejo Actions with rollout tips and parity policy.
tags: [ci, gitea, forgejo, bazel, github-actions]
---

# Gitea CI Integration Plans

**What's on this page**

- Gitea/Forgejo Actions setup and compatibility overview
- How this repo mirrors GitHub CI (`.gitea/workflows/ci.yml`)
- Intentional non-parity (docs deploy, Dependabot)
- Differences from GitHub (runners, caching, secrets)
- Caching & parallelism tips for self-hosted runners

**What this enables**

- Running the same fast, hermetic Bazel-centric CI (core, dashboard, docs, safety) on self-hosted Gitea/Forgejo
- Massive speedups via persistent Bazel caches and `actions/cache` on private instances
- Maintaining CI feature parity and best practices outside GitHub

Gitea (and Forgejo) support **Actions** (compatible with GitHub Actions syntax via runners like `act` or native).

## Setup

1. Enable Actions in your Gitea instance (admin settings or per repo).
2. Use a runner (e.g. `gitea-act-runner` or self-hosted GitHub runner compatible).
3. Place workflow files in `.gitea/workflows/` (or `.forgejo/workflows/`).

## Shipped workflow (source of truth)

This repo ships **`.gitea/workflows/ci.yml`** as a mirror of **`.github/workflows/ci.yml`**.

Do **not** replace it with a minimal single-job workflow. The mirror includes:

| Job | Role |
| --- | --- |
| `changes` | `dorny/paths-filter` path groups |
| `bazel-core` | `//:test-fast` + `//:lint` + key builds |
| `dashboard-unit` | Host Vitest / lint / typecheck via `//dashboard:fast-test` |
| `dashboard-hermetic` | Dockerized production build + Playwright |
| `docs-and-render` | Single MkDocs build + visual regression (`//docs:test_mkdocs_render`) |
| `validate-gate` | Path-filter consistency via `scripts/ci_check_only.sh` |

Shared composite setup lives under **`.github/actions/setup-bazel`** (Gitea references it; do not fork under `.gitea/`).

### Parity policy

When bumping marketplace action majors or changing job graph / path filters / Bazel commands in `.github/workflows/ci.yml`, update `.gitea/workflows/ci.yml` in the **same PR**.

Enforced by `tests/bats/tooling.bats` (`//tests:bats_tooling_test`):

- Same job ids and path-filter keys
- Same critical commands (`//:test-fast`, hermetic modes, docs render, gate script)
- Same marketplace action **major** pins (`actions/checkout@vN`, etc.)

Allowed Gitea-only delta: a short header comment that the file is a Forgejo/Gitea mirror.

### Intentional non-parity

| GitHub-only | Why not mirrored |
| --- | --- |
| `.github/workflows/deploy-docs.yml` | mike → GitHub Pages (`gh-pages`). Needs a chosen Gitea Pages / static host + secrets before a Gitea equivalent exists. |
| `.github/dependabot.yml` | Dependabot is a GitHub product; use Renovate or manual bumps on Gitea. |

Docker Buildx still uses `cache-from/to: type=gha` for structural parity with GitHub. On pure `gitea-act-runner` hosts the GHA cache backend may no-op; prefer a persistent local Docker layer cache or registry cache on the runner if rebuilds stay cold.

## Differences from GitHub

- Runner labels may differ (configure in Gitea).
- Secrets and variables are configured in Gitea UI (use the same logical names where applicable).
- For self-hosted, ensure docker or the execution environment has the tools Bazel and hermetic dashboard tests need.
- Caching: mount persistent volumes for Bazel disk/repo caches; use `actions/cache` for npm/pip/Playwright when supported.
- Docs **publish** stays on GitHub Pages unless you add a separate Gitea deploy workflow.

## Recommended Rollout for Gitea (Ultra Optimized)

- Use the shipped `.gitea/workflows/ci.yml` (do not regress to a single job).
- Self-hosted runners (`gitea-act-runner` or compatible): mount persistent volume for `~/.cache/bazel-disk` and `~/.cache/bazel-repo` (and node_modules) for large cache hits across builds (key on `MODULE.bazel.lock` / `.bazelversion`).
- Use `actions/cache` for the same keys as GitHub where the runner supports it.
- Runner labels: configure in Gitea admin (e.g. `self-hosted`, `linux`); use in `runs-on`.
- Keep `.bazelrc` `--config=ci` for CI-oriented flags; raise resources on beefy self-hosted hardware as needed.

See also `.github/workflows/ci.yml` and `.bazelrc` for cache/parallel flags.

## Caching & Parallelism Tips for Gitea

- Bazel: restore disk + repo cache in job steps (see `.bazelrc` and `setup-bazel`).
- Non-hermetic: separate npm cache (`setup-node`), Python (`setup-python` cache).
- Parallel: jobs run concurrently; self-hosted can run multiple in parallel (configure runner capacity).
- For visuals/goldens: pre-install Playwright browsers in the runner image or cache `~/.cache/ms-playwright`.
- Docs **build** in CI: `bazelisk test //docs:test_mkdocs_render --config=ci` (same as GitHub). Publish remains GitHub-only today.
