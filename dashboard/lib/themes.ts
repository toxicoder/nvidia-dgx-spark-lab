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

/** LocalStorage key for persisting the selected dashboard theme. */
export const THEME_STORAGE_KEY = "dgx-dashboard-theme";

/** Default theme id applied on first visit. */
export const DEFAULT_THEME_ID = "spark-lime";

/** Ordered catalog of selectable dashboard themes. */
export const DASHBOARD_THEMES: DashboardTheme[] = [
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
    swatch: "#65a30d"
  },
  {
    id: "paper-sand",
    label: "Paper Sand",
    description: "Warm parchment tones with terracotta accent",
    mode: "light",
    swatch: "#c2410c"
  }
];

/** Resolve a theme definition by id, or undefined when unknown. */
export function getThemeById(id: string): DashboardTheme | undefined {
  return DASHBOARD_THEMES.find((t) => t.id === id);
}

/** Return whether the id exists in the dashboard theme catalog. */
export function isValidThemeId(id: string): boolean {
  return DASHBOARD_THEMES.some((t) => t.id === id);
}
