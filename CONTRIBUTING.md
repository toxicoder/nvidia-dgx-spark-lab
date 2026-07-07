# Contributing to nvidia-dgx-spark-lab

Thank you for helping improve the lab. This file is a short hub; detailed conventions live in the docs site.

## Quick start

1. Read [docs/getting-started.md](docs/getting-started.md) for cluster setup and day-to-day operations.
2. Read [docs/project-conventions.md](docs/project-conventions.md) for naming, patterns, formatting, safety, and testing across all stacks.
3. Use the [devcontainer](.devcontainer/) for consistent tooling (bazelisk, shellcheck, Node.js 22, etc.).

## Before you open a PR

```bash
bazelisk run //:fix                         # formatters + auto-fix linters
bazelisk run //:validate                    # git-aware: core + docs/dashboard slices
bazelisk run //:validate -- --all           # full suite before merge
```

CI runs path-filtered jobs with the same Bazel targets. See [docs/BUILDING_WITH_BAZEL.md](docs/BUILDING_WITH_BAZEL.md).

## Where conventions live

| Topic | Document |
| --- | --- |
| **All stacks (canonical)** | [docs/project-conventions.md](docs/project-conventions.md) |
| MkDocs prose and page formatting | [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) |
| Shell scripts and utilities | [scripts/README.md](scripts/README.md) |
| Testing philosophy and targets | [tests/README.md](tests/README.md) |
| Dashboard (Next.js) specifics | [dashboard/AGENTS.md](dashboard/AGENTS.md) |
| AI coding agents | [AGENTS.md](AGENTS.md) |

## Change discipline (summary)

A change is not complete until:

1. Tests are written or updated (failing first for behavior changes).
2. Structured comments (`# @command`, JSDoc) reflect new public APIs.
3. `BUILD.bazel` targets and visibility are updated when needed.
4. Affected READMEs and docs pages are updated.
5. `bazelisk run //:fix` and `bazelisk run //:validate` pass.
6. Safety impact is called out for workload, manifest, or resource changes.

Full checklist: [docs/project-conventions.md § Change discipline](docs/project-conventions.md#13-change-discipline-and-pr-checklist).

## Documentation changes

Hand-written docs use MkDocs Material. Follow [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for frontmatter, page structure, and generated reference workflow.

```bash
bazelisk run //docs:serve     # live preview
bazelisk run //docs:docs       # strict production build
```

Shell command reference is **generated** from structured comments in `scripts/` — do not edit `docs/generated/shell/reference.md` by hand.

## Safety

This lab runs large GPU inference workloads. Never:

- Set `restartPolicy: Always` on heavy inference Jobs
- Remove `resources.requests` / `resources.limits` from workloads
- Bypass `manage.sh` confirmation prompts or Resource Guard gates in production paths
- Auto-start heavy containers on reboot

Enforced invariants: [tests/safety_invariants.sh](tests/safety_invariants.sh). See [docs/reboot-safety.md](docs/reboot-safety.md) and [docs/resource-guard.md](docs/resource-guard.md).

## Questions?

Open an issue or discuss in the PR. All changes — code, manifests, scripts, and docs — are reviewed with the same care.