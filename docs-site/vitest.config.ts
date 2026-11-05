import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Unit-test scope for the documentation site.
 *
 * Vitest's default include also matches `*.spec.*`, which would sweep up the Playwright
 * visual specs under `tests/visual/` and fail them outside a browser runner.  Those specs
 * belong to `npm run visual`; this runner only takes the unit tests.
 *
 * The DOM environment is needed because the site's own components are exercised here:
 * `components/*.tsx` render into jsdom the same way `dashboard/vitest.config.ts` renders
 * the dashboard panels.  `@` mirrors the tsconfig path alias so a component that imports a
 * sibling through `@/components/...` resolves under Vitest the way Next resolves it.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx,mjs}"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    /**
     * 100% is the repo-wide bar (`dashboard/vitest.config.ts` and
     * `docs/test_python_coverage.sh` hold the same line), and the gate is a real
     * `bazelisk test`: `npm run unit` passes `--coverage`, so `//docs-site:unit` fails
     * when coverage drops.
     *
     * The include list is the shipped site - pages, chrome, and the `lib/` logic behind
     * them.  `scripts/**` stays out: those are build-time tools, and the Python ones are
     * already held to 100% by `//docs:test_python_coverage`.  `next-env.d.ts` and the
     * Next/Playwright config files are declarations and harness, not behaviour.
     */
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json-summary", "html"],
      include: ["lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.*",
        "**/__tests__/**",
        "tests/**",
        "node_modules/**",
        ".next/**",
        ".source/**",
        "**/*.d.ts"
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    }
  }
});
