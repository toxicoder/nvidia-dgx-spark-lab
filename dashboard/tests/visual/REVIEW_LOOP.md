# Visual Review Loop

Use this checklist after every UI change in `dashboard/`.

## Commands

```bash
bazelisk run //dashboard:build
bazelisk run //dashboard:visual
UPDATE_SNAPSHOTS=1 bazelisk run //dashboard:visual -- --update-snapshots
bazelisk run //dashboard:test
```

Bazel `//dashboard:visual-test` is `manual` (sandbox may lack native module builds). Prefer `bazelisk run //dashboard:visual`.

## Loop

1. Implement the UI change.
2. Build and run visual tests.
3. Inspect `tests/visual/actuals/` on failure.
4. Self-review against the checklist below.
5. Fix or update goldens intentionally, then commit PNGs.

## Checklist

- No raw `<pre>` JSON dumps in panel goldens
- Overlays use shadcn Dialog / Sheet / Sonner
- MD3 semantic tokens only (no hardcoded hex in TSX)
- `dashboard-main` looks like a product dashboard (no test fixture gallery)
- Per-ui goldens captured from `/dev/ui` on dark `bg-background` wrappers
- Mobile sidebar via Sheet; treemap readable at 375px
- Dialog, sheet, toast, and treemap selection states captured
- Treemap selection golden uses leaf file (`mistral-7b.gguf`), not a directory drill
- Dialog golden has no overlapping Sonner toast (dismiss before capture)
- Empty dupes sheet golden captured from `/dev/panels/empty-dupes` (not overlaid on panel goldens)
- Dupes-with-groups sheet has no Sonner toast (sheet is the feedback; toast golden uses Run flow)
- Sunburst goldens show color segments only (no raw byte arc labels; tooltip for sizes)

## Harness notes

- HSL tokens in `globals.css` must use `H S% L%` triples (Tailwind v4 `@theme inline` maps `--color-primary: hsl(var(--primary))`).
- Panel goldens capture from `/dev/panels`; empty dupes sheet from `/dev/panels/empty-dupes`; UI primitives from `/dev/ui` on `bg-background` wrappers.
- Treemap selection targets leaf `mistral-7b.gguf`; dismiss Sonner toasts before dialog and sheet captures.
- Visual treemap data uses balanced `fakeVisualTree` when `VISUAL_TEST=1` (unit tests keep `fakeTree`).
- Sidebar goldens capture before `hideDashboardChrome()` (chrome hiding persists for the page).
- Inventory: `expected-goldens.ts` + `golden-inventory.test.ts` enforce the committed PNG count; Playwright `testMatch: **/*.spec.ts` excludes Vitest.
