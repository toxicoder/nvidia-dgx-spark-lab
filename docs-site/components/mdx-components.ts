/**
 * Component map handed to every compiled MDX page.
 *
 * The MDX compiler emits `_createMdxContent(props)` and destructures the components a page
 * uses out of `props.components`, so the page files import nothing: the map is passed once
 * by `app/[[...slug]]/page.tsx`.  Anything a page can reference has to be listed here,
 * otherwise the compiler's missing-reference guard throws at render time.
 *
 * The Fumadocs defaults (headings, images, tables, code blocks, callouts, cards) are spread
 * in first so the entries below add to them rather than replace them.
 */

import { createElement } from "react";
import Link from "fumadocs-core/link";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Banner } from "fumadocs-ui/components/banner";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";

import { ClusterConfigPanel } from "@/components/cluster-config-panel";
import { GlossaryTerm } from "@/components/glossary-term";
import { Mermaid } from "@/components/mermaid";
import { PageOverview, PageOverviewColumn } from "@/components/page-overview";
import { resolveDocHref } from "@/lib/source";
import type { Page } from "fumadocs-core/source";

/**
 * Build the component map for one page.
 *
 * @param page Page being rendered; links in its content resolve relative to it.
 * @returns The `components` object for the compiled MDX component.
 */
export function mdxComponentsFor(page: Page) {
  /**
   * Anchor used by links inside page content.
   *
   * The built-in one only rewrites `./`-style hrefs; MkDocs-era content also uses bare
   * file-relative targets (`resource-guard.md`) that have to become real routes, while
   * off-site links keep opening in a new tab.
   */
  function ContentLink(props: { href?: string } & Record<string, unknown>) {
    const { href, ...rest } = props;
    const resolved = resolveDocHref(href, page);
    if (resolved.external) {
      return createElement("a", { href: resolved.href, rel: "noreferrer noopener", target: "_blank", ...rest });
    }
    return createElement(Link, { href: resolved.href, ...rest });
  }

  return {
    ...defaultMdxComponents,
    a: ContentLink,
    abbr: GlossaryTerm,
    GlossaryTerm,
    Banner,
    Tab,
    Tabs,
    Mermaid,
    ClusterConfigPanel,
    PageOverview,
    PageOverviewColumn
  };
}
