# AGENTS.md

Guidelines for AI coding agents working in the `nvidia-dgx-spark-lab` repository.

**Shared conventions** (naming, patterns, formatting, safety, testing, change discipline) live in [docs/project-conventions.md](docs/project-conventions.md). Read that document first. This file covers **AI-agent workflow** only.

Subdirectory addenda extend the conventions doc:

- [dashboard/AGENTS.md](dashboard/AGENTS.md) — Next.js dashboard specifics

## Branching, commits, PRs, and promotion

Full human-facing rules: [CONTRIBUTING.md](CONTRIBUTING.md#branching-commits-prs-and-promotion). Agents must follow the invariants below without ambiguity.

### Long-lived branches

| Branch | Role |
| --- | --- |
| `development` | Primary integration. All feature and non-urgent fix work lands here first (PR only). |
| `main` | Production-ready code after deliberate promotion (PR only, normally from `development`). |
| `dev` | Optional intermediate promotion gate when extra soak/review is needed (PR only). |

- **Never force-push** `development` or `main`. Never commit directly to protected branches.
- Protected branches require **linear history** — squash or rebase only (no merge commits).
- Do not open long-lived feature PRs into `main` by default; land on `development` first, then promote.

### Branch naming

Create short-lived branches from latest `development` (hotfixes from `main`):

- `feature/<short-description>` — new functionality
- `fix/<short-description>` — non-urgent bug fixes
- `hotfix/<short-description>` — urgent production fixes (from `main`)
- `chore/<short-description>` — tooling, docs, CI, no-behavior refactors
- `docs/<short-description>` — documentation-only

Use short, kebab-case descriptions (e.g. `feature/resource-guard-headroom-tuning`). Avoid ticket numbers as the only identifier.

### Commit messages

Style: Conventional Commits inspired, readable for other developers:

```
<type>: <short summary in imperative mood>
```

**Types:** `feat`, `fix`, `hotfix`, `chore`, `docs`, `refactor`, `test`, `ci`, `build`

- Summary ≤ 72 characters; imperative mood (“add”, “fix”, not “added” / “fixes”).
- Body explains *why* when non-obvious; wrap at 72–80 characters.
- Footer for issue links when useful (`Closes #123`). Never put secrets, dumps, or “WIP” in final messages.

### Pull requests

- **Title:** same style as a good commit summary (imperative, concise).
- **Description must include:** Summary, Changes, Safety impact, Test plan, and the checklist from [CONTRIBUTING.md](CONTRIBUTING.md#pull-request-titles-and-descriptions).
- Safety impact: explicitly state workload / Resource Guard / NCCL / restartPolicy / manage.sh impact, or “No safety impact.”

### Promotion (`development` → `main`)

1. Tip of `development` is green: `bazelisk run //:validate -- --all`
2. Open a promotion PR into `main` (or via `dev` if an intermediate gate is desired)
3. PR notes: validation passed, outstanding safety notes, intended tag
4. After merge, create an **annotated tag** on the merge commit:

   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z – short description"
   git push origin vX.Y.Z
   ```

5. Prefer tags over the floating tip of `main` for production or reproducible lab deployments.

Never push tags or open promotion PRs from agent automation unless the maintainer explicitly asks.

### Hotfixes

1. Branch `hotfix/<description>` from current `main`
2. PR → `main` (expedited review OK for critical issues)
3. Immediately follow up with a PR (or clean cherry-pick) back into `development`
4. Tag the fix on `main`

### Environments

Deployment environments are **not** long-lived Git branches. Use:

- `k8s/overlays/test`, `k8s/overlays/prod`, `k8s/overlays/single-node`
- Ansible inventory + group_vars
- `config/resource-policy.yaml` (and JSON twin) plus related policy files

## AI agent workflow

### Planning and task tracking

- **Use plan mode** for tasks with genuine ambiguity, multiple reasonable architectures, high-impact restructuring, or unclear requirements. Write a detailed plan before coding.
- For multi-step work (> 2–3 logical steps): create and maintain a task list with `todo_write`. Update it as you go.

### Test-driven development (TDD)

**TDD is the default workflow.** Red–green–refactor on every non-trivial change:

1. **Red** — Write or extend a failing test. Run the relevant target and confirm failure for the right reason.
2. **Green** — Implement the **minimum** production change to pass.
3. **Refactor** — Clean up while keeping tests green.

**Required for:** new commands/helpers, dashboard actions/components, utilities, docs-generator behavior, bug fixes, safety/pre-flight logic, and refactors that change observable behavior.

**Practical exceptions** (still finish with tests before done):

- Pure discovery spikes — replace with TDD once behavior is understood
- Trivial mechanical edits (formatting, no-behavior renames) — existing tests must stay green
- Generated-only churn — extend tests when rendered output or safety greps change

**Show the red and green runs** in your response (exact command + output) so reviewers see the TDD cycle.

Test stack mapping: [docs/project-conventions.md § Testing](docs/project-conventions.md#12-testing).

### Read before you edit

Always read (or grep) a file before modifying it. Understand the current state.

### Incremental validation

Work incrementally and validate frequently:

```bash
bazelisk build //... --nobuild          # fast syntax check
bazelisk test //tests:bats_manage_test  # targeted shell tests
bazelisk run //dashboard:test           # targeted dashboard tests
bazelisk run //docs:docs                # after docs/generator changes
bazelisk run //:validate                # before considering task done
bazelisk run //:fix                     # after BUILD.bazel or formatter changes
```

Run `bazelisk run //:validate` after every set of changes — before ending the turn or marking a task complete.

### Paths and commands

- Prefer **relative paths** in commands, references, and edits.
- Prefer **Bazel entry points** (`bazelisk run //:manage --`, `bazelisk run //scripts:run-utility --`) over direct script invocation.
- **Always show your work**: include exact commands and key output in responses.

### Safety callouts

On every change touching workloads, scripts, manifests, NCCL, restart policies, resource limits, or `manage.sh`:

- Explicitly state the **safety impact** in reasoning and summary.
- Run `bazelisk test //tests:safety_invariants` when manifest or policy changes are involved.

Non-negotiable invariants: [docs/project-conventions.md § Safety invariants](docs/project-conventions.md#14-non-negotiable-safety-invariants).

### Contributor environment (devcontainer)

- Prefer `.devcontainer/` (multi-arch **linux/amd64 + linux/arm64**): Apple Silicon, Windows Docker Desktop, Linux, NVIDIA DGX Spark (Grace ARM).
- Tool pins: `.devcontainer/tool-versions.env` (shared with CI via `scripts/ci/install-lint-tools.sh`).
- After open: `bash .devcontainer/doctor.sh` then `//:fix` / `//:validate`.
- Optional agent CLIs (post-create): **Grok Build** (`grok`) and **Hermes Agent** (`hermes`). Auth is interactive only — **never** commit API keys, `GROK_DEPLOYMENT_KEY`, or `~/.grok` / `~/.hermes` state.
- Full guide: [docs/dev-environment.md](docs/dev-environment.md).

### Visual generative AI (ComfyUI / FLUX / LTX)

- Workloads live under `k8s/workloads/comfy-base/` and `k8s/workloads/comfy-visual/` (Deployments, label `workload: visual`).
- Lifecycle via `scripts/lib/visual.sh` and `manage.sh` (`start-flux-*`, `start-ltx-*`, `start-flux-to-ltx`, `stop-visual`).
- **Manual start only**; one visual Deployment at a time; Resource Guard capacity + heavy confirm.
- Models: hostPath `/mnt/models` via `download-flux` / `download-ltx` utilities; Comfy state on PVC `comfy-state`.
- Spark unified-memory patch + `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True` are required for performance — do not remove without measuring thrash.
- **Container scripts and ConfigMap content** (`install-comfy.sh`, workflow JSON, settings YAML, entrypoints, etc.): real language-native files + `configMapGenerator` `files:` — never inline secondary languages in ConfigMap YAML or multi-line shell in Deployment `args: |`.
- Tests: `//tests:bats_visual_test`, `//tests:bats_comfy_scripts_test`, and visual greps in `//tests:safety_invariants`.
- Operator guide: [docs/visual-generative-ai.md](docs/visual-generative-ai.md).

### Always-on best practices (do not wait to be asked)

These are **defaults on every task**, not optional follow-ups. `//:validate` / `//tests:doc_coverage` enforce most of them:

| Practice | Rule |
| --- | --- |
| ConfigMap language content | Real files + kustomize `configMapGenerator` `files:` only; **ban** multi-line embeds of `*.sh` / `*.py` / `*.json` / nested YAML / `*_JSON` blobs |
| Shell docs | `# ##` file header; `# @function` on every function in `scripts/lib`, `scripts/utilities`, and `k8s/workloads/**/*.sh` |
| Shell style | Follow [project-conventions §6](docs/project-conventions.md#6-shell-scripts): `set -euo pipefail` on entry scripts, quote expansions, diagnostics on **stderr**, thin `main` + BASH_SOURCE guard; ShellCheck **warnings = defects** |
| Shell tooling | `//lints:shell` (ShellCheck) + `//lints:shfmt`; format with `//:fix` |
| Utility scripts | `status` / `run` contract; `# @command` entrypoint; main source guard when defining `main()` |
| YAML manifests | `# Purpose` / `Source of truth` / `Regenerate` / `Safety` headers |
| New MkDocs pages | Add to `mkdocs.yml` **and** `docs/BUILD.bazel` (`//docs:serve`, `//docs:docs`, `_RENDER_TEST_DATA`) |
| Docs regen | After shell/API comment changes: `bazelisk run //docs:docs` (or dashboard docs) and commit generated deltas that belong |
| TDD + validate | Red–green–refactor; finish with `bazelisk run //:validate` |

When conventions are missing a rule, **add the automated check** (and document it in `docs/project-conventions.md`) rather than relying on human reminder.

### Documentation updates

Finish relevant changes by updating documentation. See [docs/project-conventions.md § Change discipline](docs/project-conventions.md#13-change-discipline-and-pr-checklist) and [§ Documentation coverage (mandatory)](docs/project-conventions.md#documentation-coverage-mandatory).

- Every file must meet stack-appropriate documentation standards (shell `# @function`, Python docstrings, TS JSDoc, YAML headers).
- Update structured comments (`# ##` / `# @command` or JSDoc) for new/changed public APIs.
- Regenerate: `bazelisk run //docs:docs` (shell) or `bazelisk run //dashboard:docs` (API).
- Update workload READMEs and affected `docs/*.md` pages.
- New pages: wire `mkdocs.yml` nav **and** list the file in `docs/BUILD.bazel` data arrays.
- Update this `AGENTS.md` when AI-specific workflow evolves; update `docs/project-conventions.md` when shared patterns evolve.

### Communication

- Be methodical and clear.
- Summarize what changed, what was validated, and next steps.
- Use `todo_write` for anything with 3+ steps.
- Use plan mode for ambiguous or large tasks.
- Final responses should let a human quickly understand what was done and why it is safe/correct.

Follow these guidelines on every task in this repository.