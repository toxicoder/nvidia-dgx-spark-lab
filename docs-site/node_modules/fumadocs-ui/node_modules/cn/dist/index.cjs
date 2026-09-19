Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
const require_tables = require('./tables.cjs');
const require_engine = require('./engine.cjs');

//#region src/index.ts
const instance = /* @__PURE__ */ require_engine.createEngine(require_tables);
/**
* Merge Tailwind CSS classes with clsx-style arguments (strings, arrays,
* objects, conditionals). Drop-in replacement for `twMerge(clsx(...))`.
*/
const cn = /* @__PURE__ */ require_engine.wrapClsx(instance.mergeString, instance);
/** tailwind-merge–compatible variadic merge (strings + nested arrays). */
const twMerge = instance.merge;

//#endregion
exports.clsx = require_engine.clsx;
exports.cn = cn;
exports.createEngine = require_engine.createEngine;
exports.twJoin = require_engine.twJoin;
exports.twMerge = twMerge;