/**
 * Content source for the documentation site.
 *
 * Point the Fumadocs MDX source at the repository's existing `docs/` tree so the shell and
 * dashboard generators keep writing into `docs/generated/**` and contributors keep editing
 * markdown where they always have. Nothing is copied into this package.
 */

import { z } from "zod";
import { defineDocs } from "fumadocs-mdx/macro";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";

/**
 * Frontmatter of a hand-written page.
 *
 * `pageSchema` strips unknown keys, so `tags` has to be declared here or the contributor
 * tags that MkDocs search indexed would silently disappear from the new search index.
 */
export const docSchema = pageSchema.extend({
  tags: z.union([z.string(), z.array(z.string())]).optional()
});

/**
 * Frontmatter of a generated page.
 *
 * TypeDoc and the shell generator emit no frontmatter at all, so `title` cannot be
 * required; the page renderer falls back to the document's first heading.
 */
export const generatedSchema = pageSchema.extend({
  title: z.string().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional()
});

/**
 * Mirrors `exclude_docs` from the retired mkdocs.yml plus the trees that hold tooling
 * rather than pages.
 *
 * Both extensions are listed: pages that needed MkDocs syntax rewritten to JSX were renamed
 * to `.mdx` by `scripts/codemod_mkdocs_to_mdx.py` (the MDX compiler drops literal JSX in
 * `.md`), while the rest of the corpus — including everything under `generated/`, which the
 * shell and dashboard generators own — stays `.md`.
 *
 * `includes/**` holds the snippets and the glossary definitions that MkDocs pulled in with
 * `pymdownx.snippets`; they are inputs to pages, not pages themselves.
 *
 * The list has to stay inline string literals: the bundler macro reads it statically to
 * decide which files to bundle, and rejects anything computed.
 */
export const docs = defineDocs({
  dir: "../docs",
  docs: {
    files: ["**/*.md", "**/*.mdx", "!includes/**"],
    schema({ path }) {
      // The compiler passes the file's on-disk path, which is absolute, so the marker is
      // matched as a path segment anywhere in it rather than as a prefix.
      return /(^|\/)generated(\/|$)/.test(path.replace(/\\/g, "/")) ? generatedSchema : docSchema;
    }
  },
  meta: {
    schema: metaSchema
  }
});
