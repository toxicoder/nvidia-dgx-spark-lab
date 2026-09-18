/**
 * Tests for MkDocs-style link resolution.
 *
 * The corpus was authored for MkDocs, where a link names a file relative to the page it
 * sits in and keeps its `.md` suffix.  Those links are the only route readers (and the
 * README's published URLs) have between pages, so a regression here silently 404s them.
 */

import { describe, expect, it } from "vitest";

import { resolveHrefWith } from "../../lib/href";
import type { HrefTarget } from "../../lib/href";

/**
 * Page lookup standing in for the content source.
 *
 * URLs follow `keepAuthorSlugs`: the extension is gone and an `index` page is addressed by
 * its directory, which is exactly how the site publishes them.
 */
const PAGES: HrefTarget[] = [
  { url: "/resource-guard" },
  { url: "/operate" },
  { url: "/operate/dashboard" },
  { url: "/learn" },
  { url: "/contribute" },
  { url: "/generated/shell/reference" },
  { url: "/BUILDING_WITH_BAZEL" }
];

const PATHS: Record<string, string> = {
  "/resource-guard": "resource-guard.md",
  "/operate": "operate/index.md",
  "/operate/dashboard": "operate/dashboard.md",
  "/learn": "learn/index.md",
  "/contribute": "contribute/index.md",
  "/generated/shell/reference": "generated/shell/reference.md",
  "/BUILDING_WITH_BAZEL": "BUILDING_WITH_BAZEL.md"
};

function find(segments: string[]): HrefTarget | undefined {
  const url = `/${segments.join("/")}`;
  const path = PATHS[url];
  if (!path) return undefined;
  return PAGES.find((page) => page.url === url);
}

describe("resolveHrefWith", () => {
  it("resolves a sibling file link written with its .md suffix", () => {
    const { href } = resolveHrefWith("resource-guard.md", { path: "operate/index.md" }, find);
    expect(href).toBe("/resource-guard");
  });

  it("resolves a ../-relative link across directories", () => {
    const { href } = resolveHrefWith("../resource-guard.md", { path: "operate/index.md" }, find);
    expect(href).toBe("/resource-guard");
  });

  it("resolves a link that names an index page explicitly", () => {
    const { href } = resolveHrefWith("learn/index.md", { path: "index.md" }, find);
    expect(href).toBe("/learn");
  });

  it("resolves an index link reached through ..", () => {
    const { href } = resolveHrefWith("../learn/index.md", { path: "start/index.md" }, find);
    expect(href).toBe("/learn");
  });

  it("keeps the fragment attached", () => {
    const { href } = resolveHrefWith("resource-guard.md#headroom", { path: "operate/index.md" }, find);
    expect(href).toBe("/resource-guard#headroom");
  });

  it("preserves case of generated pages whose names are upper case", () => {
    const { href } = resolveHrefWith("BUILDING_WITH_BAZEL.md", { path: "contribute/index.md" }, find);
    expect(href).toBe("/BUILDING_WITH_BAZEL");
  });

  it("flags off-site links so they open out", () => {
    const result = resolveHrefWith("https://example.com/a", { path: "index.md" }, find);
    expect(result.external).toBe(true);
    expect(result.href).toBe("https://example.com/a");
  });

  it("passes bare anchors through untouched", () => {
    expect(resolveHrefWith("#section", { path: "index.md" }, find).href).toBe("#section");
  });

  it("leaves an unresolvable target alone rather than emitting a broken route", () => {
    expect(resolveHrefWith("nope.md", { path: "index.md" }, find).href).toBe("nope.md");
  });

  it("handles an empty href", () => {
    expect(resolveHrefWith("", { path: "index.md" }, find).href).toBe("");
  });
});
