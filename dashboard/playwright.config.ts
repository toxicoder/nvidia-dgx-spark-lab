import { defineConfig, devices } from "@playwright/test";
import path from "path";

const GOLDENS_DIR = path.join(__dirname, "tests/visual/goldens");
const skipPrebuild = process.env.PLAYWRIGHT_SKIP_BUILD === "1";

export default defineConfig({
  testDir: "./tests/visual",
  testMatch: "**/*.spec.ts",
  outputDir: "./tests/visual/actuals",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 4 : 1,
  reporter: "list",
  snapshotPathTemplate: `${GOLDENS_DIR}/{arg}{ext}`,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01
    }
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    testIdAttribute: "data-testid",
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    viewport: { width: 1280, height: 900 },
    actionTimeout: 15000,
    navigationTimeout: 30000,
    colorScheme: "dark"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--disable-font-subpixel-positioning",
            "--font-render-hinting=none",
            "--disable-skia-runtime-opts",
            "--force-color-profile=srgb"
          ]
        }
      }
    }
  ],
  webServer: {
    command: skipPrebuild ? "npm run start" : "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI && !process.env.PLAYWRIGHT_BASE_URL && !skipPrebuild,
    timeout: 180 * 1000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      USE_MOCKS: "1",
      AUTH_BYPASS: "1",
      VISUAL_TEST: "1",
      BETTER_AUTH_SECRET: "visual-test-only-not-for-production"
    }
  }
});
