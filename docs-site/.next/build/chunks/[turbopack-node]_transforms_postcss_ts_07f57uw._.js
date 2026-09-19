module.exports = [
"[turbopack-node]/transforms/postcss.ts?config=[project]/docs-site/postcss.config.mjs { CONFIG => \"[project]/docs-site/postcss.config.mjs [postcss] (ecmascript)\" } [postcss] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "chunks/1sc1_0pal1md._.js",
  "chunks/[root-of-the-server]__04_ke-x._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[turbopack-node]/transforms/postcss.ts?config=[project]/docs-site/postcss.config.mjs { CONFIG => \"[project]/docs-site/postcss.config.mjs [postcss] (ecmascript)\" } [postcss] (ecmascript)");
    });
});
}),
];