Dashboard visual goldens (Playwright baselines).

**What's on this page**

- **88 committed baseline PNGs** (42 per-viewport × desktop/mobile + 4 login) plus this README. Only these files belong in `goldens/`.
- Inventory is enforced by `tests/visual/golden-inventory.test.ts` (Vitest) against `tests/visual/expected-goldens.ts`, kept in sync with `*.spec.ts` capture names.
- The `dashboard/tests/visual/` structure:
  - `login.spec.ts`, `dashboard-main.spec.ts`, `dashboard-panels.spec.ts`, `dashboard-interactions.spec.ts` — parallel Playwright specs (`testMatch: **/*.spec.ts`)
  - `visual-helpers.ts` — shared waits and screenshot helpers
  - `expected-goldens.ts` + `golden-inventory.test.ts` — orphan/missing guard
  - `goldens/` — committed baselines only
  - `actuals/` — generated on every run (gitignored)
  - `snapshots/` — Playwright-managed artifacts (gitignored)
- Populated via `USE_MOCKS=1` + `VISUAL_TEST=1` fixtures (no real cluster or exec needed).
- Strong waits prove full render: `networkidle` + `document.fonts.ready` + chart-ready selectors.

**Golden categories (42 base names × 2 viewports + 4 login = 88 PNGs)**

| Category           | Base names                                                                                                                                                                                                                                                                                                                           | Capture context                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Login              | `dashboard-login`, `dashboard-login-error`                                                                                                                                                                                                                                                                                           | `/login` (+ `?visual_error=1`)                                                                 |
| Full page          | `dashboard-main`                                                                                                                                                                                                                                                                                                                     | `/` full-page screenshot                                                                       |
| Sections           | `dashboard-resources`, `dashboard-observability`, `dashboard-inference`, `dashboard-agent-chat`, `dashboard-tasks`, `dashboard-storage`, `dashboard-workspaces`, `dashboard-machine`, `dashboard-utilities`, `dashboard-secrets`                                                                                                     | Section cards on `/` (chrome hidden)                                                           |
| Shell / treemap    | `dashboard-sidebar`, `dashboard-treemap`, `dashboard-treemap-viz`, `dashboard-treemap-controls`, `dashboard-treemap-side-list`                                                                                                                                                                                                       | Elements on `/` (chrome hidden)                                                                |
| Panels             | `dashboard-resources-panel`, `dashboard-observability-panel`, `dashboard-inference-panel`, `dashboard-nemotron-stack-panel`, `dashboard-open-webui-panel`, `dashboard-tasks-panel`, `dashboard-storage-panel`, `dashboard-workspaces-panel`, `dashboard-machine-state-panel`, `dashboard-utilities-panel`, `dashboard-secrets-panel` | Isolated panels on `/dev/panels`                                                               |
| UI primitives      | `dashboard-ui-button`, `dashboard-ui-card`, `dashboard-ui-badge`, `dashboard-ui-input`, `dashboard-ui-skeleton`, `dashboard-ui-table`                                                                                                                                                                                                | `/dev/ui` fixture gallery                                                                      |
| Interaction states | `dashboard-treemap-viz-sunburst`, `dashboard-treemap-viz-selected`, `dashboard-treemap-side-list-filtered`, `dashboard-ui-dialog-bulk-delete`, `dashboard-ui-sheet-dupes`, `dashboard-ui-sheet-dupes-empty`, `dashboard-ui-dialog`, `dashboard-ui-sheet`, `dashboard-ui-toast`                                                       | User flows on `/`; sheet fixtures on `/dev/panels/empty-dupes` and `/dev/panels/utility-sheet` |

Mobile treemap labels at 375px rely on truncation, SVG `<title>`, and Recharts Tooltip. Visual treemap data uses balanced `fakeVisualTree` when `VISUAL_TEST=1` (unit tests keep `fakeTree`).

**What this enables**

- Catch visual regressions across the whole UI and individual panels.
- Fast hermetic feedback using mocks.
- Automatic detection of orphan or missing baseline files before Playwright runs.

## Updating goldens

See `REVIEW_LOOP.md` and `dashboard/AGENTS.md`. Prefer the Linux Docker path for CI parity:

```bash
UPDATE_SNAPSHOTS=1 ./dashboard/scripts/run-hermetic-tests.sh
```

Local shortcut (macOS dev; font rasterization may differ):

```bash
UPDATE_SNAPSHOTS=1 bazelisk run //dashboard:visual -- --update-snapshots
```

Inspect `tests/visual/actuals/` on any mismatch. Commit only intended new baselines under `goldens/`.

See also: `.gitattributes`, root `.gitignore`, `playwright.config.ts`, `REVIEW_LOOP.md`.
