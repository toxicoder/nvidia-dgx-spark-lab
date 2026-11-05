import { basePath } from "@/lib/site";

/**
 * 404 page for the exported site.
 *
 * GitHub Pages serves this file for unknown URLs, which is what keeps deep links working
 * after the migration: the MkDocs deployment had `use_directory_urls`-style routing and the
 * new build has no server to fall back on, so the not-found document is the client-side
 * entry point.
 */
export default function NotFound() {
  // The prefix has to be spelled out here. next.config.ts feeds Next's basePath from the
  // published alias, and Next applies that prefix to next/link, not to a plain anchor, so an
  // unprefixed "/" lands on the Pages origin root instead of the deployed overview.
  const siteRoot = `${basePath()}/`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-2xl font-bold text-fd-foreground">Page not found</h1>
      <p className="mt-3 text-fd-muted-foreground">
        That page is not part of the documentation.  Use search, or start from the
        <a className="text-fd-primary underline underline-offset-2" href={siteRoot}>
          {" "}
          overview
        </a>
        .
      </p>
    </main>
  );
}

/** Rendered inside the root layout, which supplies the theme providers. */
export const metadata = { title: "Page not found" };
