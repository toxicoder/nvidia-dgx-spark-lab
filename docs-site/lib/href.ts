/**
 * Link resolution rules for content written for MkDocs.
 *
 * Kept free of the content source (which is produced by a bundler-time macro) so the rules
 * can be exercised by unit tests.  `lib/source.ts` supplies the page lookup.
 */

import { PathUtils } from "fumadocs-core/source";

/** Strip the content extension so `foo.md` and `foo.mdx` compare equal. */
export function withoutExtension(path: string): string {
  return path.replace(/\.(?:md|mdx)$/iu, "");
}

/** A page reference sufficient to resolve a link relative to it. */
export interface HrefOrigin {
  /** Path of the page relative to the content root, e.g. `operate/index.md`. */
  path: string;
}

/** A located page, as returned by the lookup. */
export interface HrefTarget {
  url: string;
}

/**
 * Drop a trailing `index` segment from link candidates.
 *
 * An `index` page is published at its directory address (see `keepAuthorSlugs` in
 * `lib/source.ts`), so a link written the MkDocs way — `[Learn the lab](learn/index.md)` —
 * names a file that is never itself a route.  Retrying with the segment removed is what
 * makes those links resolve.
 */
function withoutIndexSegment(segments: string[]): string[] {
  return segments.at(-1) === "index" ? segments.slice(0, -1) : segments;
}

/**
 * Resolve an intra-docs link the way MkDocs did.
 *
 * A link target is relative to the file it is written in and keeps its `.md` suffix:
 * `[Resource Guard](resource-guard.md)` inside `docs/operate/index.md` means
 * `docs/resource-guard.md`.  Targets are tried both file-relative and root-relative, and a
 * trailing `index` is dropped because an `index` page is served at its directory address.
 *
 * @param href Raw `href` from the markdown.
 * @param page Page the link appears on, used to resolve file-relative targets.
 * @param find Look up a page by its URL segments; returns nothing when there is no such page.
 * @returns The href to render, unchanged for anchors and off-site targets.
 */
export function resolveHrefWith(
  href: string | undefined,
  page: HrefOrigin,
  find: (segments: string[]) => HrefTarget | undefined
): { href: string | undefined; external?: boolean } {
  if (!href) return { href };
  const [target, hash] = href.split("#", 2);
  if (target.length === 0) return { href };
  if (/^[a-z][\w+.-]*:/iu.test(target) || target.startsWith("//")) return { href, external: true };

  const suffix = PathUtils.splitPath(withoutExtension(target)).join("/");
  // `joinPath` folds `..` segments away, which is exactly the MkDocs file-relative meaning.
  const fromPage = PathUtils.joinPath(PathUtils.dirname(page.path), suffix);
  for (const candidate of [fromPage, suffix]) {
    const segments = PathUtils.splitPath(candidate);
    const found = find(segments) ?? find(withoutIndexSegment(segments));
    if (found) return { href: hash ? `${found.url}#${hash}` : found.url };
  }
  return { href };
}
