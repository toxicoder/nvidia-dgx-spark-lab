//#region src/utils/url.tsx
/**
* The base path (Vite)
*/
const BASE_PATH = typeof import.meta.env !== "undefined" && typeof import.meta.env.BASE_URL === "string" ? import.meta.env.BASE_URL : "/";
function join(...paths) {
	let out = "";
	for (let p of paths) {
		if (out.length > 0) {
			if (p.startsWith("/")) p = p.slice(1);
			if (!out.endsWith("/")) out += "/";
		}
		out += p;
	}
	return out;
}
/**
* normalize URL into the Fumadocs standard form (`/slug-1/slug-2`).
*
* This includes URLs with trailing slashes.
*/
function normalizeUrl(url) {
	if (url.startsWith("http://") || url.startsWith("https://")) return url;
	if (!url.startsWith("/")) url = "/" + url;
	if (url.length > 1 && url.endsWith("/")) url = url.slice(0, -1);
	return url;
}
//#endregion
export { join as n, normalizeUrl as r, BASE_PATH as t };
