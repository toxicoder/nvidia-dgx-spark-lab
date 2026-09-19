import { a as ClassValue, c as EngineOptions, d as ValidatorImpls, i as ClassNameValue, l as FreshMerge, o as CnFunction, s as Engine, u as Tables } from "./types2.js";

//#region src/engine.d.ts
declare const createEngine: (T: Tables, validatorImpls?: ValidatorImpls, options?: EngineOptions) => Engine;
/** join-only, `twJoin`-compatible (strings + nested arrays, falsy skipped) */
declare const twJoin: (...inputs: ClassNameValue[]) => string;
/** join-only, `clsx`-compatible (no merging) */
declare const clsx: (...inputs: ClassValue[]) => string;
declare const wrapClsx: (mergeString: (input: string) => string, fresh?: FreshMerge) => CnFunction;
/**
 * Create a `cn` function bound to compiled tables — the entry point for
 * project-compiled (`cn build`) tables:
 *
 * ```ts
 * import tables from "./cn-tables.js"
 * import { createCn } from "cn/engine"
 * export const cn = createCn(tables)
 * ```
 */
declare const createCn: (tables: Tables, validatorImpls?: ValidatorImpls, options?: EngineOptions) => CnFunction;
//#endregion
export { clsx, createCn, createEngine, twJoin, wrapClsx };