/**
 * Content source for the documentation site.
 *
 * The pages stay where they always were — in `docs/`, written by contributors and by the
 * shell and dashboard generators — and are read straight from there.  Nothing is copied
 * into this package, so `bazelisk run //docs:docs` style generators keep working unchanged.
 */

import { loader, PathUtils } from "fumadocs-core/source";
import { createFromSource } from "fumadocs-core/search/server";
import type { AdvancedIndex } from "fumadocs-core/search/server";
import type { Page } from "fumadocs-core/source";

import { resolveHrefWith, withoutExtension } from "./href";
import { docs } from "./content";

/**
 * Route prefix of the pages.
 *
 * The site is mounted at the application root (`app/[[...slug]]`), so a page's URL is its
 * slug path.  The published aliases add their own prefix through `basePath` in
 * `next.config.ts`, which is why the URLs here stay root-relative.
 */
export const DOCS_ROUTE = "/";

/**
 * Keep page URLs identical to the addresses the MkDocs site published.
 *
 * MkDocs derived a URL from the file path, so `generated/shell/reference.md` was served at
 * `/generated/shell/reference`.  The loader's default slug generation lowercases and
 * URI-encodes segments, which would move every page of the generated reference (and the
 * dashboard API README, whose file name is upper case) to a new address.  Returning the
 * path verbatim keeps those links — and the bookmarks and CI job summaries that point at
 * them — working.
 */
function keepAuthorSlugs(file: { path: string }, next: () => string[]): string[] {
  const slug = withoutExtension(file.path);
  if (slug.length === 0) return next();
  const segments = PathUtils.splitPath(slug);
  // An `index` page is served at its directory address, as MkDocs did and as the loader's
  // own slug generation does — dropping the segment keeps `generated/shell/index.md` at
  // `/generated/shell` so links to the directory keep resolving.
  if (segments.at(-1) === "index") segments.pop();
  return segments.length > 0 ? segments : next();
}

/** A link target that has been resolved to something renderable. */
export interface ResolvedHref {
  href: string | undefined;
  /** Set for targets that leave the site, so the caller can add `target`/`rel`. */
  external?: boolean;
}

/**
 * Resolve an intra-docs link the way MkDocs did.
 *
 * The content was authored for MkDocs, where a link target is relative to the file it is
 * written in and carries its `.md` suffix: `[Resource Guard](resource-guard.md)` inside
 * `docs/operate/index.md` means `docs/resource-guard.md`.  The theme's own link component
 * rewrites only `./`-style hrefs and passes anything else through, which would emit
 * `/resource-guard.md` — a 404.  Resolving here means the several hundred existing links do
 * not have to be rewritten and keep working when a page is renamed.
 *
 * @param href Raw `href` from the markdown.
 * @param page Page the link appears on, used to resolve file-relative targets.
 * @returns The href to render, unchanged for anchors and off-site targets.
 */
export function resolveDocHref(href: string | undefined, page: Page): ResolvedHref {
  return resolveHrefWith(href, page, (segments) =>
    source.getPage(PathUtils.splitPath(segments.join("/")))
  );
}

export const source = loader({
  baseUrl: DOCS_ROUTE,
  source: docs.toFumadocsSource(),
  slugs: keepAuthorSlugs,
  plugins: []
});

/**
 * Normalise the `tags` frontmatter field to a list.
 *
 * Contributors write either `tags: [a, b]` or `tags: a, b`; both have to reach the search
 * index as a list so a reader can find a page by any of its tags.
 */
function toTagList(tags: unknown): string[] | undefined {
  if (typeof tags === "string") {
    const parts = tags.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
    return parts.length > 0 ? parts : undefined;
  }
  if (Array.isArray(tags)) {
    const parts = tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
    return parts.length > 0 ? parts : undefined;
  }
  return undefined;
}

/**
 * Index a page for search.
 *
 * The built-in index builder covers title, description and body; it has no notion of
 * `tags`, which the old MkDocs search did index.  Structured data is resolved here because
 * the compiled document is loaded on demand.
 *
 * @param page A page from {@link source}.
 * @returns The record to insert into the search database.
 */
export async function buildSearchIndex(page: Page): Promise<AdvancedIndex> {
  const data = page.data as {
    title?: string;
    description?: string;
    tags?: unknown;
    structuredData?: AdvancedIndex["structuredData"] | (() => Promise<AdvancedIndex["structuredData"]>);
  };
  const structured =
    typeof data.structuredData === "function" ? await data.structuredData() : data.structuredData;
  if (!structured) throw new Error(`cannot build a search index for ${page.path}: no structured data`);

  return {
    id: page.url,
    title: data.title ?? page.path,
    description: data.description,
    url: page.url,
    structuredData: structured,
    tag: toTagList(data.tags)
  };
}

/**
 * Server-side search API, also able to export its database for the static client.
 *
 * `staticGET` is what `app/api/search/route.ts` exposes so the exported build can search in
 * the browser without a server.
 */
export const search = createFromSource(source, { buildIndex: buildSearchIndex });
