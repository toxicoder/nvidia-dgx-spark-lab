import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { TOCItemType } from "fumadocs-core/toc";

import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  EditOnGitHub,
  PageBreadcrumb,
  PageFooter
} from "fumadocs-ui/layouts/docs/page";
import { Banner } from "fumadocs-ui/components/banner";

import { mdxComponentsFor } from "@/components/mdx-components";
import { RepoIcon, Wordmark } from "@/components/wordmark";
import { buildPageTree, neighborsOf } from "@/lib/nav";
import { isDevelopmentAlias, REPO_URL, repoFileUrl } from "@/lib/site";
import { source } from "@/lib/source";

/**
 * Enumerate every documentation page for the static export.
 *
 * The published site is `output: "export"`, so each page has to be listed up front;
 * without this the catch-all route would only ever produce the root page.
 */
export function generateStaticParams() {
  return source.generateParams("slug");
}

const tree = buildPageTree(source);

/** "Edit this page" target, honouring the branch-aware `edit_uri` of the old theme. */
function editUrl(path: string): string {
  return repoFileUrl(`docs/${path}`);
}

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

/**
 * Render one documentation page.
 *
 * The compiled MDX module exposes its component through `body` and its table of contents
 * through `toc`; components come from {@link mdxComponentsFor} because the compiled module
 * reads them from `props.components` rather than importing them.
 */
export default async function DocsRoute({ params }: PageProps) {
  const { slug = [] } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const data = page.data as unknown as {
    title?: string;
    description?: string;
    full?: boolean;
    body: (props: { components: Record<string, unknown> }) => ReactNode;
    toc: TOCItemType[];
  };

  const Body = data.body;
  const title = data.title ?? page.path;

  return (
    <DocsLayout
      tree={tree}
      githubUrl={REPO_URL}
      nav={{ title: Wordmark }}
      links={[
        {
          type: "icon",
          label: "Repository",
          icon: <RepoIcon />,
          text: "GitHub",
          url: REPO_URL
        }
      ]}
    >
      {isDevelopmentAlias() && (
        <Banner id="development-alias" variant="normal" changeLayout={false}>
          <span className="font-medium">
            Development docs — these pages track the <code>development</code> branch and may
            describe work that is not released yet.
          </span>
        </Banner>
      )}
      <DocsPage toc={data.toc} full={data.full}>
        <DocsBody>
          <DocsTitle>{title}</DocsTitle>
          {data.description && <DocsDescription>{data.description}</DocsDescription>}
          <Body components={mdxComponentsFor(page)} />
          <PageFooter items={neighborsOf(source, page.path)}>
            <div className="flex flex-wrap items-center gap-4 pt-6">
              <PageBreadcrumb />
              <EditOnGitHub href={editUrl(page.path)} className="ms-auto">
                Edit this page
              </EditOnGitHub>
            </div>
          </PageFooter>
        </DocsBody>
      </DocsPage>
    </DocsLayout>
  );
}

/** Metadata for one page: title falls back to the site title, description is the frontmatter's. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug = [] } = await params;
  const page = source.getPage(slug);
  if (!page) return {};
  const data = page.data as unknown as { title?: string; description?: string };
  return {
    title: data.title ?? page.path,
    description: data.description
  };
}
