/**
 * Tests for the transcribed navigation tree.
 *
 * `lib/nav.json` is the checked-in transcription of the MkDocs `nav:` block, and it is the
 * only thing that decides what a reader sees in the tab strip, in the sidebar, and in the
 * prev/next footer.  Pages sit flat in `docs/` while belonging to different tabs, so the
 * tree is built from the transcription rather than from the filesystem.  An entry the content
 * source does not have has to fail the build loudly instead of rendering a sidebar row that
 * 404s, which is what `toItem` guards.  The tree is driven with the real navigation file plus
 * the page shapes the content loader produces in production.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import type { Folder, Item, Node as TreeNode, Root } from "fumadocs-core/page-tree";

import navData from "../../lib/nav.json";
import { buildPageTree, NAVIGATED_PATHS, neighborsOf } from "../../lib/nav";
import type { NavSource } from "../../lib/nav";

/** One entry of the transcribed navigation, as `nav.json` stores it. */
interface NavPage {
  title: string;
  path: string;
}

/** One top-level tab of the transcribed navigation. */
interface NavTab {
  title: string;
  pages: NavPage[];
}

/** The navigation the site actually ships with, typed for the assertions below. */
const TABS = navData as NavTab[];

/** The fields of a loader page that the navigation reads. */
interface FakePage {
  path: string;
  url: string;
}

/**
 * The URL the content loader publishes for a `docs/`-relative path.
 *
 * Mirrors `keepAuthorSlugs` in `lib/source.ts`: the extension goes and an `index` page is
 * addressed by its directory, which is how the site publishes every overview page.
 */
function urlFor(path: string): string {
  const slug = path.replace(/\.(?:md|mdx)$/u, "");
  if (slug === "index") return "/";
  return `/${slug.replace(/\/index$/u, "")}`;
}

/** A content loader standing in for the fumadocs source, answering with the given pages. */
function sourceWith(pages: FakePage[]): NavSource {
  return { getPages: () => pages } as unknown as NavSource;
}

/** A loader that has every page the transcribed navigation links. */
function completeSource(): NavSource {
  return sourceWith(
    TABS.flatMap((tab) => tab.pages.map((page) => ({ path: page.path, url: urlFor(page.path) })))
  );
}

/** A loader whose pages are authored as `.mdx`, which the navigation has to match anyway. */
function mdxSource(): NavSource {
  return sourceWith(
    TABS.flatMap((tab) =>
      tab.pages.map((page) => ({ path: page.path.replace(/\.md$/u, ".mdx"), url: urlFor(page.path) }))
    )
  );
}

/** The children of a tree node, narrowed to the folder shape the builder produces. */
function childrenOfFolder(node: TreeNode | undefined): TreeNode[] {
  return (node as Folder | undefined)?.children ?? [];
}

/** The folder fields of a tree node, which the builder only sets on tabs. */
function asFolder(node: TreeNode | undefined): Folder | undefined {
  return node?.type === "folder" ? node : undefined;
}

/** The page fields of a tree node, which the builder sets for nav entries. */
function asPage(node: TreeNode | undefined): Item | undefined {
  return node?.type === "page" ? node : undefined;
}

describe("buildPageTree", () => {
  it("makes one root folder per tab, in the order the navigation declares them", () => {
    const tree: Root = buildPageTree(completeSource());
    expect(tree.type).toBe("root");
    expect(tree.name).toBe("Documentation");
    expect(tree.children?.map((folder) => folder.name)).toEqual(TABS.map((tab) => tab.title));
  });

  it("marks every tab as an open root folder so the tab strip renders it", () => {
    const tree = buildPageTree(completeSource());
    for (const [index, node] of (tree.children ?? []).entries()) {
      const folder = asFolder(node);
      expect(folder?.type).toBe("folder");
      expect(folder?.root).toBe(true);
      expect(folder?.defaultOpen).toBe(true);
      expect(folder?.$id).toBe(`tab:${index}:${TABS[index]?.title}`);
    }
  });

  it("resolves every nav entry to the URL the content loader publishes", () => {
    const tree = buildPageTree(completeSource());
    const gettingStarted = asPage(childrenOfFolder(tree.children?.[1])[1]);
    expect(gettingStarted).toMatchObject({
      $id: "page:getting-started.md",
      type: "page",
      name: "Getting Started",
      url: "/getting-started",
      $ref: "getting-started.md"
    });
  });

  it("keeps the declared page order inside a tab", () => {
    const tree = buildPageTree(completeSource());
    for (const [index, node] of (tree.children ?? []).entries()) {
      const refs = childrenOfFolder(node).map((page) => asPage(page)?.$ref);
      expect(refs).toEqual(TABS[index]?.pages.map((page) => page.path));
    }
  });

  it("matches a nav entry written with .md against a source page authored as .mdx", () => {
    const tree = buildPageTree(mdxSource());
    const home = asPage(childrenOfFolder(tree.children?.[0])[0]);
    expect(home).toMatchObject({ $id: "page:index.md", url: "/", $ref: "index.mdx" });
  });

  it("gives a tab whose first page is the repository index that page as the folder index", () => {
    const tree = buildPageTree(completeSource());
    const home = asFolder(tree.children?.[0]);
    expect(home?.index).toEqual(home?.children?.[0]);
  });

  it("gives a tab whose first page is a directory overview that page as the folder index", () => {
    const tree = buildPageTree(completeSource());
    const start = asFolder(tree.children?.[1]);
    expect(start?.index).toMatchObject({ url: "/start", $ref: "start/index.md" });
  });

  it("leaves a tab that opens on a plain page without a folder index", () => {
    const tree = buildPageTree(completeSource());
    const reference = (tree.children ?? []).find((folder) => folder.name === "Reference");
    expect(asFolder(reference)?.index).toBeUndefined();
  });

  it("refuses a navigation entry the content source does not have", () => {
    expect(() => buildPageTree(sourceWith([]))).toThrow(
      /navigation references a page that is not in the content source: index\.md \(tab "Home"\)/u
    );
  });

  it("names the tab that holds a navigation entry the content source does not have", () => {
    const missingOperateOverview = sourceWith(
      TABS.flatMap((tab) => tab.pages)
        .filter((page) => page.path !== "operate/index.md")
        .map((page) => ({ path: page.path, url: urlFor(page.path) }))
    );
    expect(() => buildPageTree(missingOperateOverview)).toThrow(/tab "Operate"/u);
  });
});

describe("buildPageTree with a tab that has no pages", () => {
  afterEach(() => {
    vi.doUnmock("../../lib/nav.json");
    vi.resetModules();
  });

  it("renders the tab as an empty folder rather than inventing an index page", async () => {
    vi.resetModules();
    vi.doMock("../../lib/nav.json", () => ({
      default: [
        { title: "Empty", pages: [] },
        { title: "Real", pages: [{ title: "Home", path: "index.md" }] }
      ]
    }));
    const nav = await import("../../lib/nav");
    const tree = nav.buildPageTree(sourceWith([{ path: "index.md", url: "/" }]));
    const empty = asFolder(tree.children?.[0]);
    const real = asFolder(tree.children?.[1]);
    expect(empty?.children).toEqual([]);
    expect(empty?.index).toBeUndefined();
    expect(real?.index).toMatchObject({ url: "/" });
  });
});

describe("NAVIGATED_PATHS", () => {
  it("lists every page exactly once in tab order for the parity gate", () => {
    expect(NAVIGATED_PATHS).toEqual(TABS.flatMap((tab) => tab.pages.map((page) => page.path)));
    expect(new Set(NAVIGATED_PATHS).size).toBe(NAVIGATED_PATHS.length);
  });
});

describe("neighborsOf", () => {
  it("walks to the neighbouring pages inside a tab", () => {
    expect(neighborsOf(completeSource(), "start/index.md").next).toEqual({
      name: "Getting Started",
      url: "/getting-started"
    });
  });

  it("crosses the tab boundary so the last page of a tab hands over to the first of the next", () => {
    expect(neighborsOf(completeSource(), "start/index.md").previous).toEqual({ name: "Home", url: "/" });
  });

  it("omits the previous entry on the first page of the run", () => {
    const { previous, next } = neighborsOf(completeSource(), "index.md");
    expect(previous).toBeUndefined();
    expect(next?.name).toBe("Overview");
  });

  it("omits the next entry on the last page of the run", () => {
    const last = NAVIGATED_PATHS.at(-1)!;
    const { previous, next } = neighborsOf(completeSource(), last);
    expect(next).toBeUndefined();
    expect(previous?.name).toBe("Developer Environment");
  });

  it("compares neighbours without the extension, so an .mdx page still gets its neighbours", () => {
    expect(neighborsOf(mdxSource(), "getting-started.mdx")).toEqual({
      previous: { name: "Overview", url: "/start" },
      next: { name: "Choose topology", url: "/start/choose-topology" }
    });
  });

  it("returns no neighbours for a page the navigation does not list", () => {
    expect(neighborsOf(completeSource(), "not-in-the-navigation.md")).toEqual({});
  });

  it("refuses to link a neighbour the content source does not have", () => {
    const source = sourceWith([{ path: "index.md", url: "/" }]);
    expect(() => neighborsOf(source, "getting-started.md")).toThrow(
      /navigation references a page that is not in the content source: start\/index\.md \(tab "Start"\)/u
    );
  });
});
