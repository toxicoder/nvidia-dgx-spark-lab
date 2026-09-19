//#region src/macro/options.d.ts
interface MacroOptions {
  /**
   * Patterns of modules that may use the macro API, relative to the project root.
   * `node_modules` is always excluded.
   *
   * @defaultValue all JS/TS files
   */
  include?: string | string[];
}
/**
 * `false` disables the macro API.
 */
type MacroPluginOption = MacroOptions | false;
interface ResolvedMacroOptions {
  include: string[];
  exclude: string[];
}
//#endregion
export { ResolvedMacroOptions as n, MacroPluginOption as t };