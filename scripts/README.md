# Scripts

## manage.sh

The primary interface for day-to-day operations.

Preferred Bazel entry point (entire codebase is Bazel-first):

```bash
bazelisk run //:manage -- help
bazelisk run //:manage -- status
```

Classic direct invocation also supported:

```bash
./scripts/manage.sh help
```

See root README and docs/ for usage patterns. Full shell conventions: [docs/project-conventions.md](../docs/project-conventions.md#6-shell-scripts).

Path resolution for scripts and BATS/kcov coverage uses [`lib/paths.sh`](lib/paths.sh) (`lab_script_dir`, `lab_repo_root`, `lab_canonical_repo_root`).

The script:
- Automatically uses `./kubeconfig/config` if present
- Includes confirmation + resource checks before starting the heavy "kimi" job
- Uses `restartPolicy: OnFailure` + low backoff in the manifests it deploys
- Never auto-starts anything

## Utility Scripts Pattern (new)

Lightweight, dashboard-controllable utilities live in `scripts/utilities/`.

**Best practices (enforced by pattern)** — detailed in [project-conventions.md](../docs/project-conventions.md#quick-reference-checklists):

- Implement `status [--json]` (reports state, exit 0 when "done").
- Implement `run` (idempotent: no-op if already correct).
- Use structured comments so they appear in generated docs.
- Source `lib/common.sh` for log/check_tool.
- Never touch inference workloads.

Example (the ultra-optimized spark-clock utility):
```bash
bazelisk run //scripts:run-utility -- spark-clock status
bazelisk run //scripts:run-utility -- spark-clock run
```

See the dashboard "Utilities" panel for UI control (run buttons, status).

Adding a new utility: drop a compliant .sh in the directory. It becomes visible to Bazel, docs generator, and the dashboard automatically.

