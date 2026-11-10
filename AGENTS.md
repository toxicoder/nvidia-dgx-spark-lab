# AGENTS.md

Guidelines for AI coding agents working in the `nvidia-dgx-spark-lab` repository.

**Shared conventions** (naming, patterns, formatting, safety, testing, change discipline) live in [docs/project-conventions.md](docs/project-conventions.md). Read that document first. This file covers **AI-agent workflow** only.

Operator docs (Fumadocs site, content in `docs/`, app in `docs-site/`): Start / Concepts / Operate / Reference / Contribute — begin at [docs/index.mdx](docs/index.mdx) and [docs/getting-started.mdx](docs/getting-started.mdx). Single-node Compose Comfy is **not** this repo; point learners at [ez-comfy-stack](https://github.com/toxicoder/ez-comfy-stack). Visual here stays `k8s/workloads/comfy-*` + `scripts/lib/visual.sh`.

Subdirectory addenda extend the conventions doc:

- [dashboard/AGENTS.md](dashboard/AGENTS.md) — Next.js dashboard specifics

## Branching, commits, PRs, and promotion

Full human-facing rules: [CONTRIBUTING.md](CONTRIBUTING.md#branching-commits-prs-and-promotion) and [docs/branching.md](docs/branching.md). The model, in eight lines:

1. `main` is the trunk, and the only long-lived branch. Everything else is short-lived.
2. Cut `feat/`, `fix/`, `refactor/`, `docs/`, `chore/`, `ci/`, `test/`, `perf/`, `build/` branches from the tip of `main` before the first edit.
3. Merge by pull request within days; delete the branch on merge.
4. Rebase your own branch when trunk moves. Never rebase a branch someone else may have pulled.
5. Commit summaries are imperative, at most 72 characters, with a conventional prefix.
6. An environment is values, secrets, and a location. It is never a branch: see [docs/environments.md](docs/environments.md).
7. Unfinished work ships on trunk behind a flag declared in [config/flags.yaml](config/flags.yaml) that defaults off. `bazelisk test //tests:flags_registry` gates the registry.
8. `dev` and `development` are retired; `/ez-trunk-based-repo` re-proves the conversion.

- **Never force-push** `main`. Never commit directly to a protected branch.
- Protected branches require **linear history** — squash or rebase only (no merge commits).
- Cut a `fix/` branch from `main` for an urgent production problem, merge it, then land the same change on trunk in the same pass. There is no second integration branch to chase.

### Promotion (trunk to tag)

Promotion is a maintainer action, not an agent action.

1. Tip of `main` is green: `bazelisk run //:validate -- --all`
2. Open a PR only when the maintainer asks; agents do not open promotion PRs.
3. After merge, create an **annotated tag** on the merge commit:

   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z - short description"
   git push origin vX.Y.Z
   ```

4. Deploy and lab runs consume that tag or an image digest. Nothing reads a branch name to decide what to deploy.

Never push tags or open promotion PRs from agent automation unless the maintainer explicitly asks.

### Environments

Deployment environments are **not** Git branches. Each one has a single value home, named in [docs/environments.md](docs/environments.md):

- `k8s/overlays/<dir>` for workload shape, applied with `kubectl apply -k`
- Ansible inventory groups plus `ansible/inventory/group_vars/` for host-level values
- `config/` policy files (`resource-policy.yaml` and its JSON twin, `lab-domains.yaml`, `flags.yaml`)
- The published image tag or digest as the one promotion lever

### Commit messages

Style: Conventional Commits inspired, readable for other developers:

```
<type>: <short summary in imperative mood>
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `build`, `perf`

- Summary ≤ 72 characters; imperative mood (“add”, “fix”, not “added” / “fixes”).
- Body explains *why* when non-obvious; wrap at 72–80 characters.
- Footer for issue links when useful (`Closes #123`). Never put secrets, dumps, or “WIP” in final messages.

### Pull requests

- **Title:** same style as a good commit summary (imperative, concise).
- **Description must include:** Summary, Changes, Safety impact, Test plan, and the checklist from [CONTRIBUTING.md](CONTRIBUTING.md#pull-request-titles-and-descriptions).
- Safety impact: explicitly state workload / Resource Guard / NCCL / restartPolicy / manage.sh impact, or “No safety impact.”

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

- Prefer `.devcontainer/` (multi-arch **linux/amd64 + linux/arm64**): Apple Silicon, Windows Docker Desktop, Linux, NVIDIA DGX Spark (Grace ARM). The container is always Linux.
- Tool pins: `.devcontainer/tool-versions.env` (shared with CI via `scripts/ci/install-lint-tools.sh`).
- After open: `bazelisk run //:doctor` then `//:fix` / `//:validate`.
- **Grok Build** is baked at `/usr/local/bin/grok` (`GROK_SANDBOX=lab`, host LLMs via `host.docker.internal`). **Hermes Agent** is optional post-create. Auth is interactive only — **never** commit API keys, `GROK_DEPLOYMENT_KEY`, or `~/.grok` / `~/.hermes` state.
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
| New docs pages | Add the file under `docs/`, register it in the nav (hand-edit `docs-site/lib/nav.json`, then `bazelisk test //docs-site:nav_test`), **and** list it in `_HAND_WRITTEN_MD` in `docs/BUILD.bazel` — `//tests:doc_coverage` fails otherwise |
| Docs regen | After shell/API comment changes: `bazelisk run //docs:docs` (or dashboard docs) and commit generated deltas that belong |
| Test coverage | Every lane holds its shipped code at 100% and Bazel gates it (`//:test-fast`, `//:verify`, `//:validate`, CI). New shipped code arrives with tests that keep its row at 100; a file that does not belong goes in the config's exclude list with its reason. See [project-conventions § Coverage](docs/project-conventions.md#coverage-100-enforced) |
| Strong types | Broad types are defects: no `Any` in Python (`mypy.ini` `disallow_any_explicit`), no `any`/unjustified `unknown` in TS (type-aware `no-explicit-any` + `no-unsafe-*`), no bare `dict`/`list`/`tuple`/`set`. Closed sets declared once — `as const` in `dashboard/lib/types/index.ts`, `StrEnum`/`TypedDict` in `scripts/lib/py/lab_types.py`. Utility JSON crossing into the dashboard is zod-parsed in `dashboard/lib/services/cli-json.ts` (never cast). Shell params validated via `scripts/lib/types.sh`. See [project-conventions § 5b](docs/project-conventions.md#5b-strong-types) and [docs/strong-types.md](docs/strong-types.md) |
| Gates must not pass vacuously | A check that inspected nothing must exit non-zero. `//lints:mypy` and `//lints:yaml_format` both once printed "no files" and exited 0. New gates hard-fail on an empty file list |
| TDD + validate | Red–green–refactor; finish with `bazelisk run //:validate` |

When conventions are missing a rule, **add the automated check** (and document it in `docs/project-conventions.md`) rather than relying on human reminder.

### Documentation updates

Finish relevant changes by updating documentation. See [docs/project-conventions.md § Change discipline](docs/project-conventions.md#13-change-discipline-and-pr-checklist) and [§ Documentation coverage (mandatory)](docs/project-conventions.md#documentation-coverage-mandatory).

- Every file must meet stack-appropriate documentation standards (shell `# @function`, Python docstrings, TS JSDoc, YAML headers).
- Update structured comments (`# ##` / `# @command` or JSDoc) for new/changed public APIs.
- Regenerate: `bazelisk run //docs:docs` (shell) or `bazelisk run //dashboard:docs` (API).
- Update workload READMEs and affected `docs/*.md` pages.
- New pages: register them in the nav **and** list the file in `docs/BUILD.bazel` data arrays.
- MDX rules: pages needing JSX (callouts, tabs, includes) are `.mdx`; escape literal `<`, `{`, `}` outside code fences. Plain pages stay `.md`.
- Update this `AGENTS.md` when AI-specific workflow evolves; update `docs/project-conventions.md` when shared patterns evolve.

### Communication

- Be methodical and clear.
- Summarize what changed, what was validated, and next steps.
- Use `todo_write` for anything with 3+ steps.
- Use plan mode for ambiguous or large tasks.
- Final responses should let a human quickly understand what was done and why it is safe/correct.

### Efficiency of checks and tests (local + CI)

Agents must **optimize for feedback speed** without weakening safety gates. Prefer the smallest correct slice first; escalate only when needed.

| Cost | Prefer | Avoid as a first step |
| --- | --- | --- |
| Cheap | Targeted Bazel tests (`//tests:bats_*`, `//docs:test_command_vars`, `//docs:test_python_coverage`), `//dashboard:fast-test`, path-aware `//:validate` | Full `--all` on every edit |
| Medium | `//:test-fast`, `//:lint --test_tag_filters=manual`, `//docs-site:unit`, `//docs-site:typecheck`, `//docs-site:visual_tooling_test` | Rebuilding hermetic dashboard Docker for pure docs/shell changes |
| Expensive | `//docs-site:visual-linux` (browser in the CI image; needs Docker), `//docs:render-check` (needs the export), `//dashboard:hermetic-test`, `//:validate -- --all` | Running these after every one-line change when a unit test would catch the bug |

**Rules:**

1. **Path-aware by default** — `bazelisk run //:validate` (no `--all`) mirrors CI path filters. Use `--all` before merge, after broad refactors, or when unsure.
2. **Red–green on the smallest target** — fail a unit/BATS/docs unit test first; only then widen to render/hermetic suites.
3. **Do not duplicate work** — one Next export per gate set (`//docs:docs` feeds `//docs:render-check` and `//docs-site:visual`); do not re-run hermetic dashboard when only `docs/**` or CI YAML changed.
4. **When adding tests or CI** — prefer pure unit over e2e; keep `//:test-fast` free of the browser and the npm build; preserve GHA cache keys and path filters; never force every push to trunk to run the full matrix without a path filter.
5. **Commands** — Bazel entry points (`bazelisk run //:manage`, `//:validate`, `//docs:docs`); avoid ad-hoc loops of format+lint+full validate after each keystroke.
6. **Safety is not optional latency** — never skip `//tests:safety_invariants`, Resource Guard checks, or capacity gates “to go faster.”

See also [project-conventions § Testing](docs/project-conventions.md#12-testing) and CI path filters in `.github/workflows/ci.yml`.

### End-of-session reflection (mandatory for agents)

Before ending a multi-step coding session, **reflect** and act only under least privilege:

1. **Did tools and commands match policy?** Bazel-first, path-aware validate, TDD evidence (red/green), relative paths, no secrets in commits.
2. **Any hacky workaround?** e.g. `|| true` hiding real failures, editing generated files by hand, skipping tests, weakening auth or safety greps, force-push, elevating sudo, committing API keys.
3. **If process friction was real**, prefer the **minimal, least-privilege** improvement:
   - Document the correct command in `AGENTS.md` / `docs/project-conventions.md` / CONTRIBUTING rather than widening permissions.
   - Devcontainer: add a tool only if CI or documented workflows already require it; pin versions in `.devcontainer/tool-versions.env`; never embed secrets or broaden sudo for convenience.
   - Prefer an automated check (lint, bats, doc_coverage) when a convention is easy to violate — do not rely on human reminder alone.
   - **Never** relax Resource Guard, safety invariants, restart policies, NCCL requirements, or auth to make agents faster.
4. **Land improvements safely** — small follow-up commit on the current short-lived branch when the change is clearly in scope; otherwise note a future `chore/` / `docs/` PR. Do not open promotion PRs or push tags unless the maintainer asked.
5. **Leave the tree green** for the slice you touched (`//:validate` path-aware or `--all` when appropriate).

**Session reflection blurb (include in the final summary when non-trivial work happened):**

```text
Reflection: <what went well with tools/commands> /
  <any workaround and whether it was cleaned up> /
  <AGENTS/devcontainer/conventions updates if any, and why least-privilege>.
```

Follow these guidelines on every task in this repository.