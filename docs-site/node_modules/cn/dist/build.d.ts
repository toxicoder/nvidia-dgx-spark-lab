import { n as CnConfig } from "./compiler2.js";

//#region src/build.d.ts

/**
 * Expand content globs to absolute file paths. Patterns support `**`, `?`,
 * and `{a,b}`; a pattern without glob characters is a literal file or
 * directory. Ignored directories such as `node_modules` and dot-directories
 * are entered only when a pattern names them.
 */
declare const expandGlobs: (patterns: readonly string[], cwd: string, state?: {
  skippedUnreadable: number;
}) => string[];
/**
 * Build a predicate that tells whether an absolute path would be scanned by
 * `expandGlobs` with the same patterns: it applies the same literal-path,
 * glob, and ignored-directory rules without touching the filesystem.
 */
declare const createContentMatcher: (patterns: readonly string[], cwd: string) => (file: string) => boolean;
/**
 * Add every class-name candidate in `text` to `into`. Returns the number of
 * candidates skipped for exceeding the length cap.
 */
declare const extractTokens: (text: string, into: Set<string>) => number;
/**
 * Compile project-fitted merge tables and write them to `out`. This is what
 * `cn build` runs. Throws on bad input with the same messages the CLI prints;
 * non-fatal problems come back in `warnings`.
 */
declare const build: (options?: {
  /** Base directory for every other path. Default: `process.cwd()`. */
  cwd?: string;
  /** Source globs to scan. Default: `**\/*.{js,jsx,ts,tsx,html,vue,svelte,astro,mdx}`. */
  content?: readonly string[];
  /** Output module path. A `.ts` extension emits TypeScript. Default: `cn-tables.mjs`. */
  out?: string;
  /** File of extra class names, whitespace-separated. */
  safelist?: string;
  /** Config extension module: default export `{ extend, override, prefix }` or `(config) => config`. */
  config?: string;
  /** File of pre-extracted tokens; skips scanning. */
  tokens?: string;
  /** Keep every class group instead of subsetting to the scanned tokens. */
  full?: boolean;
}) => Promise<{
  /** Absolute path of the written module. */
  outPath: string;
  /** The emitted module source. */
  source: string;
  /** False when the file already held this exact source and was left alone. */
  changed: boolean;
  /** Candidate tokens the subset was fitted to. Empty with `full`. */
  tokens: Set<string>;
  /** The config the tables were compiled from, after subsetting. */
  config: CnConfig;
  /** The config before subsetting, with any extension applied. */
  fullConfig: CnConfig;
  /** Files read during the scan. Zero with `tokens` or `full`. */
  scannedFiles: number;
  /** Class groups kept, or null with `full`. */
  usedGroups: number | null;
  /** Class groups in the config, or null with `full`. */
  totalGroups: number | null;
  /** Non-fatal problems, in the words the CLI prints. */
  warnings: string[];
}>;
/**
 * A `build()` that knows when to run again. `run()` builds, coalescing
 * concurrent calls into one in-flight build plus at most one follow-up.
 * `changed(file)` is for watchers: it rebuilds only when the file is inside
 * the content globs and uses a class group the last build dropped.
 * Deleted files never need a rebuild, since a subset fitted to more classes
 * is still correct. With `full` or `tokens` the tables don't depend on
 * sources, so `changed` never rebuilds.
 */
declare const createBuilder: (options?: Parameters<typeof build>[0]) => {
  run: () => Promise<Awaited<ReturnType<typeof build>>>;
  changed: (file: string) => Promise<{
    /** Absolute path of the written module. */
    outPath: string;
    /** The emitted module source. */
    source: string;
    /** False when the file already held this exact source and was left alone. */
    changed: boolean;
    /** Candidate tokens the subset was fitted to. Empty with `full`. */
    tokens: Set<string>;
    /** The config the tables were compiled from, after subsetting. */
    config: CnConfig;
    /** The config before subsetting, with any extension applied. */
    fullConfig: CnConfig;
    /** Files read during the scan. Zero with `tokens` or `full`. */
    scannedFiles: number;
    /** Class groups kept, or null with `full`. */
    usedGroups: number | null;
    /** Class groups in the config, or null with `full`. */
    totalGroups: number | null;
    /** Non-fatal problems, in the words the CLI prints. */
    warnings: string[];
  }>;
  /** Result of the most recent completed build, or null before the first. */
  readonly last: {
    /** Absolute path of the written module. */
    outPath: string;
    /** The emitted module source. */
    source: string;
    /** False when the file already held this exact source and was left alone. */
    changed: boolean;
    /** Candidate tokens the subset was fitted to. Empty with `full`. */
    tokens: Set<string>;
    /** The config the tables were compiled from, after subsetting. */
    config: CnConfig;
    /** The config before subsetting, with any extension applied. */
    fullConfig: CnConfig;
    /** Files read during the scan. Zero with `tokens` or `full`. */
    scannedFiles: number;
    /** Class groups kept, or null with `full`. */
    usedGroups: number | null;
    /** Class groups in the config, or null with `full`. */
    totalGroups: number | null;
    /** Non-fatal problems, in the words the CLI prints. */
    warnings: string[];
  } | null;
};
//#endregion
export { build, createBuilder, createContentMatcher, expandGlobs, extractTokens };