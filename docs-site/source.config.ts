/**
 * Global MDX compiler configuration for the documentation site.
 *
 * `mdxOptions` here is merged into Fumadocs' built-in remark/rehype chain (the preset
 * appends these `remarkPlugins` after GFM, heading, image and code-tab handling), so the
 * MkDocs-era behaviours below are added without dropping anything the theme relies on —
 * notably `rehypeToc`, which produces the table of contents rendered by `DocsPage`.
 */

import { defineConfig } from "fumadocs-mdx/config";
import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";

import { remarkGlossaryTooltips } from "./lib/remark-glossary";
import { remarkPageOverview } from "./lib/remark-page-overview";

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMdxMermaid, remarkGlossaryTooltips, remarkPageOverview]
  }
});
