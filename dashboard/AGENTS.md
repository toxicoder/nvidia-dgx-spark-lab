# AGENTS.md for dgx-lab-dashboard (sub-app)

Follow [docs/project-conventions.md](../docs/project-conventions.md) (especially [§ Dashboard](../docs/project-conventions.md#10-dashboard-nextjs) and [§ Documentation coverage (mandatory)](../docs/project-conventions.md#documentation-coverage-mandatory)) plus this stack-specific guidance.

Also follow root [AGENTS.md](../AGENTS.md) for **test efficiency** (prefer `//dashboard:fast-test` before hermetic Docker) and **end-of-session reflection** under least privilege.

**Documentation:** JSDoc on every exported function/class/component in `actions/`, `lib/services/`, panels, and app routes; explicit return types on exports. Regenerate API docs with `bazelisk run //dashboard:docs`.

**Stack**:

- Next.js 16+ App Router, `output: "standalone"`
- shadcn/ui + Radix primitives (Dialog, Sheet, Select, Label, Alert, Collapsible, Tabs, Switch, Toast) + Sonner toasts
- Design tokens: `app/themes.css` declares `--tok-*` primitives per theme; `app/globals.css` is the single
  place that derives the shadcn (`--background`, `--warning`, …) and MD3 (`--md-sys-color-*`) names from them
- Drizzle + SQLite + better-auth
- Visual regression: Playwright `toHaveScreenshot` → `tests/visual/goldens/`

## Routed sections

Each console section is a real route, not an anchor on one long page.

| Path                                   | Role                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `lib/section-registry.ts`              | One descriptor per section: title, description, group, icon                                     |
| `lib/types/index.ts`                   | `DASHBOARD_SECTIONS` / `DashboardSectionSlug` / `DASHBOARD_SECTION_GROUPS` — the closed nav set |
| `app/(dashboard)/[section]/`           | Dynamic route: `resolveSlug` rejects anything outside the closed set with `notFound()`          |
| `components/sections/<slug>/index.tsx` | **Data loader only** — wraps host calls in `attempt()`; it owns no chrome                       |
| `components/<Name>Panel.tsx`           | **Owns the frame** (see below), plus its own refresh and poll cadence                           |

The registry and the closed slug set are the source of truth: add a section by extending
`DASHBOARD_SECTIONS`, its descriptor, and its `components/sections/` module. `routes.test.tsx`
and the nav drift test fail when the three disagree, so the rail cannot drift from the routes.

## Design system

Sections are built from shared primitives in `components/ui/` rather than hand-rolled chrome.

- **Every section panel renders the same frame**: `Panel` → `PanelHeader` → (`PanelTitle` + optional
  `PanelDescription` / `PanelActions`) → `PanelBody` → optional `PanelFooter`. `Panel` emits
  `data-slot="panel"` and **no** `data-testid`, so pass the panel's existing `data-testid` to it.
  Keep exactly one frame and one `h2` per section: when a server wrapper holds the testid, the
  wrapper owns the frame and the client renders body content only.
- `MetricTile` for label-over-number figures, `StatusBadge` for closed-set states, `ErrorState` for
  probe failures, `EmptyState`, `CopyButton`, and `PanelRefreshButton` instead of per-panel markup.
- **Risk colour is not decorative.** `warning` is an amber tier (`--warning`, derived from
  `--tok-warning` in every theme block); `danger` is destructive. Rendering a warning in red was
  the defect that made a capacity-headroom tile read as a fault. `theme-contrast.test.ts` measures
  both at WCAG AA in every theme, so a new tone needs contrast pairs there or the gate fails.
- **No arbitrary font sizes.** `text-[10px]`-style bracket sizes are banned by
  `components/__tests__/type-scale.test.ts`; use the scale (`text-xs` and up) or add a `@theme` step.
- **Never read browser state during render.** `ThemeProvider` adopts the stored theme in an effect;
  reading `localStorage` in the initial render desynchronises the client markup from the server HTML
  and costs every route a hydration mismatch.
- Toasts come from `@/lib/toast` (or the component's existing `@/components/ui/toast` import), never
  from a hand-rolled overlay.

## Structure

| Path                                                | Role                                                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `app/(dashboard)/page.tsx`                          | Thin RSC composer — single `Promise.all` data load                                                             |
| `app/(dashboard)/[section]/`                        | Per-section route, driven by `lib/section-registry.ts`                                                         |
| `components/ui/panel.tsx`                           | The shared section frame (`data-slot="panel"` family)                                                          |
| `components/DashboardShell.tsx`                     | Sidebar + sticky header + mobile menu (replaces `Sidebar.tsx`)                                                 |
| `app/dev/ui/page.tsx`                               | Isolated shadcn fixture gallery for visual goldens                                                             |
| `app/dev/panels/page.tsx`                           | Isolated panel fixture gallery for visual goldens                                                              |
| `app/dev/panels/empty-dupes/page.tsx`               | Empty dupes sheet fixture (separate route — avoids sheet overlay on panels)                                    |
| `app/dev/panels/utility-sheet/page.tsx`             | Utility result sheet fixture for `dashboard-ui-sheet` goldens                                                  |
| `components/features/`                              | (optional) feature bundles — panels live in `components/` with clear names                                     |
| `lib/format.ts`                                     | `humanSize`, `formatTimestamp`, `truncateOutput`                                                               |
| `lib/validation.ts`                                 | Shared Zod schemas (`ContainerIdSchema`, `PathSchema`)                                                         |
| `lib/toast.ts`                                      | Sonner-backed `toast()` API                                                                                    |
| `actions/host-actions.ts`                           | Mutations + `revalidatePath('/')`                                                                              |
| `actions/preferences-actions.ts`                    | Generic key/value preferences (session-gated)                                                                  |
| `lib/mocks/fixtures.ts`                             | Mock data for USE_MOCKS (not `tests/fixtures`); `fakeVisual*` when `VISUAL_TEST=1` uses DGX Spark 2-node specs |
| `scripts/run-fast-tests.sh`                         | Host fast path: Vitest + lint + typecheck (`bazelisk run //dashboard:fast-test`)                               |
| `Dockerfile.test` + `scripts/run-hermetic-tests.sh` | Hermetic Linux test container (CI parity; full visual on `validate --all`)                                     |

## shadcn policy

Add components via [shadcn CLI](https://ui.shadcn.com/docs/components). Overlays must use Radix (`components/ui/dialog.tsx`, `sheet.tsx`) and Sonner (`sonner.tsx`), not hand-rolled modals.

## Visual review loop

See `tests/visual/REVIEW_LOOP.md`. After UI changes:

```bash
bazelisk run //dashboard:build
bazelisk run //dashboard:hermetic-test          # Docker: Vitest + build + Playwright (preferred)
UPDATE_SNAPSHOTS=1 bazelisk run //dashboard:hermetic-test   # regenerate Linux goldens
bazelisk run //dashboard:visual                 # local Playwright only (macOS dev)
```

Per-ui goldens capture from `/dev/ui`; panel goldens from `/dev/panels`. `sections.spec.ts` captures the
**real routes** — every `SECTION_ROUTES` entry at both viewports in both `THEMES` — because light mode and
the routed shell are what the fixture galleries could not catch. The treemap surfaces capture from
`/storage` (they render inside `StoragePanel`), listed once in `STORAGE_EXTRA_CAPTURES`; keep them out of
`MAIN_PAGE_ELEMENTS`, which is the overview's own list.

`tests/visual/expected-goldens.ts` derives the committed golden list from `SECTION_ROUTES`,
`PANEL_SELECTORS`, `MAIN_PAGE_ELEMENTS`, `STORAGE_EXTRA_CAPTURES` and `UI_FIXTURES`, so adding a section or
a panel changes the expected set automatically. `golden-inventory.test.ts` compares that list to disk
**and** checks each PNG's signature, declared dimensions, byte size and bytes-per-pixel floor, so a blank,
truncated, stale or never-produced screenshot fails the run instead of becoming a baseline.

Two rules keep that suite honest, both covered by `tests/visual/visual-helpers.test.ts`:

- **Wait only for what the route renders.** `waitForDashboardReady` waits for the treemap and the
  home-page panels; a single-section route has neither, so pass `{ treemap: false, homePanels: false }`
  and assert the route's own target with `requireVisible`. Leaving the defaults on costs ~18s of dead
  wait per route and swallows the miss behind `.catch(() => {})`.
- **Passthrough flags go after `--`.** `run_npm.sh` runs `npm exec playwright test -- "$@"`; without the
  separator npm eats `--update-snapshots` and the lane compares instead of writing.
  `//tests:bats_tooling_test` pins it.

## Testing

- **Fast path (default validate slice):** `bazelisk run //dashboard:fast-test` (host Vitest + ESLint + typecheck; no Playwright)
- **Canonical hermetic path:** `bazelisk run //dashboard:hermetic-test` (Docker: Vitest + ESLint + typecheck + build + Playwright)
- Vitest: `bazelisk run //dashboard:test`
- Lint / typecheck: `bazelisk run //dashboard:fast-test` (Vitest + ESLint + tsc in one pass)
- Vitest defaults: `USE_MOCKS=1` via `vitest.setup.ts` (includes `next/navigation` mock)
- Playwright: `USE_MOCKS=1` + `AUTH_BYPASS=1`
- `//dashboard:visual-test` is `manual` in Bazel — use `bazelisk run //dashboard:visual`

Full testing conventions: [docs/project-conventions.md § Testing](../docs/project-conventions.md#12-testing).

## Safety

- `LAB_WHITELIST_BASES`, utility allow-list, delete/stop confirmations unchanged
- `AUTH_BYPASS` / `USE_MOCKS` only in test configs
