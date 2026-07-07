import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json", "html"],
      include: ["actions/**/*.ts", "app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.ts", "middleware.ts"],
      exclude: [
        "**/*.test.*",
        "**/__tests__/**",
        "lib/mocks/**",
        "lib/types/**",
        "lib/db/auth-schema.ts",
        "app/**/*.css",
        "app/**/__tests__/**",
        "components/ui/**",
        "**/*.d.ts",
        "node_modules/**",
        "tests/**"
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
