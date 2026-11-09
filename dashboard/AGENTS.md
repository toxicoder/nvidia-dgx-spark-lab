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

`notFound()` in `resolveSlug` lands on `app/(dashboard)/not-found.tsx`, the console's own answer to a
mistyped section: `PageHeader` + `EmptyState` + a link back to the overview. Deleting that file returns
operators to Next's unstyled default, which is also the only page the bundled typeface does not reach —
`font-coverage.spec.ts` walks the unknown route for exactly that reason.

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
- **The typeface is self-hosted.** `app/layout.tsx` loads Noto Sans and Noto Sans Mono through
  `next/font/local`, and `app/globals.css` binds them to `--font-sans` / `--font-mono`. Under Tailwind's
  default system stack the same build measured text in DejaVu Sans on a Linux box, Noto Sans inside the
  test image, and Segoe UI on an operator's laptop, which made every visual baseline
  environment-dependent. `tests/visual/font-pinning.test.ts` pins the declaration;
  `tests/visual/font-coverage.spec.ts` fails when any glyph falls back to a system face.
- **Never read browser state during render.** `ThemeProvider` adopts the stored theme in an effect;
  reading `localStorage` in the initial render desynchronises the client markup from the server HTML
  and costs every route a hydration mismatch.
- **An overlay must not eat the tap that follows it.** Radix keeps a closing `Sheet` mounted for the
  exit animation and keeps honouring outside dismissals the whole time, so a second tap on the mobile
  menu button was reported by the dying instance as a dismiss whose late `false` cancelled the new
  open: the drawer silently ignored the operator for ~300 ms. `components/ui/sheet.tsx` compares the
  dismissal's `detail.originalEvent.timeStamp` against when the sheet last finished opening and drops
  anything older. `tests/visual/dashboard-drawer.spec.ts` pins it with a real tap inside the window.
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

`PLAYWRIGHT_SKIP_BUILD=1` reuses whatever is in `.next`. The `/dev/ui` and `/dev/panels` galleries call
`notFound()` when `NODE_ENV=production` with `USE_MOCKS` unset, and Next inlines both at build time, so a
plain `next build` bakes those routes off and four golden specs fail on a 404 no matter what the server
is later started with. Build with the harness env (`USE_MOCKS=1 VISUAL_TEST=1 npx next build`) or let the
lane build itself.

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

Three rules keep that suite honest, each pinned by its own check:

- **Wait only for what the route renders.** `waitForDashboardReady` waits for the treemap and the
  home-page panels; a single-section route has neither, so pass `{ treemap: false, homePanels: false }`
  and assert the route's own target with `requireVisible`. Leaving the defaults on costs ~18s of dead
  wait per route and swallows the miss behind `.catch(() => {})`.
- **Passthrough flags go after `--`.** `run_npm.sh` runs `npm exec playwright test -- "$@"`; without the
  separator npm eats `--update-snapshots` and the lane compares instead of writing.
  `//tests:bats_tooling_test` pins it.
- **A capture waits on the font, not only the network.** `requireBundledFonts` runs before every
  `toHaveScreenshot`. Playwright's own font wait can pass before late-mounted content (a portal's mono
  file paths) requests a face, and the capture then blesses the fallback's metrics — a baseline that
  reads a few percent off in the next run, in every environment that picked a different font.

When Docker is unavailable, `.github/workflows/dashboard-goldens.yml` (manual dispatch) renders the
baselines with the pinned browser and uploads them as an artifact. Commit that artifact; a baseline from
a host Chromium is not a baseline.

## Testing

- **Fast path (default validate slice):** `bazelisk run //dashboard:fast-test` (host Vitest + ESLint + typecheck; no Playwright)
- **Canonical hermetic path:** `bazelisk run //dashboard:hermetic-test` (Docker: Vitest + ESLint + typecheck + build + Playwright)
- Vitest: `bazelisk run //dashboard:test`
- Lint / typecheck: `bazelisk run //dashboard:fast-test` (Vitest + ESLint + tsc in one pass)
- Vitest defaults: `USE_MOCKS=1` via `vitest.setup.ts` (mocks `next/navigation` and shims
  `next/font/local`, whose real module needs Next's build loader and is not callable under Vitest)
- Playwright: `USE_MOCKS=1` + `AUTH_BYPASS=1`
- Behaviour specs sit beside the goldens and assert interaction rather than pixels:
  `dashboard-drawer.spec.ts` (mobile drawer lifecycle) and `not-found.spec.ts` (unknown section route).
  They keep `stabilizePage` off where an animation is the thing under test.
- `//dashboard:visual-test` is `manual` in Bazel — use `bazelisk run //dashboard:visual`

Full testing conventions: [docs/project-conventions.md § Testing](../docs/project-conventions.md#12-testing).

## Safety

- `LAB_WHITELIST_BASES`, utility allow-list, delete/stop confirmations unchanged
- `AUTH_BYPASS` / `USE_MOCKS` only in test configs
