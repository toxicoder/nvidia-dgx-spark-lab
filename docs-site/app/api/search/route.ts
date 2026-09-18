import { search } from "@/lib/source";

/**
 * Search index for the static export.
 *
 * `output: "export"` has no Node server at runtime, so the index is written out at build
 * time and the browser-side client (`components/search-dialog.tsx`) fetches it.  `dynamic`
 * tells the exporter to evaluate the route during the build; `staticGET` is the exportable
 * form of the handler that `createFromSource` builds.
 */
export const dynamic = "force-static";

export const { staticGET: GET } = search;
