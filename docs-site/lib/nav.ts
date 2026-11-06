/**
 * Sidebar and tab structure, transcribed from the information architecture the site shipped
 * with before the migration.
 *
 * MkDocs declared the whole navigation in `mkdocs.yml` under `nav:`; `scripts/gen_nav.py`
 * transcribed it verbatim into `lib/nav.json` (checked in, and CI-checked for drift with
 * `--check`).  The tree is built here rather than inferred from the filesystem because most
 * pages sit flat in `docs/` while belonging to different top-level tabs, which a
 * directory-derived tree cannot express.
 */

import { z } from "zod";
import type { Folder, Item, Node, Root } from "fumadocs-core/page-tree";
import type { ReactNode } from "react";
import type { LoaderOutput } from "fumadocs-core/source";

/**
 * The slice of the content loader the navigation needs.
 *
 * Declared structurally (rather than as a bare `LoaderOutput`) so the loader instance built
 * in `lib/source.ts` — whose page type is the specialised one from the collection schemas —
 * is accepted without a variance complaint.
 */
export type NavSource = Pick<LoaderOutput, "getPages">;

import navData from "./nav.json";

/** One entry of the transcribed navigation. */
export interface NavPage {
  /** Label shown in the sidebar, exactly as MkDocs rendered it. */
  title: string;
  /** Path of the page relative to `docs/`, e.g. `operate/dashboard.md`. */
  path: string;
}

/** One top-level tab of the transcribed navigation. */
export interface NavTab {
  title: string;
  pages: NavPage[];
}

/**
 * The shape `scripts/gen_nav.py` writes, restated on the TypeScript side.
 *
 * The Python script is the generator and the CI drift check; this schema is the boundary
 * check for whatever actually gets imported, so a hand-edited or truncated transcription
 * fails the build with the offending field named instead of rendering a sidebar row that
 * 404s.  A leaf keeps the `docs/`-relative `.md`/`.mdx` suffix the generator emits: the
 * whole matching rule below depends on it.
 */
const navPageSchema = z.strictObject({
  title: z.string().min(1),
  path: z.string().min(1).regex(/\.(?:md|mdx)$/u, "a nav page names a docs file")
});

const navTabSchema = z.strictObject({
  title: z.string().min(1),
  pages: z.array(navPageSchema)
});

/** The whole transcription: an ordered list of tabs. */
export const navSchema = z.array(navTabSchema);

/**
 * Validate the imported transcription before anything reads it.
 *
 * @param data The value imported from `lib/nav.json`.
 * @returns The tabs, typed, in the order the file declares them.
 * @throws {z.ZodError} When the file is not a list of tabs of pages.
 */
export function parseNav(data: unknown): NavTab[] {
  return navSchema.parse(data);
}

const NAV: NavTab[] = parseNav(navData);

/**
 * Resolve one `docs/`-relative path to a sidebar page node.
 *
 * @param source Content loader used to obtain the canonical URL of the page.
 * @param tabTitle Tab the page belongs to, used in the diagnostic when the page is missing.
 * @param path Path of the page relative to `docs/`.
 * @param title Sidebar label for the page.
 * @returns A page node whose URL matches the route the page is served from.
 */
function toItem(source: NavSource, tabTitle: string, path: string, title: string): Item {
  const page = source.getPages().find((candidate) => stripExtension(candidate.path) === stripExtension(path));
  if (!page) {
    throw new Error(
      `navigation references a page that is not in the content source: ${path} (tab "${tabTitle}")`
    );
  }
  return { $id: `page:${path}`, type: "page", name: title, url: page.url, $ref: page.path };
}

/** Drop the directory suffix so `foo.md` and `foo.mdx` compare equal. */
function stripExtension(path: string): string {
  return path.replace(/\.(?:md|mdx)$/, "");
}

/**
 * Build the page tree the docs layout renders.
 *
 * Every tab becomes a root folder, which is what makes it appear in the tab strip while the
 * sidebar shows only the pages of the tab the reader is currently in — the behaviour the
 * Material theme produced with `navigation.tabs`.
 *
 * @param source Content loader to resolve page URLs against.
 * @returns The root node for `DocsLayout`.
 */
export function buildPageTree(source: NavSource): Root {
  const children: Node[] = NAV.map((tab, index) => {
    const pages = tab.pages.map((page) => toItem(source, tab.title, page.path, page.title));
    const folder: Folder = {
      $id: `tab:${index}:${tab.title}`,
      type: "folder",
      name: tab.title,
      root: true,
      defaultOpen: true,
      children: pages
    };
    const firstPage = tab.pages[0];
    const first = pages[0];
    // A tab whose first page is an overview gets it as the folder index, matching the
    // `index.md` pages MkDocs linked the tab title to.  `pages` is `tab.pages` mapped 1:1,
    // so the two guards stand or fall together.
    if (first && firstPage && /(^|\/)index$/.test(stripExtension(firstPage.path))) folder.index = first;
    return folder;
  });

  return { $id: "root", type: "root", name: "Documentation", children };
}

/** Paths of every page in the navigation, in tab order, for the parity gate. */
export const NAVIGATED_PATHS: string[] = NAV.flatMap((tab) => tab.pages.map((page) => page.path));

/**
 * Previous and next pages in reading order.
 *
 * The Material theme rendered a prev/next footer driven by the order pages appear in `nav:`;
 * the same order is reproduced here from the transcribed navigation so the footer links
 * behave the way they did.
 *
 * @param source Content loader used to resolve each path to its page node.
 * @param path Path of the current page relative to `docs/`.
 * @returns The neighbouring entries, `undefined` at either end of the run.
 */
export function neighborsOf(
  source: NavSource,
  path: string
): { previous?: PageNodeEntry; next?: PageNodeEntry } {
  const wanted = stripExtension(path);
  const flat = NAV.flatMap((tab) => tab.pages.map((page) => ({ tab: tab.title, page })));
  const index = flat.findIndex((entry) => stripExtension(entry.page.path) === wanted);
  if (index === -1) return {};
  const at = (offset: number): PageNodeEntry | undefined => {
    const entry = flat[index + offset];
    if (!entry) return undefined;
    const item = toItem(source, entry.tab, entry.page.path, entry.page.title);
    return { name: item.name, url: item.url };
  };
  // An absent neighbour is left out rather than set to `undefined`, which the footer slot's
  // optional props do not accept.
  const previous = at(-1);
  const next = at(1);
  const neighbours: { previous?: PageNodeEntry; next?: PageNodeEntry } = {};
  if (previous) neighbours.previous = previous;
  if (next) neighbours.next = next;
  return neighbours;
}

/** A prev/next footer entry shaped the way the footer slot expects. */
export interface PageNodeEntry {
  name: ReactNode;
  url: string;
}
