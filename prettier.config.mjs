/** @type {import("prettier").Config} */
export default {
  tabWidth: 2,
  printWidth: 120,
  singleQuote: false,
  trailingComma: "none",
  overrides: [
    {
      files: ["*.yaml", "*.yml"],
      options: {
        tabWidth: 2,
      },
    },
  ],
};