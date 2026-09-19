import { NodeLoaderOptions } from "./index.js";
import { InitializeHook, LoadHook } from "node:module";
//#region src/node/_loader.d.ts
export declare const initialize: InitializeHook<NodeLoaderOptions>;
export declare const load: LoadHook;
//#endregion