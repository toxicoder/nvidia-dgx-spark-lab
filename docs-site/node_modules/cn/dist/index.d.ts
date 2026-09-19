import { a as ClassValue, c as EngineOptions, d as ValidatorImpls, i as ClassNameValue, n as ClassDictionary, o as CnFunction, r as ClassNameArray, s as Engine, t as ClassArray, u as Tables } from "./types2.js";
import { a as ConfigExtension, n as CnConfig, o as CreateCnInput } from "./compiler2.js";
import { clsx, createEngine, twJoin } from "./engine.js";

//#region src/index.d.ts
/**
 * Merge Tailwind CSS classes with clsx-style arguments (strings, arrays,
 * objects, conditionals). Drop-in replacement for `twMerge(clsx(...))`.
 */
declare const cn: CnFunction;
/** tailwind-merge–compatible variadic merge (strings + nested arrays). */
declare const twMerge: (...inputs: ClassNameValue[]) => string;
//#endregion
export { type ClassArray, type ClassDictionary, type ClassNameArray, type ClassNameValue, type ClassValue, type CnConfig, type CnFunction, type ConfigExtension, type CreateCnInput, type Engine, type EngineOptions, type Tables, type ValidatorImpls, clsx, cn, createEngine, twJoin, twMerge };