/**
 * Contract for the catch-all route that renders every documentation page.
 *
 * One file answers for the whole corpus, so the behaviour a reader depends on all sits
 * here: the root slug serves the overview, an unknown slug lands on the 404 document
 * instead of an empty shell, the "Edit this page" link points at the branch the alias was
 * built from (otherwise a contributor edits a file they are not reading), the development
 * banner appears only on development docs, and the compiled MDX module gets its component
 * map -- a page imports nothing, so a missing map means a blank body.
 *
 * Fumadocs' chrome, the content loader, the nav builder and the MDX component map are all
 * mocked at the boundary: this file pins what the route passes to them and what it renders
 * for them, which is the part that breaks silently when the site is upgraded.
 */

import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DocsRoute, { generateMetadata, generateStaticParams } from "../../app/[[...slug]]/page";
import { RepoIcon, Wordmark } from "@/components/wordmark";
import { REPO_URL } from "../../lib/site";

vi.mock("@/components/wordmark", () => ({
  RepoIcon: () => <svg data-testid="repo-icon" />,
  Wordmark: () => <span data-testid="wordmark">wordmark</span>
}));

/** Everything the route talks to, so each assertion can read what it was handed. */
const h = vi.hoisted(() => {
  interface Capture {
    source: { getPage: unknown; generateParams: unknown };
    getPage: ReturnType<typeof vi.fn>;
    generateParams: ReturnType<typeof vi.fn>;
    buildPageTree: ReturnType<typeof vi.fn>;
    neighborsOf: ReturnType<typeof vi.fn>;
    mdxComponentsFor: ReturnType<typeof vi.fn>;
    notFound: ReturnType<typeof vi.fn>;
    treeSources: unknown[];
    bodyComponents: unknown[];
    layoutProps: Record<string, unknown> | undefined;
    pageProps: Record<string, unknown> | undefined;
    footerProps: Record<string, unknown> | undefined;
    bannerProps: Record<string, unknown> | undefined;
    editProps: Record<string, unknown> | undefined;
  }
  const capture = {} as Capture;
  capture.getPage = vi.fn();
  capture.generateParams = vi.fn();
  capture.source = { getPage: capture.getPage, generateParams: capture.generateParams };
  capture.buildPageTree = vi.fn((source: unknown) => {
    capture.treeSources.push(source);
    return { $id: "root", type: "root", name: "Documentation", children: [] };
  });
  capture.neighborsOf = vi.fn(() => ({
    previous: { name: "Previous page", url: "/previous" },
    next: { name: "Next page", url: "/next" }
  }));
  capture.mdxComponentsFor = vi.fn(() => ({ a: function ContentLink() { return null; } }));
  capture.notFound = vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
  capture.treeSources = [];
  capture.bodyComponents = [];
  return capture;
});

/** The compiled MDX module's component entry point, as the MDX compiler emits it. */
function PageBody(props: { components: Record<string, unknown> }) {
  h.bodyComponents.push(props.components);
  return <p data-testid="page-body">compiled body</p>;
}

vi.mock("@/lib/source", () => ({ source: h.source }));
vi.mock("@/lib/nav", () => ({ buildPageTree: h.buildPageTree, neighborsOf: h.neighborsOf }));
vi.mock("@/components/mdx-components", () => ({ mdxComponentsFor: h.mdxComponentsFor }));
vi.mock("next/navigation", () => ({ notFound: h.notFound }));

vi.mock("fumadocs-ui/layouts/docs", () => ({
  DocsLayout: (props: { children?: ReactNode }) => {
    h.layoutProps = props;
    return <div data-testid="docs-layout">{props.children}</div>;
  }
}));

vi.mock("fumadocs-ui/layouts/docs/page", () => ({
  DocsPage: (props: { children?: ReactNode }) => {
    h.pageProps = props;
    return <main data-testid="docs-page">{props.children}</main>;
  },
  DocsBody: (props: { children?: ReactNode }) => (
    <article data-testid="docs-body">{props.children}</article>
  ),
  DocsTitle: (props: { children?: ReactNode }) => <h1>{props.children}</h1>,
  DocsDescription: (props: { children?: ReactNode }) => <p data-testid="docs-description">{props.children}</p>,
  PageFooter: (props: { children?: ReactNode }) => {
    h.footerProps = props;
    return <footer data-testid="page-footer">{props.children}</footer>;
  },
  PageBreadcrumb: () => <nav data-testid="breadcrumb">Breadcrumb</nav>,
  EditOnGitHub: (props: { children?: ReactNode; href?: string }) => {
    h.editProps = props;
    return <a data-testid="edit-link" href={props.href}>{props.children}</a>;
  }
}));

vi.mock("fumadocs-ui/components/banner", () => ({
  Banner: (props: { children?: ReactNode }) => {
    h.bannerProps = props;
    return <aside data-testid="banner">{props.children}</aside>;
  }
}));

/** A page as the content loader hands it over: compiled body plus frontmatter. */
function docPage(
  fields: {
    path?: string;
    /** Address the loader serves the page at; an index page keeps its directory url. */
    url?: string;
    data?: Record<string, unknown>;
    /** Frontmatter keys to drop, for pages the generators write without any. */
    omit?: ("title" | "description")[];
  } = {}
) {
  const path = fields.path ?? "operate/dashboard.md";
  const data: Record<string, unknown> = {
    title: "Dashboard",
    description: "The lab dashboard and the actions it exposes.",
    toc: [{ title: "Actions", url: "#actions" }],
    body: PageBody,
    ...fields.data
  };
  for (const key of fields.omit ?? []) delete data[key];
  const derived = `/${path.replace(/\.(?:md|mdx)$/, "")}`;
  return { path, url: fields.url ?? derived, data };
}

/** Render the route for a slug; `undefined` params stand for the root index page. */
async function renderRoute(slug?: string[]) {
  const params = Promise.resolve(slug === undefined ? {} : { slug });
  const element = await DocsRoute({ params });
  return render(element);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  // A released-alias build: no alias env at all, and no ref override.
  vi.stubEnv("DGX_DOCS_VERSION", "");
  vi.stubEnv("MIKE_DOCS_VERSION", "");
  vi.stubEnv("DGX_DOCS_GIT_REF", "");
  h.bodyComponents.length = 0;
  h.getPage.mockReturnValue(docPage());
});

describe("generateStaticParams", () => {
  it("enumerates every content page under the catch-all segment", () => {
    h.generateParams.mockReturnValue([{ slug: [] }, { slug: ["operate", "dashboard"] }]);
    expect(generateStaticParams()).toEqual([{ slug: [] }, { slug: ["operate", "dashboard"] }]);
    expect(h.generateParams).toHaveBeenCalledWith("slug");
  });
});

describe("sidebar tree", () => {
  it("builds the page tree once from the content loader, not per request", () => {
    expect(h.treeSources).toHaveLength(1);
    expect(h.treeSources[0]).toBe(h.source);
  });

  it("hands the built tree to the docs layout", async () => {
    await renderRoute(["operate", "dashboard"]);
    expect(h.layoutProps?.tree).toEqual({ $id: "root", type: "root", name: "Documentation", children: [] });
  });
});

describe("DocsRoute", () => {
  it("serves the overview for the root slug", async () => {
    h.getPage.mockReturnValue(docPage({ path: "index.md", url: "/" }));
    await renderRoute();
    expect(h.getPage).toHaveBeenCalledWith([]);
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
  });

  it("looks the page up by the slug it was routed for", async () => {
    await renderRoute(["concepts", "interconnect-nccl"]);
    expect(h.getPage).toHaveBeenCalledWith(["concepts", "interconnect-nccl"]);
    expect(screen.getByTestId("docs-layout")).toBeInTheDocument();
    expect(screen.getByTestId("breadcrumb")).toBeInTheDocument();
  });

  it("renders a generated page whose frontmatter carries nothing", async () => {
    h.getPage.mockReturnValue(
      docPage({ path: "generated/shell/reference.md", omit: ["title", "description"] })
    );
    await renderRoute(["generated", "shell", "reference"]);
    expect(screen.getByRole("heading", { level: 1, name: "generated/shell/reference.md" })).toBeInTheDocument();
    expect(screen.queryByTestId("docs-description")).toBeNull();
  });

  it("falls back to the file path when frontmatter carries no title", async () => {
    h.getPage.mockReturnValue(
      docPage({ path: "generated/shell/reference.md", omit: ["title"] })
    );
    await renderRoute(["generated", "shell", "reference"]);
    expect(screen.getByRole("heading", { level: 1, name: "generated/shell/reference.md" })).toBeInTheDocument();
    expect(screen.getByTestId("docs-description")).toBeInTheDocument();
  });

  it("shows the frontmatter description under the title", async () => {
    await renderRoute(["operate", "dashboard"]);
    expect(screen.getByTestId("docs-description")).toHaveTextContent(
      "The lab dashboard and the actions it exposes."
    );
  });

  it("renders the compiled body with the component map built for that page", async () => {
    const page = docPage();
    h.getPage.mockReturnValue(page);
    await renderRoute(["operate", "dashboard"]);
    expect(h.mdxComponentsFor).toHaveBeenCalledWith(page);
    expect(screen.getByTestId("page-body")).toBeInTheDocument();
    expect(h.bodyComponents[0]).toEqual({ a: expect.any(Function) });
  });

  it("passes the frontmatter table of contents to the page frame", async () => {
    await renderRoute(["operate", "dashboard"]);
    expect(h.pageProps?.toc).toEqual([{ title: "Actions", url: "#actions" }]);
    expect(h.pageProps?.full).toBeUndefined();
  });

  it("lets a page take the full content width", async () => {
    h.getPage.mockReturnValue(docPage({ data: { full: true, title: "Wide", body: PageBody } }));
    await renderRoute(["glossary"]);
    expect(h.pageProps?.full).toBe(true);
  });

  it("walks the reader to the neighbouring pages in nav order", async () => {
    await renderRoute(["operate", "dashboard"]);
    expect(h.neighborsOf).toHaveBeenCalledWith(h.source, "operate/dashboard.md");
    expect(h.footerProps?.items).toEqual({
      previous: { name: "Previous page", url: "/previous" },
      next: { name: "Next page", url: "/next" }
    });
  });

  it("links the edit button to the file on the released ref", async () => {
    await renderRoute(["operate", "dashboard"]);
    expect(screen.getByTestId("edit-link")).toHaveTextContent("Edit this page");
    expect(h.editProps?.href).toBe(`${REPO_URL}/blob/main/docs/operate/dashboard.md`);
  });

  it("links the edit button to the development ref on development docs", async () => {
    vi.stubEnv("DGX_DOCS_VERSION", "development");
    await renderRoute(["operate", "dashboard"]);
    expect(h.editProps?.href).toBe(`${REPO_URL}/blob/development/docs/operate/dashboard.md`);
  });

  it("warns readers that development docs may describe unreleased work", async () => {
    vi.stubEnv("DGX_DOCS_VERSION", "development");
    await renderRoute(["operate", "dashboard"]);
    expect(screen.getByTestId("banner")).toHaveTextContent("Development docs");
    expect(h.bannerProps).toMatchObject({ id: "development-alias", variant: "normal", changeLayout: false });
  });

  it("keeps the development banner off the released docs", async () => {
    await renderRoute(["operate", "dashboard"]);
    expect(screen.queryByTestId("banner")).toBeNull();
  });

  it("names the repository for the header link and points it at the repo", async () => {
    await renderRoute(["operate", "dashboard"]);
    expect(h.layoutProps?.githubUrl).toBe("https://github.com/toxicoder/nvidia-dgx-spark-lab");
    expect(h.layoutProps?.links).toEqual([
      {
        type: "icon",
        label: "Repository",
        icon: expect.objectContaining({ type: RepoIcon }),
        text: "GitHub",
        url: REPO_URL
      }
    ]);
    expect((h.layoutProps?.nav as { title: unknown }).title).toBe(Wordmark);
  });

  it("sends an unknown slug to the 404 document rather than rendering an empty page", async () => {
    h.getPage.mockReturnValue(undefined);
    await expect(DocsRoute({ params: Promise.resolve({ slug: ["nope"] }) })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(h.getPage).toHaveBeenCalledWith(["nope"]);
    expect(h.notFound).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("docs-layout")).toBeNull();
  });
});

describe("generateMetadata", () => {
  it("titles the tab from the frontmatter of the root page", async () => {
    h.getPage.mockReturnValue(docPage({ path: "index.md", url: "/" }));
    await expect(generateMetadata({ params: Promise.resolve({}) })).resolves.toEqual({
      title: "Dashboard",
      description: "The lab dashboard and the actions it exposes."
    });
    expect(h.getPage).toHaveBeenCalledWith([]);
  });

  it("titles the tab from the frontmatter of a nested page", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: ["operate", "dashboard"] }) })
    ).resolves.toEqual({
      title: "Dashboard",
      description: "The lab dashboard and the actions it exposes."
    });
    expect(h.getPage).toHaveBeenCalledWith(["operate", "dashboard"]);
  });

  it("falls back to the file path when a generated page has no title", async () => {
    h.getPage.mockReturnValue(
      docPage({ path: "generated/shell/reference.md", omit: ["title", "description"] })
    );
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: ["generated", "shell", "reference"] }) })
    ).resolves.toEqual({ title: "generated/shell/reference.md", description: undefined });
  });

  it("leaves an unknown slug untitleable so the site default wins", async () => {
    h.getPage.mockReturnValue(undefined);
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: ["nope"] }) })
    ).resolves.toEqual({});
    expect(h.notFound).not.toHaveBeenCalled();
  });
});
