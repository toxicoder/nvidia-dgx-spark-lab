import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

/**
 * Strong-types lint profile.
 *
 * The rules below are type-aware, so they need the TypeScript program. Without
 * `projectService` the `no-unsafe-*` family silently cannot run, which is how
 * `as unknown as` escapes and unhandled promise rejections survived the previous
 * config (its only rule was `no-explicit-any`).
 *
 * Deliberately off, with reasons:
 *  - `@typescript-eslint/require-await`: Next.js requires `async` on route
 *    handlers and server actions that legitimately have nothing to await.
 *  - `@typescript-eslint/prefer-nullish-coalescing`: switching `||` to `??`
 *    changes behaviour wherever `0`, `""`, or `false` is a meaningful value. That
 *    is a behaviour migration, not a typing pass, and it is tracked separately.
 */
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
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // No broad types.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-enum-comparison": "error",
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/no-invalid-void-type": "error",
      "@typescript-eslint/no-redundant-type-constituents": "error",

      // Casts must be assertions of a known type, never a way out of checking.
      "@typescript-eslint/consistent-type-assertions": "error",

      // A Promise that nobody awaits is a swallowed failure.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",

      // Only throw things that are actually errors.
      "@typescript-eslint/only-throw-error": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_"
        }
      ]
    }
  },
  {
    // shadcn-generated primitives: regenerate upstream rather than hand-edit, so
    // the promise-variance and unused-import findings here are reported upstream.
    files: ["components/ui/**"],
    rules: {
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unused-vars": "off"
    }
  }
];

export default eslintConfig;
