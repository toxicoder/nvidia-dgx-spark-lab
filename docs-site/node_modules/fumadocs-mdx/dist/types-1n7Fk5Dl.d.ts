import { Root } from "mdast";
import { TOCItemType } from "fumadocs-core/toc";
import { MDXComponents, MDXContent } from "mdx/types";
import { StructuredData } from "fumadocs-core/mdx-plugins/remark-structure";
//#region src/runtime/types.d.ts
interface DocData {
  /**
   * Compiled MDX content (as component)
   */
  body: MDXContent;
  /**
   * table of contents generated from content.
   */
  toc: TOCItemType[];
  /**
   * structured data for document search indexing.
   */
  structuredData: StructuredData;
  /**
   * Raw exports from the compiled MDX file.
   */
  _exports: Record<string, unknown>;
}
interface FileInfo {
  /**
   * virtualized path for Source API
   */
  path: string;
  /**
   * the file path in file system
   */
  fullPath: string;
}
interface GetTextOptions {
  /**
   * MDX components for JSX elements in the output, only available with `output: 'function'` in `includeProcessedMarkdown`.
   */
  components?: MDXComponents;
}
interface DocMethods {
  /**
   * file info
   */
  info: FileInfo;
  /**
   * get document as text.
   *
   * - `type: raw` - read the original content from file system.
   * - `type: processed` - get the processed Markdown content, only available when `includeProcessedMarkdown` is enabled on collection config.
   */
  getText: (type: 'raw' | 'processed', options?: GetTextOptions) => Promise<string>;
  getMDAST: () => Promise<Root>;
}
interface MetaMethods {
  /**
   * file info
   */
  info: FileInfo;
}
interface InternalTypeConfig {
  /**
   * collection name -> collection properties
   */
  DocData: Record<string, unknown>;
}
//#endregion
export { InternalTypeConfig as a, GetTextOptions as i, DocMethods as n, MetaMethods as o, FileInfo as r, DocData as t };