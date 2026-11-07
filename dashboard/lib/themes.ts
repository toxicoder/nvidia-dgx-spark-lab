/** Dashboard theme catalog and lookup helpers for the MD3 theme selector. */

export type ThemeMode = "dark" | "light";

export interface DashboardTheme {
  id: string;
  label: string;
  description: string;
  mode: ThemeMode;
  /** Primary swatch for the selector preview */
  swatch: string;
}

/**
 * The one catalog of selectable themes.
 *
 * Everything theme-shaped is derived from this list: the selector, the
 * `data-theme` bootstrap script in `app/layout.tsx`, the id and `color-scheme`
 * checks against `app/themes.css`, and `//dashboard:test`'s
 * `lib/__tests__/theme-contrast.test.ts`, which fails when a `[data-theme]`
 * block exists without a catalog entry (or the other way round). Add a theme
 * here and there; never re-list ids or the light/dark rule anywhere else.
 */
const THEME_CATALOG = [
  {
    id: "spark-lime",
    label: "Spark Lime",
    description: "Default lab palette — brand lime on slate",
    mode: "dark",
    swatch: "#86b737"
  },
  {
    id: "ocean-teal",
    label: "Ocean Teal",
    description: "Cool cyan-teal accents on deep navy",
    mode: "dark",
    swatch: "#2dd4bf"
  },
  {
    id: "violet-dusk",
    label: "Violet Dusk",
    description: "Soft violet highlights on indigo surfaces",
    mode: "dark",
    swatch: "#a78bfa"
  },
  {
    id: "sunset-amber",
    label: "Sunset Amber",
    description: "Warm amber and gold on espresso dark",
    mode: "dark",
    swatch: "#f59e0b"
  },
  {
    id: "rose-neon",
    label: "Rose Neon",
    description: "Magenta-rose accents on charcoal",
    mode: "dark",
    swatch: "#f472b6"
  },
  {
    id: "arctic-frost",
    label: "Arctic Frost",
    description: "Icy blue with high-contrast surfaces",
    mode: "dark",
    swatch: "#38bdf8"
  },
  {
    id: "mono-slate",
    label: "Mono Slate",
    description: "Neutral zinc with subtle blue-gray accent",
    mode: "dark",
    swatch: "#94a3b8"
  },
  {
    id: "cyber-mint",
    label: "Cyber Mint",
    description: "Electric mint on near-black",
    mode: "dark",
    swatch: "#34d399"
  },
  {
    id: "daylight",
    label: "Daylight",
    description: "Clean light surfaces with lime accent",
    mode: "light",
    swatch: "#466b0f"
  },
  {
    id: "paper-sand",
    label: "Paper Sand",
    description: "Warm parchment tones with terracotta accent",
    mode: "light",
    swatch: "#973711"
  }
] as const satisfies readonly DashboardTheme[];

/** Id of a theme in the catalog. The catalog is the only place ids are written. */
export type DashboardThemeId = (typeof THEME_CATALOG)[number]["id"];

/** LocalStorage key for persisting the selected dashboard theme. */
export const THEME_STORAGE_KEY = "dgx-dashboard-theme";

/** Default theme id applied on first visit. */
export const DEFAULT_THEME_ID: DashboardThemeId = "spark-lime";

/** Ordered catalog of selectable dashboard themes. */
export const DASHBOARD_THEMES: DashboardTheme[] = [...THEME_CATALOG];

/** Every theme id, in catalog order — derive any id list from this, never re-type it. */
export const DASHBOARD_THEME_IDS: readonly DashboardThemeId[] = THEME_CATALOG.map((theme) => theme.id);

/** Ids of the themes whose palette is light — the list that must drop `.dark`. */
export const LIGHT_THEME_IDS: readonly DashboardThemeId[] = THEME_CATALOG.filter((theme) => theme.mode === "light").map(
  (theme) => theme.id
);

const THEME_ID_SET: ReadonlySet<string> = new Set<string>(DASHBOARD_THEME_IDS);
const LIGHT_THEME_ID_SET: ReadonlySet<string> = new Set<string>(LIGHT_THEME_IDS);

/** Resolve a theme definition by id, or undefined when unknown. */
export function getThemeById(id: string): DashboardTheme | undefined {
  return DASHBOARD_THEMES.find((t) => t.id === id);
}

/** Return whether the id exists in the dashboard theme catalog. */
export function isValidThemeId(id: string): boolean {
  return THEME_ID_SET.has(id);
}

/**
 * Return whether the theme paints a light palette (and therefore must not carry
 * the `.dark` class or a dark `color-scheme`). Unknown ids read as dark, which
 * matches {@link DEFAULT_THEME_ID}'s mode.
 */
export function isLightThemeId(id: string): boolean {
  return LIGHT_THEME_ID_SET.has(id);
}
