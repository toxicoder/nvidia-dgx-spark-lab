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

### One trunk

`main` is the trunk. It is the only long-lived branch, and every change reaches it by pull request.

| Branch | Role | Protection |
|--------|------|------------|
| `main` | The trunk. All work lands here, and releases are tagged here. | Protected: PRs only, linear history, status checks required |

Short-lived branches live for days, not weeks. Cut one from the tip of `main` before your first edit, open the pull request while the change is still small, and delete the branch when it merges. When trunk moves under you, rebase your own branch; never rebase a branch someone else may have pulled.

**Retirement note.** `development` was the previous integration branch and `dev` an optional soak gate. Both are retired. `development` (tip `7867ee87ea62c747656785f500f93c211cd465f3`, last written 2026-11-10) is 159 commits ahead of `main`, and `main` holds no work of its own beyond retired MkDocs site scaffolding, so promoting that tip onto trunk is a content move with nothing to reconcile. `dev` (tip `1b4bcbefba62a5e860b7044dec0b49d518249b8b`) was last written 2026-07-20. Those SHAs are the recovery points until garbage collection.

Never force-push `main`.
Never commit directly to protected branches.

### Branch naming

Create every short-lived branch from the tip of `main`, with one of these prefixes:

- `feat/<short-description>` — new functionality
- `fix/<short-description>` — bug fixes, including urgent production ones
- `refactor/<short-description>` — no behavior change
- `chore/<short-description>` — tooling, CI, and dependency work
- `docs/<short-description>` — documentation-only changes
- `ci/<short-description>` — workflow and gate changes
- `test/<short-description>` — test-only changes
- `perf/<short-description>` — performance work
- `build/<short-description>` — Bazel and packaging changes

Examples:

- `feat/resource-guard-headroom-tuning`
- `fix/nemotron-startup-probe`
- `fix/nccl-interface-mismatch`
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

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `build`, `perf`

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
fix: correct NCCL_SOCKET_IFNAME for 200G QSFP links on Spark

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
- [ ] (Agents) Session reflection done — least-privilege process notes only; see AGENTS.md
```

Keep the tone professional and direct. Write as a developer talking to other developers.

### Promotion process (trunk to tag)

Promotion is a tag on trunk. Nothing is promoted from a branch name.

1. Ensure the tip of `main` is green:

   ```bash
   bazelisk run //:validate -- --all
   ```

2. The PR description must include:
   - Confirmation that full validation passed
   - Any outstanding safety notes
   - The intended tag (see below)
3. After the PR is merged, create an **annotated tag** on the merge commit:

   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z – short description"
   git push origin vX.Y.Z
   ```

4. Reference tags or image digests, never the floating tip of `main` or a branch name, for any production or reproducible lab deployment.

### Urgent fixes

1. Branch `fix/<description>` from the current `main`.
2. Fix the issue, open a PR into `main` (expedited review is acceptable for critical problems).
3. Delete the branch on merge. There is no second integration branch to catch up.

### Environments

Deployment environments are **not** Git branches. An environment is a set of values, a set of secrets, and a place it runs. Use the existing mechanisms, each named in [docs/environments.md](docs/environments.md):

- `k8s/overlays/<dir>` for workload shape, applied with `kubectl apply -k`
- Ansible inventory groups plus `ansible/inventory/group_vars/` for host-level values
- `config/` policy files (`resource-policy.yaml` and its JSON twin, `lab-domains.yaml`, `flags.yaml`)
- The published image tag or digest as the one promotion lever

Keep parameter names identical across environments, and promote by pointing the same revision at a different value set. This keeps history clean and prevents environment drift.

Unfinished work ships on trunk behind a feature flag that defaults off. Declare it in [config/flags.yaml](config/flags.yaml) with an owner, an expiry, and its single reader, then keep `bazelisk test //tests:flags_registry` green. The gate lets a flag default on only when it is declared `kind: capability` with a reason, so an unfinished feature can never become load-bearing by accident.

### Branch protection expectations

Maintainers should keep these GitHub settings enabled on `main`:

- Require a pull request before merging
- Require status checks to pass (the CI suite: `CI - Test Suite`, `validate-gate`)
- Require linear history (squash or rebase only)
- Restrict force pushes
- Restrict deletions
- CODEOWNERS recommended for high-risk paths (`k8s/workloads/`, `config/`, `ansible/`, safety-critical scripts)

Attach secrets and required-reviewer protection rules to the GitHub **Environments** (`artifacts` for published images, and one per deploy target) rather than to a branch name. That review is the gate a branch name used to fake.

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
| Documentation site prose and page formatting | [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) |
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

Hand-written docs are rendered by Fumadocs (Next.js App Router) from the content in `docs/`. Follow [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for frontmatter, page structure, and generated reference workflow.

```bash
bazelisk run //docs:serve     # live preview
bazelisk run //docs:docs       # static export into docs-site/out/
bazelisk test //docs-site:unit //docs-site:typecheck   # widgets + types
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