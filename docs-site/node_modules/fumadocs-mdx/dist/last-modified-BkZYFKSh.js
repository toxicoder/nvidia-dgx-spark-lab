import path from "node:path";
import { x } from "tinyexec";
//#region src/loaders/mdx/last-modified.ts
const cache = /* @__PURE__ */ new Map();
/**
* Resolve the `lastModified` collection option for a document.
*
* @returns `undefined` when the collection didn't opt in, or the date is unknown.
*/
async function resolveLastModified(collection, filePath) {
	const option = collection?.lastModified;
	if (!option) return;
	if (typeof option === "function") return await option(filePath) ?? void 0;
	return (await getGitTimestamps(collection.cwd, collection.dir)).get(path.resolve(collection.cwd, filePath));
}
function getGitTimestamps(cwd, dir) {
	const cached = cache.get(dir);
	if (cached) return cached;
	const promise = (async () => {
		const timestamps = /* @__PURE__ */ new Map();
		const root = await x("git", ["rev-parse", "--show-toplevel"], { nodeOptions: { cwd } });
		if (root.exitCode !== 0) return timestamps;
		const out = await x("git", [
			"-c",
			"core.quotepath=off",
			"log",
			"--format=commit:%aI",
			"--name-only",
			"--",
			dir
		], { nodeOptions: { cwd } });
		if (out.exitCode !== 0) return timestamps;
		let date;
		for (const line of out.stdout.split("\n")) if (line.startsWith("commit:")) {
			const parsed = new Date(line.slice(7));
			date = isNaN(parsed.getTime()) ? void 0 : parsed;
		} else if (line.length > 0 && date) {
			const file = path.join(root.stdout.trim(), line);
			if (!timestamps.has(file)) timestamps.set(file, date);
		}
		return timestamps;
	})();
	cache.set(dir, promise);
	return promise;
}
//#endregion
export { resolveLastModified as t };
