/**
 * Canonical list of committed Playwright golden basenames.
 * Keep in sync with dashboard/tests/visual/*.spec.ts capture names.
 */
const VIEWPORT_SUFFIXES = ["", "-mobile"] as const;

const LOGIN_GOLDENS = ["dashboard-login", "dashboard-login-error"] as const;

/** Per-viewport captures from the main dashboard test loop. */
const PER_VIEWPORT_GOLDENS = [
  "dashboard-main",
  "dashboard-resources",
  "dashboard-observability",
  "dashboard-inference",
  "dashboard-agent-chat",
  "dashboard-tasks",
  "dashboard-storage",
  "dashboard-workspaces",
  "dashboard-machine",
  "dashboard-utilities",
  "dashboard-secrets",
  "dashboard-sidebar",
  "dashboard-treemap",
  "dashboard-treemap-viz",
  "dashboard-treemap-controls",
  "dashboard-treemap-side-list",
  "dashboard-resources-panel",
  "dashboard-observability-panel",
  "dashboard-inference-panel",
  "dashboard-nemotron-stack-panel",
  "dashboard-open-webui-panel",
  "dashboard-tasks-panel",
  "dashboard-storage-panel",
  "dashboard-workspaces-panel",
  "dashboard-machine-state-panel",
  "dashboard-utilities-panel",
  "dashboard-secrets-panel",
  "dashboard-ui-sheet-dupes-empty",
  "dashboard-ui-button",
  "dashboard-ui-card",
  "dashboard-ui-badge",
  "dashboard-ui-input",
  "dashboard-ui-skeleton",
  "dashboard-ui-table",
  "dashboard-treemap-viz-sunburst",
  "dashboard-treemap-viz-selected",
  "dashboard-treemap-side-list-filtered",
  "dashboard-ui-dialog-bulk-delete",
  "dashboard-ui-sheet-dupes",
  "dashboard-ui-dialog",
  "dashboard-ui-sheet",
  "dashboard-ui-toast"
] as const;

/** Build the canonical sorted list of committed Playwright golden basenames. */
export function expectedGoldenFilenames(): string[] {
  const names = new Set<string>();

  for (const base of LOGIN_GOLDENS) {
    for (const suffix of VIEWPORT_SUFFIXES) {
      names.add(`${base}${suffix}.png`);
    }
  }

  for (const base of PER_VIEWPORT_GOLDENS) {
    for (const suffix of VIEWPORT_SUFFIXES) {
      names.add(`${base}${suffix}.png`);
    }
  }

  return [...names].sort();
}

export const EXPECTED_GOLDEN_COUNT = expectedGoldenFilenames().length;
