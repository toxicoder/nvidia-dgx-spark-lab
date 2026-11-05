import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    // Generated trees. ESLint's defaults skip only node_modules, so the istanbul HTML
    // report that the coverage run writes before lint would be linted on every CI pass
    // (its vendored sorter/prettify scripts each raise an unused-directive warning).
    ignores: ["coverage/**", ".next/**"]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint.plugin
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error"
    }
  }
];

export default eslintConfig;
