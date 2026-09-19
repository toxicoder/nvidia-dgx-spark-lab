import plugin from "tailwindcss/plugin";
//#region src/typography/index.d.ts
export interface Options {
  className?: string;
  /**
   * Disable custom table styles
   */
  disableRoundedTable?: boolean;
}
export declare const typography: ReturnType<typeof plugin.withOptions<Options>>;
//#endregion
export { typography as default };