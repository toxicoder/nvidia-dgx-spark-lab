import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
//#region src/config/define.ts
function defineCollections(options) {
	return options;
}
function defineDocs(options) {
	const dir = options.dir ?? "content/docs";
	return {
		type: "docs",
		dir,
		docs: defineCollections({
			type: "doc",
			dir,
			schema: pageSchema,
			...options?.docs
		}),
		meta: defineCollections({
			type: "meta",
			dir,
			schema: metaSchema,
			...options?.meta
		})
	};
}
function defineConfig(config = {}) {
	return config;
}
//#endregion
export { defineConfig as n, defineDocs as r, defineCollections as t };
