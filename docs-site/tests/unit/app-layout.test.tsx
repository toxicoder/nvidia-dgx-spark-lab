/**
 * Contract for the root layout and the metadata every exported page inherits.
 *
 * This layout is the only thing wrapped around an exported page, so it owns three
 * reader-visible behaviours.  `lang="en"` is what a screen reader picks its pronunciation
 * from.  `suppressHydrationWarning` is what lets the theme script rewrite the `<html>`
 * class before hydration without failing the build.  And the metadata is what a reader
 * actually sees in a browser tab or a search-result snippet: the `%s` template is how a
 * page title keeps the project name beside it.
 *
 * `Provider` is mocked because the real one mounts the theme context and the Orama search
 * client, neither of which the layout itself contributes.
 */

import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RootLayout, { metadata } from "../../app/layout";
import { Provider } from "@/components/provider";
import { SITE_NAME } from "../../lib/site";

vi.mock("@/components/provider", () => ({
  Provider: ({ children }: { children: ReactNode }) => <div data-testid="provider">{children}</div>
}));

/** Props of a host element the layout returns, read off the element tree. */
interface HostProps {
  lang?: string;
  className?: string;
  suppressHydrationWarning?: boolean;
  children?: ReactElement<HostProps>;
}

/** The `<html>` element the layout renders, with its `<body>` child. */
function documentShell() {
  const html = RootLayout({ children: null }) as unknown as ReactElement<HostProps>;
  return { html, body: html.props.children as ReactElement<HostProps> };
}

describe("RootLayout", () => {
  it("declares the document language for assistive tech", () => {
    const { html } = documentShell();
    expect(html.type).toBe("html");
    expect(html.props.lang).toBe("en");
  });

  it("opts the shell out of hydration warnings so the theme script can set the class", () => {
    const { html, body } = documentShell();
    expect(html.props.suppressHydrationWarning).toBe(true);
    expect(body.props.suppressHydrationWarning).toBe(true);
  });

  it("lays the page out as a full-height flex column", () => {
    const { body } = documentShell();
    expect(body.type).toBe("body");
    expect(body.props.className?.split(" ")).toEqual(
      expect.arrayContaining(["flex", "flex-col", "min-h-screen"])
    );
  });

  it("hands the page content to the framework providers", () => {
    const { body } = documentShell();
    const provider = body.props.children as ReactElement<{ children?: ReactNode }>;
    expect(provider.type).toBe(Provider);
    expect(provider.props.children).toBeNull();
  });

  it("renders the page content inside the providers", () => {
    // Rendered into `document.body`: the layout emits `<html>`/`<body>` itself, and a div
    // container would make React flag the nesting the document shell legitimately has.
    const { getByTestId, getByRole } = render(
      <RootLayout>
        <h1>Getting started</h1>
      </RootLayout>,
      { container: document.body }
    );
    const provider = getByTestId("provider");
    expect(getByRole("heading", { name: "Getting started" }).parentElement).toBe(provider);
  });
});

describe("root metadata", () => {
  /** The title field, narrowed to the `{default, template}` shape the layout sets. */
  const title = () => metadata.title as { default: string; template: string };

  it("names the project in the tab title of a page that sets none", () => {
    // U+2014 is the separator the theme's title uses; written as an escape so this file
    // stays plain ASCII.
    expect(title().default).toBe(`${SITE_NAME} ${"\u2014"} Docs`);
  });

  it("keeps the project name beside every per-page title", () => {
    expect(title().template).toBe(`%s | ${SITE_NAME}`);
  });

  it("describes the site for a search-result snippet", () => {
    expect(metadata.description).toBe(
      `Operator documentation for the ${SITE_NAME} Kubernetes lab.`
    );
  });
});
