# Contributing to nvidia-dgx-spark-lab

Thank you for helping improve the lab. This file is a short hub; detailed conventions live in the docs site.

## Quick start

1. **Set up the contributor environment** (multi-arch: Apple Silicon, Windows x86, Linux, DGX Spark Grace):
   - Preferred: open the [devcontainer](.devcontainer/) — see [docs/dev-environment.md](docs/dev-environment.md).
   - Then: `bash .devcontainer/doctor.sh` → `bazelisk run //:fix` → `bazelisk run //:validate`.
2. Read [docs/project-conventions.md](docs/project-conventions.md) for naming, patterns, formatting, safety, and testing across all stacks.
3. For **cluster / DGX hardware** ops (not required to edit code), see [docs/getting-started.md](docs/getting-started.md).

## Branching model

- **Primary integration branch:** `development` (protected; changes only via pull request).
- Create feature/work branches **from `development`** and open PRs **back into `development`**.
- **Promotion path:** feature → `development` → (optional) `dev` → `main` (always via PR).
- **Never force-push** `development` or `main`.
- Prefer merge commits when integrating long-lived branches so history stays intact.

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
- Co-schedule multiple visual ComfyUI Deployments (or visual + heavy LLM) without capacity review

Enforced invariants: [tests/safety_invariants.sh](tests/safety_invariants.sh). See [docs/reboot-safety.md](docs/reboot-safety.md) and [docs/resource-guard.md](docs/resource-guard.md).

## Visual workloads (ComfyUI)

To add a new FLUX/LTX overlay:

1. Kustomize under `k8s/workloads/comfy-visual/<family>/<mode>/` basing on `comfy-base`
2. Register the model in `config/resource-policy.yaml` + JSON (`kind: deployment`)
3. Wire `get_visual_kustomize_dir` / starters in `scripts/lib/visual.sh` and `manage.sh`
4. Extend dashboard `InferenceModelName` allowlist if portal-startable
5. Add safety greps + `//tests:bats_visual_test` coverage
6. Document in [docs/visual-generative-ai.md](docs/visual-generative-ai.md)

Never push tags/PRs from agent automation unless the maintainer explicitly asks.

## Questions?

Open an issue or discuss in the PR. All changes — code, manifests, scripts, and docs — are reviewed with the same care.