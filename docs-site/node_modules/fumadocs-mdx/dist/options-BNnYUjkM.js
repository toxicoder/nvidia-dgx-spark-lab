import picomatch from "picomatch";
//#region src/macro/options.ts
const MacroModuleId = "fumadocs-mdx/macro";
/**
* One pattern per extension: brace expansion (`*.{js,ts}`) isn't understood by every glob engine
* these are handed to (Turbopack rule keys in particular).
*/
const DefaultInclude = [
	"**/*.js",
	"**/*.jsx",
	"**/*.mjs",
	"**/*.ts",
	"**/*.tsx",
	"**/*.mts"
];
const DefaultExclude = ["**/node_modules/**"];
function createMacroMatcher({ include, exclude }) {
	const isIncluded = picomatch(include, {
		basename: true,
		windows: true
	});
	const isExcluded = picomatch(exclude, { windows: true });
	return (path) => !isExcluded(path) && isIncluded(path);
}
/**
* @returns `undefined` when the macro API is disabled.
*/
function resolveMacroOptions(option) {
	if (option === false) return;
	const { include = DefaultInclude } = option ?? {};
	return {
		include: typeof include === "string" ? [include] : include,
		exclude: DefaultExclude
	};
}
//#endregion
export { createMacroMatcher as n, resolveMacroOptions as r, MacroModuleId as t };
