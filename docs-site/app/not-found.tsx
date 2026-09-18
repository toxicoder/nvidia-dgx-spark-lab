/**
 * 404 page for the exported site.
 *
 * GitHub Pages serves this file for unknown URLs, which is what keeps deep links working
 * after the migration: the MkDocs deployment had `use_directory_urls`-style routing and the
 * new build has no server to fall back on, so the not-found document is the client-side
 * entry point.
 */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-2xl font-bold text-fd-foreground">Page not found</h1>
      <p className="mt-3 text-fd-muted-foreground">
        That page is not part of the documentation.  Use search, or start from the
        <a className="text-fd-primary underline underline-offset-2" href="/">
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
