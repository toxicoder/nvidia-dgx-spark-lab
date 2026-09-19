import tables_generated_default from "./tables.js";
import { clsx, createEngine, twJoin, wrapClsx } from "./engine.js";

//#region src/index.ts
const instance = /* @__PURE__ */ createEngine(tables_generated_default);
/**
* Merge Tailwind CSS classes with clsx-style arguments (strings, arrays,
* objects, conditionals). Drop-in replacement for `twMerge(clsx(...))`.
*/
const cn = /* @__PURE__ */ wrapClsx(instance.mergeString, instance);
/** tailwind-merge–compatible variadic merge (strings + nested arrays). */
const twMerge = instance.merge;

//#endregion
export { clsx, cn, createEngine, twJoin, twMerge };