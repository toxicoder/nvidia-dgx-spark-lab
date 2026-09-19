import { n as defineConfig, r as defineDocs, t as defineCollections } from "../define-BW5lveuc.js";
import { r as applyMdxPreset, t as remarkInclude } from "../remark-include-B6rmf4sh.js";
import { metaSchema as metaSchema$1, pageSchema } from "fumadocs-core/source/schema";
//#region src/config/index.ts
/** @deprecated import `pageSchema` from `fumadocs-core/source/schema` instead (since 16.2.3) */
const frontmatterSchema = pageSchema;
/** @deprecated import from `fumadocs-core/source/schema` instead (since 16.2.3) */
const metaSchema = metaSchema$1;
//#endregion
export { applyMdxPreset, defineCollections, defineConfig, defineDocs, frontmatterSchema, metaSchema, remarkInclude };
