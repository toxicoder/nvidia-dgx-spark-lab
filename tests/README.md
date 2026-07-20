# Testing

This project includes a practical, robust test suite that can run locally and in CI without any hardware or live cluster.

## Quick Start

```bash
# Primary (Bazel — recommended)
bazelisk run //:validate                          # git-aware: core + docs/dashboard slices
bazelisk run //:validate -- --all                   # full suite before merge
bazelisk test //:test                              # Bazel test_suite (test-fast + docs render)
bazelisk test //:lint --test_tag_filters=manual   # shellcheck, yamllint, kubeconform (when installed)

# Legacy / direct tools (Debian/Ubuntu example)
sudo apt-get install shellcheck yamllint bats
pip install ansible ansible-lint
curl -sL https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz | tar xz
sudo mv kubeconform /usr/local/bin/

make help
make lint
make test
make test-all
```

## What is Tested

| Area              | Tools / Target                     | Coverage                                      |
|-------------------|------------------------------------|-----------------------------------------------|
| Shell scripts     | `//tests:bats` + shellcheck | `manage.sh` commands, safety, modular libs (models/dev/domains/status) |
| Lab domains       | `//tests:bats_domains_test` | `lab-domains.yaml` render pipeline, FQDN helpers, generated SSO manifests; teardown restores tracked generated artifacts |
| Devcontainer      | `//tests:bats_devcontainer_test` | Multi-arch pin SSOT, doctor/post-create help, no `releases/latest` in Dockerfile |
| Shell line coverage | `//tests:shell_coverage` (`manual`) | kcov 100% on `scripts/**/*.sh`; **5 parallel BATS shards** merged into one report. Linux amd64 + `SYS_PTRACE`. Bazel `eternal` caps at **3600s** — on slow hosts (Docker Desktop amd64 emulation) run `bash tests/shell_coverage.sh` directly instead |
| TypeScript/Next.js (dashboard) | `bazelisk run //dashboard:test` (Vitest; alias `//dashboard:unit-test`) | host services, actions, Treemap viz, panels (with mocks) |
| Dashboard (fast)  | `bazelisk run //dashboard:fast-test` | Vitest + ESLint + typecheck on host (no Docker, no Playwright). Default in `//:validate` when dashboard paths change. |
| Dashboard (full)  | `bazelisk run //dashboard:hermetic-test` | **Canonical** Docker path: Vitest + ESLint + typecheck + build + Playwright (Linux goldens). Requires Docker. Runs on `validate --all`. |
| Dashboard (local) | `bazelisk run //dashboard:visual`  | Local Playwright only; `//dashboard:visual-test` is `manual` in Bazel |
| Kubernetes YAML   | `//lints:k8s` + Makefile `test-k8s` | syntax, schema (kubeconform), critical fields (resources, restartPolicy, NCCL) |
| Ansible playbooks | `//ansible:validate` + ansible-lint | all playbooks + group vars + modular roles    |
| Docs (fast)       | `//docs:test_mkdocs_build` (local / docs job; not in `//:test-fast`) | mkdocs strict build, frontmatter, HTML/mermaid/asset checks (no Playwright) |
| Docs (visual)     | `//docs:test_mkdocs_visual`        | Playwright screenshots vs goldens only |
| Docs (combined)   | `//docs:test_mkdocs_render`        | build + visual (same as fast + visual) |
| Safety invariants | `//tests:safety_invariants` + BATS + `make test-k8s` | No `Always` restart, low backoff, NCCL vars, GPU requests on ray, probes/securityContext on kimi, resource-policy registry sync |
| Documentation coverage | `//tests:doc_coverage` + `//tests:doc_coverage_unit` (in `//:test-fast` / suite) | `manage.sh` `# @command`, shell `# @function` (incl. `k8s/workloads/**/*.sh`), Python docstrings, YAML headers, **no inline ConfigMap language embeds**, **no multi-line shell in mcp manifests**, mkdocs nav pages listed in `docs/BUILD.bazel`, BUILD `Package purpose:`, dashboard export JSDoc |

## Safety invariants

Safety checks are layered:

1. **Bazel target** — `//tests:safety_invariants` (included in `//:test-fast`): manifest greps plus `config/resource-policy.json` registry sync.
2. **Dynamic (BATS)** — `//tests:bats_manage_test` mocks `kubectl` and exercises confirmation prompts, pre-flight GPU checks, and manifest application for `start-kimi` / `start-test`. `//tests:bats_visual_test` covers ComfyUI visual starts (`start-flux-*`, `stop-visual`) and offline download utilities. `//tests:bats_comfy_scripts_test` covers standalone comfy-base install/run scripts and the Spark free-memory patch.
3. **Static greps (Makefile `test-k8s`)** — same critical manifest checks for non-Bazel users.
4. **CI** (`.github/workflows/ci.yml` `bazel-core` job) — runs `//:test-fast`, which includes `//tests:safety_invariants`.

Run locally:

```bash
bazelisk test //tests:bats_manage_test
bazelisk test //tests:bats_visual_test
bazelisk test //tests:bats_comfy_scripts_test
make test-k8s          # or full make test-all
```

## BATS Tests

Located in `tests/bats/`.

They use a sophisticated mock of `kubectl` so that:

- `start-kimi` exercises the confirmation + pre-flight GPU checks
- `start-test` verifies correct manifest application
- No external cluster is required

## Dashboard Docker tests

**Canonical path for CI parity** (Linux goldens, full toolchain in container):

```bash
bazelisk run //dashboard:hermetic-test
# Regenerate goldens after intentional UI change:
UPDATE_SNAPSHOTS=1 ./dashboard/scripts/run-hermetic-tests.sh
```

Uses `dashboard/Dockerfile.test` + `dashboard/scripts/run-hermetic-tests.sh`. Local macOS dev can use `bazelisk run //dashboard:visual` as a shortcut; prefer the hermetic path before merging visual changes.

## CI

Every push and PR runs the complete suite via GitHub Actions (see `.github/workflows/ci.yml`).

Path-filtered parallel jobs: `bazel-core` (`//:test-fast` + lint), `dashboard-unit` (host fast tests), `dashboard-hermetic` (Docker + Playwright; skips re-Vitest when unit passed), `docs-and-render` (single `//docs:test_mkdocs_render`). Safety greps live in `//tests:safety_invariants` inside `//:test-fast`. See `docs/BUILDING_WITH_BAZEL.md` for path-filter details.

## Adding New Tests

- Add shell tests to `tests/bats/manage.bats` (use the existing mock pattern)
- For dashboard (TS): add in `dashboard/lib/services/__tests__/` or components (Vitest, mocks for host exec/fs)
- Add new static checks in the Makefile `test-k8s` or `test-ansible` targets (or future `//lints:safety_invariants`)
- New linter rules go in `.yamllint.yml` or `.ansible-lint`
- After modular changes, expand to cover extracted modules (e.g. lib/models.sh functions)
- Docs formatting: extend `docs/test_mkdocs_render.py` when adding new nav pages

## Philosophy

Tests must be fast, deterministic, and runnable by anyone cloning the repo.
We favor catching configuration drift, missing resource limits, and accidental `restartPolicy: Always` over integration tests against real DGX hardware.

Full testing conventions and TDD workflow: [docs/project-conventions.md](../docs/project-conventions.md#12-testing).