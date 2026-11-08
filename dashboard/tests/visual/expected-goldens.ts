/**
 * Canonical list of committed Playwright golden basenames.
 *
 * This used to be a hand-copied array, and it drifted twice: once when sections became
 * real routes, and again when `sections.spec.ts` started capturing light mode, because a
 * list nobody derives is a list nobody updates. The names now come from the same
 * `SECTION_ROUTES`, `PANEL_SELECTORS`, `MAIN_PAGE_ELEMENTS` and `UI_FIXTURES` arrays the
 * specs iterate, composed with the same suffix helpers, so a capture the specs make
 * without a matching entry (or the reverse) fails `golden-inventory.test.ts` on the spot.
 */
import {
  MAIN_PAGE_ELEMENTS,
  PANEL_SELECTORS,
  SECTION_ROUTES,
  STORAGE_EXTRA_CAPTURES,
  THEMES,
  UI_FIXTURES,
  VIEWPORTS,
  themeSuffix,
  viewportSuffix
} from "./visual-helpers";

/** `dashboard-main` is a full-page capture, so it sits outside the element arrays. */
const FULL_PAGE_BASES = ["dashboard-main"] as const;

/** Interactions open transient surfaces; their names are literal in the spec. */
const INTERACTION_BASES = [
  "dashboard-treemap-viz-sunburst",
  "dashboard-treemap-viz-selected",
  "dashboard-treemap-side-list-filtered",
  "dashboard-ui-dialog-bulk-delete",
  "dashboard-ui-sheet-dupes",
  "dashboard-ui-sheet-dupes-empty",
  "dashboard-ui-dialog",
  "dashboard-ui-sheet",
  "dashboard-ui-toast"
] as const;

/**
 * The login page renders outside the themed shell and its spec never applies a theme,
 * so those four names are fixed strings in `login.spec.ts` rather than a product of
 * the viewport and theme axes.
 */
const FIXED_NAMES = [
  "dashboard-login.png",
  "dashboard-login-mobile.png",
  "dashboard-login-error.png",
  "dashboard-login-error-mobile.png"
] as const;

/**
 * Bases captured once per viewport and once per theme, because the rail, the treemap and
 * every section panel have to hold in light mode as well as dark.
 */
function themeAxeBases(): string[] {
  return [
    ...FULL_PAGE_BASES,
    ...MAIN_PAGE_ELEMENTS.map((entry) => entry.baseSlug),
    ...SECTION_ROUTES.map((route) => route.baseSlug),
    ...STORAGE_EXTRA_CAPTURES.map((entry) => entry.baseSlug)
  ];
}

/** Bases captured once per viewport only; their spec loops over viewports alone. */
function viewportOnlyBases(): string[] {
  return [
    ...PANEL_SELECTORS.map((entry) => entry.baseSlug),
    ...UI_FIXTURES.map((entry) => entry.baseSlug),
    ...INTERACTION_BASES
  ];
}

/** Build the canonical sorted list of committed Playwright golden basenames. */
export function expectedGoldenFilenames(): string[] {
  const names = new Set<string>(FIXED_NAMES);

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      for (const base of themeAxeBases()) {
        names.add(`${base}${viewportSuffix(viewport.name)}${themeSuffix(theme.name)}.png`);
      }
    }
    for (const base of viewportOnlyBases()) {
      names.add(`${base}${viewportSuffix(viewport.name)}.png`);
    }
  }

  return [...names].sort();
}

export const EXPECTED_GOLDEN_COUNT = expectedGoldenFilenames().length;
