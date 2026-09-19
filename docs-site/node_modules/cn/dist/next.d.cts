import { createBuilder } from "./build.cjs";

//#region src/next.d.ts
declare const withCn: <T extends object>(nextConfig?: T | ((phase: string, context: unknown) => T | Promise<T>), options?: Parameters<typeof createBuilder>[0]) => (phase: string, context: unknown) => Promise<T>;
//#endregion
export { withCn };