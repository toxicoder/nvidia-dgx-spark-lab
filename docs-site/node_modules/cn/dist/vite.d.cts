import { createBuilder } from "./build.cjs";

//#region src/vite.d.ts
declare const cn: (options?: Parameters<typeof createBuilder>[0]) => {
  name: string;
  configResolved(config: {
    root: string;
  }): void;
  buildStart(): Promise<void>;
  watchChange(id: string, change: {
    event: string;
  }): Promise<void>;
};
//#endregion
export { cn };