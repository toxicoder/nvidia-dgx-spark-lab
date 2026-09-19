import { ClassArray, ClassDictionary, ClassNameArray, ClassNameValue, ClassValue, CnFunction, Engine, EngineOptions, Tables, ValidatorImpls } from "./types.js";
import { CnConfig, ConfigExtension, CreateCnInput } from "./compiler.js";
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