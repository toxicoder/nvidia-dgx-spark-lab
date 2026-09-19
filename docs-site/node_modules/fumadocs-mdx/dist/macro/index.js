//#region src/macro/index.ts
function macroError() {
	return /* @__PURE__ */ new Error("[MDX] this macro was not compiled by the bundler plugin of `fumadocs-mdx`. To use `fumadocs-mdx/macro`, set the `include` option on your bundler plugin, and make sure this module matches its patterns.");
}
/**
* Define a docs collection (doc + meta), compiled by the bundler plugin.
*
* Requires the `include` option on your bundler plugin.
*/
function defineDocs(options) {
	throw macroError();
}
/**
* Define a doc/meta collection, compiled by the bundler plugin.
*
* Requires the `include` option on your bundler plugin.
*/
function defineCollections() {
	throw macroError();
}
//#endregion
export { defineCollections, defineDocs };
