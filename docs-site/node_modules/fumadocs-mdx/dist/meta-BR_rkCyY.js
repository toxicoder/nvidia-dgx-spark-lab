import { z } from "zod";
import { parse } from "yaml";
//#region src/loaders/meta.ts
const querySchema = z.looseObject({
	collection: z.string().optional(),
	workspace: z.string().optional(),
	macro_id: z.string().optional()
});
/**
* load meta files, fallback to bundler's built-in plugins when ?collection is unspecified.
*/
function createMetaLoader({ getCore }, resolve = {}) {
	const { json: resolveJson = "js" } = resolve;
	function parse$1(filePath, source) {
		try {
			if (filePath.endsWith(".json")) return JSON.parse(source);
			if (filePath.endsWith(".yaml")) return parse(source);
		} catch (e) {
			throw new Error(`invalid data in ${filePath}`, { cause: e });
		}
		throw new Error("Unknown file type " + filePath);
	}
	function onMeta(source, { filePath, query, compiler }) {
		const parsed = querySchema.safeParse(query);
		if (!parsed.success) return null;
		const { collection: collectionName, workspace, macro_id: macroId } = parsed.data;
		if (!collectionName && macroId === void 0) return null;
		return async () => {
			let core = await getCore();
			const macro = core.macro;
			if (workspace) core = core.getWorkspaces().get(workspace) ?? core;
			let metaCollection;
			if (macro && macroId !== void 0) {
				const resolved = await macro.resolve(macroId);
				for (const input of resolved.inputs) compiler.addDependency(input);
				const item = resolved.collection;
				if (item.type === "docs") metaCollection = item.meta;
				else if (item.type === "meta") metaCollection = item;
			} else if (collectionName) {
				const collection = core.getCollection(collectionName);
				switch (collection?.type) {
					case "meta":
						metaCollection = collection;
						break;
					case "docs": metaCollection = collection.meta;
				}
			}
			const data = parse$1(filePath, source);
			if (!metaCollection) return data;
			return core.transformMeta({
				collection: metaCollection,
				filePath,
				source
			}, data);
		};
	}
	return {
		async load(input) {
			const result = onMeta(await input.getSource(), input);
			if (result === null) return null;
			const data = await result();
			if (input.filePath.endsWith(".json")) return {
				moduleType: resolveJson,
				code: resolveJson === "json" ? JSON.stringify(data) : `export default ${JSON.stringify(data)}`
			};
			else return {
				moduleType: "js",
				code: `export default ${JSON.stringify(data)}`
			};
		},
		bun: { load(source, input) {
			const result = onMeta(source, input);
			if (result === null) return {
				loader: "object",
				exports: parse$1(input.filePath, source)
			};
			return result().then((data) => ({
				loader: "object",
				exports: { default: data }
			}));
		} }
	};
}
//#endregion
export { createMetaLoader as t };
