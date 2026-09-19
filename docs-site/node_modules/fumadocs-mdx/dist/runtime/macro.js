import { server, toFumadocsSource } from "./server.js";
import { createElement, use } from "react";
//#region src/runtime/macro.ts
function create() {
	return server();
}
function normalize(file) {
	file = file.replaceAll("\\", "/");
	return file.startsWith("./") ? file.slice(2) : file;
}
function accessor(entries) {
	return {
		entries,
		get(path) {
			path = normalize(path);
			return entries.find((entry) => entry.info.path === path);
		}
	};
}
/**
* annotate promise state in the convention understood by React `use()`, so settled promises are unwrapped without suspending.
*/
function track(promise) {
	const tracked = promise;
	tracked.status = "pending";
	promise.then((value) => {
		tracked.status = "fulfilled";
		tracked.value = value;
	}, (reason) => {
		tracked.status = "rejected";
		tracked.reason = reason;
	});
	return tracked;
}
const eagerPreload = async () => {};
function withPreload(entries) {
	return entries.map((entry) => ({
		...entry,
		preload: eagerPreload
	}));
}
function asyncEntries(raw) {
	return raw.map((entry) => {
		let promise;
		const load = () => promise ??= track(entry.load());
		function Body(props) {
			const loaded = load();
			const data = loaded.status === "fulfilled" ? loaded.value : use(loaded);
			return createElement(data.body, props);
		}
		return {
			...entry,
			load,
			async preload() {
				await load();
			},
			body: Body
		};
	});
}
async function doc(args) {
	const entries = withPreload(await create().doc("doc", args.base, args.entries));
	return {
		...accessor(entries),
		toFumadocsSource(options) {
			return toFumadocsSource(entries, [], options);
		}
	};
}
async function docAsync(args) {
	const entries = asyncEntries(await create().docLazy("doc", args.base, args.head, args.body));
	return {
		...accessor(entries),
		toFumadocsSource(options) {
			return toFumadocsSource(entries, [], options);
		}
	};
}
async function meta(args) {
	return accessor(await create().meta("meta", args.base, args.entries));
}
async function docs(args) {
	const instance = create();
	const [rawDocEntries, metaEntries] = await Promise.all([instance.doc("doc", args.base, args.entries), instance.meta("meta", args.base, args.meta)]);
	const docEntries = withPreload(rawDocEntries);
	const getDoc = accessor(docEntries);
	const getMeta = accessor(metaEntries);
	return {
		docs: docEntries,
		meta: metaEntries,
		getPage: getDoc.get,
		getMeta: getMeta.get,
		toFumadocsSource(options) {
			return toFumadocsSource(docEntries, metaEntries, options);
		}
	};
}
async function docsAsync(args) {
	const instance = create();
	const [rawDocEntries, metaEntries] = await Promise.all([instance.docLazy("doc", args.base, args.head, args.body), instance.meta("meta", args.base, args.meta)]);
	const docEntries = asyncEntries(rawDocEntries);
	const getDoc = accessor(docEntries);
	const getMeta = accessor(metaEntries);
	return {
		docs: docEntries,
		meta: metaEntries,
		getPage: getDoc.get,
		getMeta: getMeta.get,
		toFumadocsSource(options) {
			return toFumadocsSource(docEntries, metaEntries, options);
		}
	};
}
//#endregion
export { doc, docAsync, docs, docsAsync, meta };
