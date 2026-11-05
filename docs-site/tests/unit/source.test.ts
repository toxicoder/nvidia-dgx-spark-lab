/**
 * How content files become URLs and search records.
 *
 * `lib/source.ts` decides the address every page is published at and what the search box
 * finds.  The rules exist so the rewrite of the MkDocs site stays link-compatible: the
 * loader's default slug generation lowercases and URI-encodes segments, which would move
 * `generated/shell/reference` and `operate/BUILDING_WITH_BAZEL` to new addresses, break the
 * links the CI job summaries print, and 404 the several hundred file-relative links the
 * corpus still carries.  The index builder is here too because the built-in one knows
 * nothing about `tags`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdvancedIndex } from "fumadocs-core/search/server";
import type { Page } from "fumadocs-core/source";

/** Fakes for the content source, the loader, and the search server. */
const h = vi.hoisted(() => {
  /** Pages the source serves, keyed by URL segments. */
  const pages = new Map<string, { url: string }>([
    ["resource-guard", { url: "/resource-guard" }],
    ["operate/dashboard", { url: "/operate/dashboard" }],
    ["learn", { url: "/learn" }],
    ["generated/shell/reference", { url: "/generated/shell/reference" }]
  ]);
  const getPage = vi.fn((slug: string[]) => pages.get(slug.join("/")));
  const fumadocsSource = { kind: "fumadocs-source" };
  const toFumadocsSource = vi.fn(() => fumadocsSource);
  const loader = vi.fn((_options: unknown) => ({ getPage }));
  const createFromSource = vi.fn((_source: unknown, _options: unknown) => ({ kind: "search-api" }));
  return { pages, getPage, toFumadocsSource, fumadocsSource, loader, createFromSource };
});

/** Returned by the loader's own slug generation, to prove the fallback delegated. */
const LOADER_DEFAULT = ["loader", "default", "slug"];

vi.mock("@/lib/content", () => ({ docs: { toFumadocsSource: h.toFumadocsSource } }));

vi.mock("fumadocs-core/search/server", () => ({ createFromSource: h.createFromSource }));

// PathUtils stays real: the slug rule is only worth pinning against the helper the loader
// itself uses.  Only `loader` is replaced, so the module never walks the filesystem.
vi.mock("fumadocs-core/source", async (importOriginal) => ({
  ...(await importOriginal<typeof import("fumadocs-core/source")>()),
  loader: h.loader
}));

import { DOCS_ROUTE, buildSearchIndex, resolveDocHref, search, source } from "../../lib/source";

/** Options the module handed to `loader()`. */
interface LoaderOptions {
  baseUrl: string;
  source: unknown;
  plugins: unknown[];
  slugs: (file: { path: string }, next: () => string[]) => string[];
}

function loaderOptions(): LoaderOptions {
  return h.loader.mock.calls[0]?.[0] as LoaderOptions;
}

/** A page; only `path` and `url` matter to the code under test. */
function fakePage(input: { path?: string; url?: string; data?: Record<string, unknown> } = {}): Page {
  return {
    path: input.path ?? "operate/resource-guard.md",
    url: input.url ?? "/operate/resource-guard",
    data: input.data ?? {}
  } as unknown as Page;
}

/** A structured-data block in the shape remark-structure produces. */
function structuredData(): AdvancedIndex["structuredData"] {
  return {
    headings: [{ id: "capacity-gates", content: "Capacity gates" }],
    contents: [{ heading: "Capacity gates", content: "Resource Guard keeps headroom free." }]
  };
}

async function indexPage(
  data: Record<string, unknown>,
  overrides: { path?: string; url?: string } = {}
): Promise<AdvancedIndex> {
  return buildSearchIndex(fakePage({ ...overrides, data }));
}

beforeEach(() => {
  h.getPage.mockClear();
});

describe("docs source", () => {
  it("mounts the pages at the application root", () => {
    expect(DOCS_ROUTE).toBe("/");
    expect(loaderOptions().baseUrl).toBe("/");
  });

  it("reads straight from the registered docs collection", () => {
    expect(h.toFumadocsSource).toHaveBeenCalled();
    expect(loaderOptions().source).toBe(h.fumadocsSource);
  });

  it("registers the slug rule and no plugins", () => {
    expect(loaderOptions().plugins).toEqual([]);
    expect(typeof loaderOptions().slugs).toBe("function");
  });

  it("builds the search API from this source with the tag-aware index builder", () => {
    expect(h.createFromSource).toHaveBeenCalledTimes(1);
    expect(h.createFromSource.mock.calls[0]?.[0]).toBe(source);
    expect((h.createFromSource.mock.calls[0]?.[1] as { buildIndex: unknown }).buildIndex).toBe(buildSearchIndex);
  });
});

describe("author slugs", () => {
  it("keeps the generated reference at the address MkDocs published", () => {
    const next = vi.fn(() => LOADER_DEFAULT);
    expect(loaderOptions().slugs({ path: "generated/shell/reference.md" }, next)).toEqual([
      "generated",
      "shell",
      "reference"
    ]);
    expect(next).not.toHaveBeenCalled();
  });

  it("keeps author casing so an upper-case file name keeps its URL", () => {
    const next = vi.fn(() => LOADER_DEFAULT);
    expect(loaderOptions().slugs({ path: "operate/BUILDING_WITH_BAZEL.md" }, next)).toEqual([
      "operate",
      "BUILDING_WITH_BAZEL"
    ]);
    expect(next).not.toHaveBeenCalled();
  });

  it("serves an index page at its directory address", () => {
    const next = vi.fn(() => LOADER_DEFAULT);
    expect(loaderOptions().slugs({ path: "generated/shell/index.md" }, next)).toEqual(["generated", "shell"]);
    expect(next).not.toHaveBeenCalled();
  });

  it("leaves a single-segment index to the loader", () => {
    const next = vi.fn(() => LOADER_DEFAULT);
    expect(loaderOptions().slugs({ path: "index.md" }, next)).toBe(LOADER_DEFAULT);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("leaves a nameless file to the loader", () => {
    const next = vi.fn(() => LOADER_DEFAULT);
    expect(loaderOptions().slugs({ path: ".md" }, next)).toBe(LOADER_DEFAULT);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("resolveDocHref", () => {
  it("resolves a file-relative link against the page it sits on", () => {
    const resolved = resolveDocHref("resource-guard.md", fakePage({ path: "operate/index.md" }));
    expect(resolved.href).toBe("/resource-guard");
    expect(resolved.external).toBeUndefined();
    expect(h.getPage.mock.calls[0]?.[0]).toEqual(["operate", "resource-guard"]);
  });

  it("resolves a link that only exists at the site root", () => {
    expect(resolveDocHref("operate/dashboard.md", fakePage({ path: "index.md" })).href).toBe("/operate/dashboard");
  });

  it("retries without the index segment, which is how index pages are published", () => {
    const resolved = resolveDocHref("learn/index.md", fakePage({ path: "index.md" }));
    expect(resolved.href).toBe("/learn");
    expect(h.getPage.mock.calls.map((call) => call[0])).toEqual([
      ["learn", "index"],
      ["learn"]
    ]);
  });

  it("keeps the anchor when a link points into another page", () => {
    expect(resolveDocHref("resource-guard.md#capacity-gates", fakePage({ path: "index.md" })).href).toBe(
      "/resource-guard#capacity-gates"
    );
  });

  it("leaves a link with no page behind it alone", () => {
    const resolved = resolveDocHref("does-not-exist.md", fakePage({ path: "index.md" }));
    expect(resolved).toEqual({ href: "does-not-exist.md" });
  });

  it("marks an off-site link external and skips the page lookup", () => {
    const resolved = resolveDocHref("https://github.com/toxicoder/nvidia-dgx-spark-lab", fakePage());
    expect(resolved).toEqual({
      href: "https://github.com/toxicoder/nvidia-dgx-spark-lab",
      external: true
    });
    expect(h.getPage).not.toHaveBeenCalled();
  });

  it("leaves a same-page anchor untouched", () => {
    expect(resolveDocHref("#top", fakePage({ path: "index.md" }))).toEqual({ href: "#top" });
  });

  it("passes an absent href through, as the link component allows one", () => {
    expect(resolveDocHref(undefined, fakePage({ path: "index.md" }))).toEqual({ href: undefined });
  });
});

describe("buildSearchIndex", () => {
  it("indexes a page under the URL it is published at", async () => {
    const index = await indexPage(
      { title: "Resource Guard", description: "capacity gates", structuredData: structuredData() },
      { url: "/operate/resource-guard" }
    );
    expect(index.id).toBe("/operate/resource-guard");
    expect(index.url).toBe("/operate/resource-guard");
    expect(index.title).toBe("Resource Guard");
    expect(index.description).toBe("capacity gates");
    expect(index.structuredData).toEqual(structuredData());
  });

  it("resolves structured data handed over as a loader", async () => {
    const loaderFn = vi.fn(async () => structuredData());
    const index = await indexPage({ title: "Resource Guard", structuredData: loaderFn });
    expect(loaderFn).toHaveBeenCalledTimes(1);
    expect(index.structuredData).toEqual(structuredData());
  });

  it("falls back to the file path for a generated page that has no title", async () => {
    const index = await indexPage({ structuredData: structuredData() }, { path: "generated/shell/reference.md" });
    expect(index.title).toBe("generated/shell/reference.md");
  });

  it("refuses to index a page whose body was never compiled", async () => {
    await expect(indexPage({ title: "Resource Guard" }, { path: "operate/broken.md" })).rejects.toThrow(
      "cannot build a search index for operate/broken.md: no structured data"
    );
  });

  it("indexes tags written as a comma list, trimmed of spacing", async () => {
    const index = await indexPage({ title: "T", tags: "resource guard,  capacity ,", structuredData: structuredData() });
    expect(index.tag).toEqual(["resource guard", "capacity"]);
  });

  it("indexes tags written as a YAML list", async () => {
    const index = await indexPage({ title: "T", tags: ["nccl", "multi-node"], structuredData: structuredData() });
    expect(index.tag).toEqual(["nccl", "multi-node"]);
  });

  it("drops the entries a contributor left blank or wrote as a number", async () => {
    const index = await indexPage({
      title: "T",
      tags: ["nccl", "", "   ", 42, null, "multi-node"],
      structuredData: structuredData()
    });
    expect(index.tag).toEqual(["nccl", "multi-node"]);
  });

  it("omits the tag field for an empty tag list", async () => {
    const index = await indexPage({ title: "T", tags: [], structuredData: structuredData() });
    expect(index.tag).toBeUndefined();
  });

  it("omits the tag field when every comma-separated entry is blank", async () => {
    const index = await indexPage({ title: "T", tags: " , , ", structuredData: structuredData() });
    expect(index.tag).toBeUndefined();
  });

  it("omits the tag field for a page with no tags at all", async () => {
    const index = await indexPage({ title: "T", structuredData: structuredData() });
    expect(index.tag).toBeUndefined();
  });
});
