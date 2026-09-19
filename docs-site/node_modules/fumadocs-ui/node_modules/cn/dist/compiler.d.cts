import { Tables, ValidatorImpls } from "./types.cjs";

//#region src/compiler.d.ts
type ClassGroupDef = string | {
  $v: string;
} | {
  $t: string;
} | ((value: string) => boolean) | {
  [key: string]: readonly ClassGroupDef[];
};
interface CnConfig {
  theme: Record<string, ClassGroupDef[]>;
  classGroups: Record<string, ClassGroupDef[]>;
  conflictingClassGroups: Record<string, readonly string[]>;
  conflictingClassGroupModifiers: Record<string, readonly string[]>;
  orderSensitiveModifiers: string[];
  postfixLookupClassGroups?: readonly string[];
  prefix?: string;
}
type ConfigExtensionGroups = {
  theme: Record<string, readonly ClassGroupDef[]>;
  classGroups: Record<string, readonly ClassGroupDef[]>;
  conflictingClassGroups: Record<string, readonly string[]>;
  conflictingClassGroupModifiers: Record<string, readonly string[]>;
  orderSensitiveModifiers: readonly string[];
};
interface ConfigExtension {
  prefix?: string;
  cacheSize?: number;
  override?: Partial<ConfigExtensionGroups>;
  extend?: Partial<ConfigExtensionGroups>;
}
/**
 * Accepted config input: an `{ extend, override, prefix }` extension, a
 * `(defaultConfig) => config` transform, or a complete config. Lives here
 * (not in config.ts) so the `index` entry can re-export it without pulling
 * config.ts into a shared declaration chunk that collides with the
 * `cn/config` entry's own d.ts filename.
 */
type CreateCnInput = ConfigExtension | ((config: CnConfig) => CnConfig) | CnConfig;
declare const mergeConfigs: (base: CnConfig, extension: ConfigExtension) => CnConfig;
interface SubsetResult {
  config: CnConfig;
  usedGroups: number;
  totalGroups: number;
}
declare const subsetConfig: (base: CnConfig, tokens: Iterable<string>) => SubsetResult;
interface CompiledModel {
  G: number;
  customNames: string[];
  impls: ValidatorImpls;
  edgeCounts: Int32Array;
  edgeLabelLen: Int32Array;
  labelText: string;
  edgeTargetActual: number[];
  nodeGroup: Int32Array;
  nodeVlist: Int32Array;
  nodeCount: number;
  totalEdges: number;
  patCounts: number[];
  patOps: number[];
  listPat: number[];
  vlistGroup: Int32Array;
  litEntries: {
    anchor: number;
    tail: string;
    gid: number;
  }[];
  sets: string[][];
  attachments: {
    anchor: number;
    gid: number;
    set: number;
  }[];
  uniqueTailCount: number;
  adjGid: number[];
  adjCnt: number[];
  adjTgt: number[];
  patGid: number[];
  patTgt: number[];
  postfixLookup: number[];
  orderSensitiveModifiers: string;
  prefix?: string;
}
declare const compileModel: (config: CnConfig) => CompiledModel;
interface CompiledTables {
  tables: Tables;
  validatorImpls: ValidatorImpls;
  prefix?: string;
}
declare const compileToTables: (config: CnConfig) => CompiledTables;
interface EmitOptions {
  /** 'ts' annotates decoder helpers; 'js' emits plain JS (default 'js') */
  lang?: "ts" | "js";
  banner?: string;
}
declare const compileToSource: (config: CnConfig, options?: EmitOptions) => string;
interface CompileStats {
  groups: number;
  nodes: number;
  edges: number;
  liftedLiterals: number;
  uniqueTails: number;
  vlists: number;
}
declare const compileStats: (config: CnConfig) => CompileStats;
//#endregion
export { ClassGroupDef, CnConfig, CompileStats, CompiledTables, ConfigExtension, CreateCnInput, EmitOptions, SubsetResult, compileModel, compileStats, compileToSource, compileToTables, mergeConfigs, subsetConfig };