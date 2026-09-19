import { a as mergeConfigs, o as subsetConfig, r as compileToSource } from "./compiler2.js";
import { o as getDefaultCnConfig } from "./config2.js";
import { mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

//#region src/build.ts
const DEFAULT_CONTENT = ["**/*.{js,jsx,ts,tsx,html,vue,svelte,astro,mdx}"];
const DEFAULT_OUT = "cn-tables.mjs";
const MAX_TOKEN_LENGTH = 8192;
const realpathOrNull = (path) => {
	try {
		return realpathSync(path);
	} catch {
		return null;
	}
};
const globToRegex = (pattern) => {
	let re = "";
	for (let i = 0; i < pattern.length; i++) {
		const c = pattern[i];
		if (c === "*") {
			if (pattern[i + 1] === "*") {
				re += "(?:.*)";
				i++;
				if (pattern[i + 1] === "/") {
					re += "/?";
					i++;
				}
			} else re += "[^/]*";
		} else if (c === "?") re += "[^/]";
		else if (c === "{") {
			const end = pattern.indexOf("}", i);
			if (end === -1) throw new Error("unclosed { in glob: " + pattern);
			re += "(?:" + pattern.slice(i + 1, end).split(",").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")";
			i = end;
		} else if (".+^$()|[]\\".includes(c)) re += "\\" + c;
		else re += c;
	}
	return new RegExp("^" + re + "$");
};
const IGNORED_DIRS = /* @__PURE__ */ new Set([
	"node_modules",
	".git",
	"dist",
	"build",
	".next",
	".nuxt",
	"out",
	"coverage",
	".svelte-kit",
	".astro",
	".vercel",
	".output"
]);
const literalPrefix = (pattern) => {
	const segs = pattern.split("/");
	const keep = [];
	for (const s of segs) {
		if (/[*?{]/.test(s)) break;
		keep.push(s);
	}
	return keep.join("/");
};
const walk = (dir, rel, out, optIn, ancestors, state) => {
	let real;
	try {
		real = realpathSync(dir);
	} catch {
		state.skippedUnreadable++;
		return;
	}
	if (ancestors.has(real)) return;
	ancestors.add(real);
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		state.skippedUnreadable++;
		ancestors.delete(real);
		return;
	}
	for (const e of entries) {
		const childRel = rel ? rel + "/" + e.name : e.name;
		const childAbs = join(dir, e.name);
		let isDir = e.isDirectory();
		let isFile = e.isFile();
		if (e.isSymbolicLink()) try {
			const st = statSync(childAbs);
			isDir = st.isDirectory();
			isFile = st.isFile();
		} catch {
			continue;
		}
		if (isDir) {
			if (e.name === ".git") continue;
			if ((IGNORED_DIRS.has(e.name) || e.name.startsWith(".")) && !optIn.some((p) => p === childRel || p.startsWith(childRel + "/"))) continue;
			walk(childAbs, childRel, out, optIn, ancestors, state);
		} else if (isFile) out.push(childRel);
	}
	ancestors.delete(real);
};
/**
* Expand content globs to absolute file paths. Patterns support `**`, `?`,
* and `{a,b}`; a pattern without glob characters is a literal file or
* directory. Ignored directories such as `node_modules` and dot-directories
* are entered only when a pattern names them.
*/
const expandGlobs = (patterns, cwd, state = { skippedUnreadable: 0 }) => {
	const files = /* @__PURE__ */ new Set();
	let allFiles = null;
	const optIn = patterns.map((raw) => literalPrefix(raw.replace(/\\/g, "/").replace(/^\.\//, ""))).filter(Boolean);
	for (const raw of patterns) {
		const pattern = raw.replace(/\\/g, "/").replace(/^\.\//, "");
		if (!/[*?{]/.test(pattern)) {
			const p = resolve(cwd, pattern);
			let st;
			try {
				st = statSync(p);
			} catch {
				continue;
			}
			if (st.isFile()) files.add(p);
			else if (st.isDirectory()) {
				const sub = [];
				walk(p, "", sub, [], /* @__PURE__ */ new Set(), state);
				for (const f of sub) files.add(join(p, f.split("/").join(sep)));
			}
			continue;
		}
		if (allFiles === null) {
			allFiles = [];
			walk(cwd, "", allFiles, optIn, /* @__PURE__ */ new Set(), state);
		}
		const re = globToRegex(pattern);
		for (const f of allFiles) if (re.test(f)) files.add(resolve(cwd, f.split("/").join(sep)));
	}
	return [...files];
};
/**
* Build a predicate that tells whether an absolute path would be scanned by
* `expandGlobs` with the same patterns: it applies the same literal-path,
* glob, and ignored-directory rules without touching the filesystem.
*/
const createContentMatcher = (patterns, cwd) => {
	const normalized = patterns.map((raw) => raw.replace(/\\/g, "/").replace(/^\.\//, ""));
	const optIn = normalized.map(literalPrefix).filter(Boolean);
	const literals = normalized.filter((p) => !/[*?{]/.test(p));
	const regexes = normalized.filter((p) => /[*?{]/.test(p)).map(globToRegex);
	const isPruned = (rel) => {
		const segs = rel.split("/");
		let path = "";
		for (let i = 0; i < segs.length - 1; i++) {
			const name = segs[i];
			path = path ? path + "/" + name : name;
			if (name === ".git") return true;
			if (IGNORED_DIRS.has(name) || name.startsWith(".")) {
				const dir = path;
				if (!optIn.some((p) => p === dir || p.startsWith(dir + "/"))) return true;
			}
		}
		return false;
	};
	return (file) => {
		const rel = relative(cwd, file).split(sep).join("/");
		if (!rel || rel.startsWith("../") || rel === "..") return false;
		for (const lit of literals) if (rel === lit || rel.startsWith(lit + "/")) return true;
		if (isPruned(rel)) return false;
		return regexes.some((re) => re.test(rel));
	};
};
const CANDIDATE_RE = /[^<>"'`\s]*[^<>"'`\s:]/g;
/**
* Add every class-name candidate in `text` to `into`. Returns the number of
* candidates skipped for exceeding the length cap.
*/
const extractTokens = (text, into) => {
	const matches = text.match(CANDIDATE_RE);
	if (!matches) return 0;
	let skippedLong = 0;
	for (const m of matches) {
		if (m.length === 0) continue;
		if (m.length > MAX_TOKEN_LENGTH) {
			skippedLong++;
			continue;
		}
		into.add(m);
	}
	return skippedLong;
};
const readText = (path, what, shown) => {
	try {
		return readFileSync(path, "utf8");
	} catch (err) {
		throw new Error(`cannot read ${what} ${shown}: ${err.message}`, { cause: err });
	}
};
const addWords = (text, into) => {
	for (const t of text.split(/\s+/)) if (t) into.add(t);
};
const loadConfig = async (cwd, file) => {
	let mod;
	try {
		mod = await import(pathToFileURL(resolve(cwd, file)).href);
	} catch (err) {
		throw new Error(`cannot load config ${file}: ${err.message}`, { cause: err });
	}
	const ext = mod.default ?? mod.config;
	if (!ext) throw new Error(`config file ${file} has no default export`);
	return ext;
};
/**
* Compile project-fitted merge tables and write them to `out`. This is what
* `cn build` runs. Throws on bad input with the same messages the CLI prints;
* non-fatal problems come back in `warnings`.
*/
const build = async (options = {}) => {
	const cwd = options.cwd ?? process.cwd();
	const out = options.out ?? DEFAULT_OUT;
	const outPath = resolve(cwd, out);
	const warnings = [];
	let config = getDefaultCnConfig();
	if (options.config) {
		const ext = await loadConfig(cwd, options.config);
		config = typeof ext === "function" ? ext(config) : mergeConfigs(config, ext);
	}
	const tokens = /* @__PURE__ */ new Set();
	let scannedFiles = 0;
	if (!options.full) {
		if (options.tokens) addWords(readText(resolve(cwd, options.tokens), "tokens file", options.tokens), tokens);
		else {
			const patterns = options.content?.length ? options.content : DEFAULT_CONTENT;
			const state = { skippedUnreadable: 0 };
			let skippedLong = 0;
			const outRealPath = realpathOrNull(outPath);
			const files = expandGlobs(patterns, cwd, state).filter((file) => file !== outPath && (outRealPath === null || realpathOrNull(file) !== outRealPath));
			if (files.length === 0) throw new Error("no files matched the content globs; pass --content or use --full");
			for (const f of files) try {
				skippedLong += extractTokens(readFileSync(f, "utf8"), tokens);
				scannedFiles++;
			} catch {
				state.skippedUnreadable++;
			}
			if (state.skippedUnreadable > 0) warnings.push(`skipped ${state.skippedUnreadable} unreadable path(s)`);
			if (skippedLong > 0) warnings.push(`skipped ${skippedLong} candidate token(s) longer than ${MAX_TOKEN_LENGTH} chars`);
		}
		if (options.safelist) addWords(readText(resolve(cwd, options.safelist), "safelist", options.safelist), tokens);
	}
	const fullConfig = config;
	let usedGroups = null;
	let totalGroups = null;
	if (!options.full) {
		const r = subsetConfig(config, tokens);
		config = r.config;
		usedGroups = r.usedGroups;
		totalGroups = r.totalGroups;
	}
	const lang = outPath.endsWith(".ts") ? "ts" : "js";
	const banner = `// GENERATED by \`cn build\` — do not edit.
// Pair with createCn from "cn/engine":
//   import tables from "./${basename(outPath)}"
//   import { createCn } from "cn/engine"
//   export const cn = createCn(tables)`;
	const source = compileToSource(config, {
		lang,
		banner
	});
	let changed;
	try {
		changed = readFileSync(outPath, "utf8") !== source;
	} catch {
		changed = true;
	}
	if (changed) try {
		mkdirSync(dirname(outPath), { recursive: true });
		writeFileSync(outPath, source);
	} catch (err) {
		throw new Error(`cannot write ${out}: ${err.message}`, { cause: err });
	}
	return {
		/** Absolute path of the written module. */
		outPath,
		/** The emitted module source. */
		source,
		/** False when the file already held this exact source and was left alone. */
		changed,
		/** Candidate tokens the subset was fitted to. Empty with `full`. */
		tokens,
		/** The config the tables were compiled from, after subsetting. */
		config,
		/** The config before subsetting, with any extension applied. */
		fullConfig,
		/** Files read during the scan. Zero with `tokens` or `full`. */
		scannedFiles,
		/** Class groups kept, or null with `full`. */
		usedGroups,
		/** Class groups in the config, or null with `full`. */
		totalGroups,
		/** Non-fatal problems, in the words the CLI prints. */
		warnings
	};
};
/**
* A `build()` that knows when to run again. `run()` builds, coalescing
* concurrent calls into one in-flight build plus at most one follow-up.
* `changed(file)` is for watchers: it rebuilds only when the file is inside
* the content globs and uses a class group the last build dropped.
* Deleted files never need a rebuild, since a subset fitted to more classes
* is still correct. With `full` or `tokens` the tables don't depend on
* sources, so `changed` never rebuilds.
*/
const createBuilder = (options = {}) => {
	const cwd = options.cwd ?? process.cwd();
	const matches = createContentMatcher(options.content?.length ? options.content : DEFAULT_CONTENT, cwd);
	let last = null;
	let running = null;
	let queued = false;
	const run = () => {
		if (running) {
			queued = true;
			return running;
		}
		running = build(options).then((result) => {
			last = result;
			running = null;
			if (queued) {
				queued = false;
				return run();
			}
			return result;
		}, (err) => {
			running = null;
			queued = false;
			throw err;
		});
		return running;
	};
	const changed = async (file) => {
		if (!last) return run();
		if (options.full || options.tokens) return last;
		const abs = resolve(cwd, file);
		if (abs === last.outPath || !matches(abs)) return last;
		let text;
		try {
			text = readFileSync(abs, "utf8");
		} catch {
			return last;
		}
		const fresh = /* @__PURE__ */ new Set();
		extractTokens(text, fresh);
		for (const t of last.tokens) fresh.delete(t);
		if (fresh.size === 0) return last;
		const reached = subsetConfig(last.fullConfig, fresh).config.classGroups;
		for (const group in reached) if (!(group in last.config.classGroups)) return run();
		return last;
	};
	return {
		run,
		changed,
		/** Result of the most recent completed build, or null before the first. */
		get last() {
			return last;
		}
	};
};

//#endregion
export { build, createBuilder, createContentMatcher, expandGlobs, extractTokens };