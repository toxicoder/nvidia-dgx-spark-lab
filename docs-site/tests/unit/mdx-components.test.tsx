/**
 * Tests for the MDX component map every compiled page renders through.
 *
 * The MDX compiler emits `_createMdxContent(props)` and pulls the components a page uses out
 * of `props.components`, so page files import nothing: if a name is missing from this map the
 * compiler's missing-reference guard throws at render time and the page 500s.  That makes
 * "every referenceable name is present" the contract, alongside the Fumadocs defaults still
 * being reachable underneath the overrides.
 *
 * The link entry carries the second real contract: MkDocs-era content links file-relative
 * (`[Resource Guard](resource-guard.md)`) and those have to become real routes, while an
 * off-site link keeps opening in a new tab with the referrer stripped.
 */

import { createElement, type ComponentType } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const LinkStub = vi.hoisted(() => () => null);

vi.mock("fumadocs-core/link", () => ({
  default: LinkStub
}));

vi.mock("fumadocs-ui/mdx", () => ({
  default: { h1: () => null, code: () => null }
}));

vi.mock("fumadocs-ui/components/banner", () => ({ Banner: () => null }));
vi.mock("fumadocs-ui/components/tabs", () => ({ Tab: () => null, Tabs: () => null }));

const clusterConfigPanelStub = vi.hoisted(() => () => null);
const glossaryTermStub = vi.hoisted(() => () => null);
const mermaidStub = vi.hoisted(() => () => null);
const pageOverviewStub = vi.hoisted(() => () => null);
const pageOverviewColumnStub = vi.hoisted(() => () => null);

vi.mock("@/components/cluster-config-panel", () => ({ ClusterConfigPanel: clusterConfigPanelStub }));
vi.mock("@/components/glossary-term", () => ({ GlossaryTerm: glossaryTermStub }));
vi.mock("@/components/mermaid", () => ({ Mermaid: mermaidStub }));
vi.mock("@/components/page-overview", () => ({
  PageOverview: pageOverviewStub,
  PageOverviewColumn: pageOverviewColumnStub
}));

const resolveDocHref = vi.hoisted(() => vi.fn());
vi.mock("@/lib/source", () => ({ resolveDocHref }));

import { mdxComponentsFor } from "../../components/mdx-components";

const page = { path: "operate/index", url: "/operate/index" } as never;

/**
 * The map is heterogeneous by nature (headings, blocks, the link override), so the tests
 * that render an entry widen it to component-of-unknown-props rather than fighting the
 * `createElement` overloads entry by entry.
 */
type MdxMap = Record<string, ComponentType<Record<string, unknown>>>;
const mapFor = () => mdxComponentsFor(page) as unknown as MdxMap;

/**
 * Read one entry a test renders.
 *
 * Indexed access is `| undefined` under `noUncheckedIndexedAccess`, and that is the real
 * risk this file guards: a name the MDX compiler can reference going missing from the
 * map makes every page that uses it 500. So the lookup is checked and the name is named.
 */
function entryFor(map: MdxMap, name: string): ComponentType<Record<string, unknown>> {
  const entry = map[name];
  if (!entry) {
    throw new Error(`mdx component map is missing "${name}"`);
  }
  return entry;
}

/** The link override, which most of these tests exercise. */
const linkFor = () => entryFor(mapFor(), "a");

describe("mdxComponentsFor", () => {
  it("keeps the Fumadocs defaults under the overrides", () => {
    const components = mdxComponentsFor(page) as Record<string, unknown>;
    expect(components.h1).toBeDefined();
    expect(components.code).toBeDefined();
    // The overrides replace only what the site actually re-skins.
    expect(components.a).toBeDefined();
    expect(components.a).not.toBe(LinkStub);
  });

  it("registers every name a page can reference", () => {
    const components = mdxComponentsFor(page) as Record<string, unknown>;
    expect(Object.keys(components)).toEqual(
      expect.arrayContaining([
        "a",
        "abbr",
        "GlossaryTerm",
        "Banner",
        "Tab",
        "Tabs",
        "Mermaid",
        "ClusterConfigPanel",
        "PageOverview",
        "PageOverviewColumn"
      ])
    );
  });

  it("maps both abbr and the explicit tag to the same glossary component", () => {
    const components = mdxComponentsFor(page) as Record<string, unknown>;
    // `<abbr>` is what markdown-it emits; `GlossaryTerm` is the explicit JSX form. Both
    // appear in the corpus, and they have to behave identically.
    expect(components.abbr).toBe(glossaryTermStub);
    expect(components.GlossaryTerm).toBe(glossaryTermStub);
  });

  it("maps the remaining custom blocks to their components", () => {
    const components = mdxComponentsFor(page) as Record<string, unknown>;
    expect(components.Mermaid).toBe(mermaidStub);
    expect(components.ClusterConfigPanel).toBe(clusterConfigPanelStub);
    expect(components.PageOverview).toBe(pageOverviewStub);
    expect(components.PageOverviewColumn).toBe(pageOverviewColumnStub);
  });

  it("resolves an in-docs link through the page it was written on", () => {
    resolveDocHref.mockReturnValue({ href: "/operate/resource-guard" });
    const { container } = render(createElement(linkFor(), { href: "resource-guard.md" }));
    expect(resolveDocHref).toHaveBeenCalledWith("resource-guard.md", page);
    // A resolved internal target renders as the router-aware link, not a raw anchor.
    expect(container.querySelector("a")).toBeNull();
  });

  it("opens an off-site link in a new tab with the referrer stripped", () => {
    resolveDocHref.mockReturnValue({ href: "https://github.com/x", external: true });
    const { container } = render(
      createElement(linkFor(), { href: "https://github.com/x", className: "mt-2" })
    );
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("https://github.com/x");
    expect(anchor?.getAttribute("target")).toBe("_blank");
    expect(anchor?.getAttribute("rel")).toBe("noreferrer noopener");
    // Sibling props from the markdown (a class, an id) must not be dropped by the spread.
    expect(anchor?.getAttribute("class")).toBe("mt-2");
  });

  it("passes an anchor-only href through unchanged", () => {
    resolveDocHref.mockReturnValue({ href: "#section" });
    render(createElement(linkFor(), { href: "#section" }));
    expect(resolveDocHref).toHaveBeenCalledWith("#section", page);
  });

  it("handles a link with no href at all", () => {
    resolveDocHref.mockReturnValue({ href: undefined });
    expect(() => render(createElement(linkFor(), {}))).not.toThrow();
    expect(resolveDocHref).toHaveBeenCalledWith(undefined, page);
  });
});
