# Contributing to nvidia-dgx-spark-lab

Thank you for helping improve the lab. This file is a short hub; detailed conventions live in the docs site.

## Quick start

1. **Set up the contributor environment** (multi-arch: Apple Silicon, Windows x86, Linux, DGX Spark Grace):
   - Preferred: open the [devcontainer](.devcontainer/) — see [docs/dev-environment.md](docs/dev-environment.md).
   - Then: `bash .devcontainer/doctor.sh` → `bazelisk run //:fix` → `bazelisk run //:validate`.
2. Read [docs/project-conventions.md](docs/project-conventions.md) for naming, patterns, formatting, safety, and testing across all stacks.
3. For **cluster / DGX hardware** ops (not required to edit code), see [docs/getting-started.md](docs/getting-started.md).

## Branching, commits, PRs, and promotion

This repository uses a simple, safety-conscious model that keeps the source history clean while giving us a clear integration gate before code reaches production.

### Long-lived branches

| Branch        | Purpose                                      | Who merges into it          | Protection |
|---------------|----------------------------------------------|-----------------------------|----------|
| `development` | Primary integration branch. All feature work lands here first. Lab / test overlays are expected to work from this branch. | Pull requests only         | Protected, linear history |
| `main`        | Production-ready code that has been explicitly promoted.     | Pull requests only (normally from `development`) | Protected, linear history |
| `dev`         | Optional intermediate promotion gate. Use only when an extra soak or review period is needed. | Pull requests only         | Protected |

Never force-push `development` or `main`.  
Never commit directly to protected branches.

### Branch naming

Create short-lived branches from the latest `development`:

- `feature/<short-description>` — new functionality
- `fix/<short-description>` — bug fixes that are not urgent production hotfixes
- `hotfix/<short-description>` — urgent production fixes (branched from `main`)
- `chore/<short-description>` — tooling, docs, CI, refactoring with no user-visible behavior change
- `docs/<short-description>` — documentation-only changes

Examples:

- `feature/resource-guard-headroom-tuning`
- `fix/nemotron-startup-probe`
- `hotfix/nccl-interface-mismatch`
- `chore/update-bazel-deps`

Keep the description short, kebab-case, and meaningful. Avoid ticket numbers as the only identifier.

### Commit messages

Write commit messages for other developers (and future you).

Preferred style (Conventional Commits inspired, but readable):

```
<type>: <short summary in imperative mood>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `hotfix`, `chore`, `docs`, `refactor`, `test`, `ci`, `build`

Rules:

- Summary line ≤ 72 characters, imperative mood (“add”, “fix”, “update”, not “added” or “fixes”).
- Body explains *why* when it is not obvious from the diff. Wrap at 72–80 characters.
- Reference related issues or PRs in the footer when useful (`Closes #123`, `Related to #456`).
- Never put secrets, large dumps, or “WIP” in the final commit message.

Good examples:

```
feat: add capacity headroom check before heavy model start

The previous check only looked at requested GPUs. This adds a
configurable memory and CPU headroom percentage so the lab stays
responsive under concurrent workloads.

Closes #87
```

```
fix: correct NCCL_SOCKET_IFNAME for dual 400G links on Spark

The interface names were hardcoded to an older netplan layout.
```

```
chore: bump dashboard dependencies and regenerate lockfile
```

### Pull request titles and descriptions

**Title:** Same style as a good commit summary (imperative, concise).

**Description template** (use this structure; agents and humans should both follow it):

```markdown
## Summary
One or two sentences that explain *what* changed and *why*.

## Changes
- Bullet list of the concrete changes
- Call out any new flags, environment variables, or config keys

## Safety impact
- Explicitly state whether this touches workloads, resources, restartPolicy, NCCL, Resource Guard, manage.sh, or reboot behavior.
- If none: “No safety impact.”
- If yes: describe the impact and how it was validated.

## Test plan
- Exact commands you ran (or that CI will run)
- Any manual verification steps

## Checklist
- [ ] `bazelisk run //:fix` and `bazelisk run //:validate` pass
- [ ] New or changed behavior has tests
- [ ] Structured comments / docs updated if public API or commands changed
- [ ] Safety callout completed above
```

Keep the tone professional and direct. Write as a developer talking to other developers.

### Promotion process (development → main)

1. Ensure the tip of `development` is green:

   ```bash
   bazelisk run //:validate -- --all
   ```

2. Open a promotion PR from `development` into `main` (or via `dev` if an intermediate gate is desired).
3. The PR description must include:
   - Confirmation that full validation passed
   - Any outstanding safety notes
   - The intended tag (see below)
4. After the promotion PR is merged, create an **annotated tag** on the merge commit:

   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z – short description"
   git push origin vX.Y.Z
   ```

5. Prefer referencing tags rather than the floating tip of `main` for any production or reproducible lab deployments.

### Hotfix process

1. Branch `hotfix/<description>` from the current `main`.
2. Fix the issue, open PR → `main` (expedited review is acceptable for critical problems).
3. After merge, immediately open a follow-up PR (or clean cherry-pick) back into `development`.
4. Tag the fix on `main`.

### Environments

Deployment environments are **not** represented by long-lived Git branches.  
Use the existing mechanisms:

- `k8s/overlays/test`, `k8s/overlays/prod`, `k8s/overlays/single-node`
- Ansible inventory + group_vars
- `config/resource-policy.yaml` (and its JSON twin) plus related policy files

This keeps history clean and prevents environment drift.

### Branch protection expectations

Maintainers should keep these GitHub settings enabled on `development` and `main`:

- Require a pull request before merging
- Require status checks to pass (the CI suite)
- Require linear history (squash or rebase only)
- Restrict force pushes
- Restrict deletions
- CODEOWNERS recommended for high-risk paths (`k8s/workloads/`, `config/`, `ansible/`, safety-critical scripts)

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