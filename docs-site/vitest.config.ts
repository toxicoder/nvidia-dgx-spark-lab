import { defineConfig } from "vitest/config";

/**
 * Unit-test scope for the documentation site.
 *
 * Vitest's default include also matches `*.spec.*`, which would sweep up the Playwright
 * visual specs under `tests/visual/` and fail them outside a browser runner.  Those specs
 * belong to `npm run visual`; this runner only takes the unit tests.
 */
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx,mjs}"],
    environment: "node"
  }
});
