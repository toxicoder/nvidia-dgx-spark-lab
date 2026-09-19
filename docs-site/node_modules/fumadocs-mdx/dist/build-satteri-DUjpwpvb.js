import { t as resolveLastModified } from "./last-modified-BkZYFKSh.js";
import { pathToFileURL } from "node:url";
//#region src/loaders/mdx/build-satteri.ts
async function buildSatteriMDX(core, collection, { filePath, frontmatter, source, _compiler, environment, isDevelopment }) {
	const satteriOptions = await getSatteriOptions(core.getConfig(), collection, environment);
	const format = filePath.endsWith(".mdx") ? "mdx" : "md";
	const postprocess = {
		_format: format,
		...collection?.postprocess
	};
	const [{ compileMdx }, { remarkLlms }, { remarkInclude }] = await Promise.all([
		import(
			/* turbopackOptional: true */
			"@fumadocs/satteri/compile"
),
		import(
			/* turbopackOptional: true */
			"@fumadocs/satteri/remark-llms"
),
		import(
			/* turbopackOptional: true */
			"@fumadocs/satteri/remark-include"
)
	]);
	const data = {
		frontmatter,
		_compiler,
		_cwd: collection?.cwd,
		_valueToExport: collection?.postprocess?.valueToExport
	};
	const mdastPlugins = [remarkInclude({ cwd: collection?.cwd })];
	if (satteriOptions.mdastPlugins) mdastPlugins.push(...satteriOptions.mdastPlugins);
	if (postprocess.includeProcessedMarkdown) mdastPlugins.push(remarkLlms(typeof postprocess.includeProcessedMarkdown === "object" ? postprocess.includeProcessedMarkdown : void 0));
	mdastPlugins.push(postprocessPlugin(postprocess, await resolveLastModified(collection, filePath)));
	return { code: (await compileMdx({
		source,
		filePath,
		format,
		frontmatter,
		isDevelopment,
		environment,
		options: {
			...satteriOptions,
			fileURL: pathToFileURL(filePath),
			data,
			mdastPlugins
		}
	})).code };
}
function postprocessPlugin({ extractLinkReferences = false }, lastModified) {
	return {
		name: "remark-postprocess",
		before(_root, ctx) {
			if (extractLinkReferences) ctx.data.extractedReferences ??= [];
		},
		heading(node, ctx) {
			const frontmatter = ctx.data.frontmatter ??= {};
			if (!frontmatter.title && node.depth === 1) frontmatter.title = ctx.textContent(node);
		},
		link(node, ctx) {
			if (extractLinkReferences) ctx.data.extractedReferences.push({ href: node.url });
		},
		collectExports({ data, addExport }) {
			if (extractLinkReferences) addExport("extractedReferences", JSON.stringify(data.extractedReferences));
			if (lastModified) addExport("lastModified", `new Date(${lastModified.getTime()})`);
		}
	};
}
const satteriOptionsCache = /* @__PURE__ */ new WeakMap();
async function resolvePresetOptions(input, environment) {
	const options = typeof input === "function" ? await input(environment) : input;
	const { applySatteriPreset } = await import(
		/* turbopackOptional: true */
		"@fumadocs/satteri/preset"
);
	return applySatteriPreset(options)(environment);
}
function getSatteriOptions(config, collection, environment = "bundler") {
	let cache = satteriOptionsCache.get(config);
	if (!cache) {
		cache = /* @__PURE__ */ new Map();
		satteriOptionsCache.set(config, cache);
	}
	const key = collection ? `${environment}:${collection.name}` : environment;
	const cached = cache.get(key);
	if (cached) return cached;
	let result;
	if (collection?.compiler === "satteri") result = resolvePresetOptions(collection.satteriOptions ?? config.global.satteriOptions, environment);
	else if (collection) throw new Error(`Collection "${collection.name}" uses the default MDX compiler. Use getMDXOptions() instead of getSatteriOptions().`);
	else result = resolvePresetOptions(config.global.satteriOptions, environment);
	cache.set(key, result);
	return result;
}
//#endregion
export { buildSatteriMDX };
