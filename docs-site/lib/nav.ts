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
interface NavPage {
  /** Label shown in the sidebar, exactly as MkDocs rendered it. */
  title: string;
  /** Path of the page relative to `docs/`, e.g. `operate/dashboard.md`. */
  path: string;
}

/** One top-level tab of the transcribed navigation. */
interface NavTab {
  title: string;
  pages: NavPage[];
}

const NAV = navData as NavTab[];

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
    const first = pages[0];
    // A tab whose first page is an overview gets it as the folder index, matching the
    // `index.md` pages MkDocs linked the tab title to.
    if (first && /(^|\/)index$/.test(stripExtension(tab.pages[0]!.path))) folder.index = first;
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
  return { previous: at(-1), next: at(1) };
}

/** A prev/next footer entry shaped the way the footer slot expects. */
export interface PageNodeEntry {
  name: ReactNode;
  url: string;
}
