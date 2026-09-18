import { defineConfig } from "@playwright/test";

/**
 * Visual regression gate for the documentation site.
 *
 * Replaces the MkDocs render test (`//docs:test_mkdocs_render`): the exported site is
 * screenshotted in a real browser and compared against the committed goldens, so a change
 * that breaks layout, theming or one of the ported widgets fails the suite instead of
 * being noticed by a reader.
 *
 * Goldens are produced on the CI image.  Screenshots taken on another platform differ in
 * font metrics, so refresh them from Linux (or in the same container CI uses) rather than
 * from a laptop — see MIGRATION.md at the repo root.
 */
const PORT = process.env.PLAYWRIGHT_PORT ?? "3135";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;
/**
 * Export the suite screenshots.
 *
 * Defaults to the normal `out`; the Linux capture container points this at its own directory
 * so its build cannot replace the export the host gates were produced from.
 */
const EXPORT_DIR = process.env.PLAYWRIGHT_EXPORT_DIR ?? "out";

export default defineConfig({
  testDir: "./tests/visual",
  testMatch: "**/*.spec.mjs",
  outputDir: "./tests/visual/actuals",
  reporter: "list",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Full-page captures of long pages (the models catalog alone is ~7.7k px tall) plus the
  // hydration and Mermaid waits do not fit the 30s default; the budget is per test, and the
  // screenshot itself is bounded by it.
  timeout: 180000,
  expect: {
    // toHaveScreenshot captures twice to prove stability, so it needs room for two shots.
    timeout: 60000
  },
  forbidOnly: Boolean(process.env.CI),
  snapshotPathTemplate: "./tests/visual/goldens/{projectName}/{arg}{ext}",
  // The export is a plain directory of index.html files, so the same static server that
  // `npm run serve` uses is what the suite points at.  An already-running server (a
  // developer's own) is reused rather than treated as a port clash.
  webServer: {
    command: `node scripts/serve_static.mjs ${new URL(BASE_URL).port || PORT} ${EXPORT_DIR}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120000
  },
  use: {
    baseURL: BASE_URL,
    headless: true,
    viewport: { width: 1440, height: 950 },
    actionTimeout: 15000,
    navigationTimeout: 60000,
    screenshot: "only-on-failure",
    trace: "off",
    video: "off",
    launchOptions: {
      // CI installs the pinned browser via `playwright install`; a developer can point at
      // an existing download with PLAYWRIGHT_EXECUTABLE_PATH instead of re-downloading it.
      ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
        : {}),
      args: [
        "--disable-font-subpixel-positioning",
        "--font-render-hinting=none",
        "--disable-skia-runtime-opts",
        "--force-color-profile=srgb",
        "--hide-scrollbars",
      ],
    },
  },
  projects: [{ name: "desktop" }, { name: "mobile", use: { viewport: { width: 390, height: 844 } } }],
});
