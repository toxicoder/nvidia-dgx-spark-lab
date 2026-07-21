# AGENTS.md for dgx-lab-dashboard (sub-app)

Follow [docs/project-conventions.md](../docs/project-conventions.md) (especially [§ Dashboard](../docs/project-conventions.md#10-dashboard-nextjs) and [§ Documentation coverage (mandatory)](../docs/project-conventions.md#documentation-coverage-mandatory)) plus this stack-specific guidance.

Also follow root [AGENTS.md](../AGENTS.md) for **test efficiency** (prefer `//dashboard:fast-test` before hermetic Docker) and **end-of-session reflection** under least privilege.

**Documentation:** JSDoc on every exported function/class/component in `actions/`, `lib/services/`, panels, and app routes; explicit return types on exports. Regenerate API docs with `bazelisk run //dashboard:docs`.

**Stack**:

- Next.js 16+ App Router, `output: "standalone"`
- shadcn/ui + Radix primitives (Dialog, Sheet, Select, Label, Alert) + Sonner toasts
- MD3 tokens in `globals.css`
- Drizzle + SQLite + better-auth
- Visual regression: Playwright `toHaveScreenshot` → `tests/visual/goldens/`

## Structure

| Path                                                | Role                                                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `app/(dashboard)/page.tsx`                          | Thin RSC composer — single `Promise.all` data load                                                             |
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
UPDATE_SNAPSHOTS=1 ./dashboard/scripts/run-hermetic-tests.sh   # regenerate Linux goldens
bazelisk run //dashboard:visual                 # local Playwright only (macOS dev)
```

Per-ui goldens capture from `/dev/ui`; panel goldens from `/dev/panels` — not the production dashboard shell.

## Testing

- **Fast path (default validate slice):** `bazelisk run //dashboard:fast-test` (host Vitest + ESLint + typecheck; no Playwright)
- **Canonical hermetic path:** `bazelisk run //dashboard:hermetic-test` (Docker: Vitest + ESLint + typecheck + build + Playwright)
- Vitest (local): `cd dashboard && npm run test`
- Lint / typecheck: `npm run lint` (ESLint), `npm run typecheck` (tsc)
- Vitest defaults: `USE_MOCKS=1` via `vitest.setup.ts` (includes `next/navigation` mock)
- Playwright: `USE_MOCKS=1` + `AUTH_BYPASS=1`
- `//dashboard:visual-test` is `manual` in Bazel — use `bazelisk run //dashboard:visual`

Full testing conventions: [docs/project-conventions.md § Testing](../docs/project-conventions.md#12-testing).

## Safety

- `LAB_WHITELIST_BASES`, utility allow-list, delete/stop confirmations unchanged
- `AUTH_BYPASS` / `USE_MOCKS` only in test configs
