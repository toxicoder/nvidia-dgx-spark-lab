"use client";

import {
  SearchDialog as SearchDialogRoot,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps
} from "fumadocs-ui/components/dialog/search";
import { useDocsSearch } from "fumadocs-core/search/client";
import { staticClient } from "fumadocs-core/search/client/orama-static";
import { useI18n } from "fumadocs-ui/contexts/i18n";

/**
 * Search over the exported index.
 *
 * The build is a static export, so there is no server to query at click time: the index
 * that `app/api/search/route.ts` writes out is fetched once and matched in the browser by
 * the Orama/ZBSearch static client.  Results cover titles, descriptions, headings and body
 * text, plus the `tags` frontmatter contributed through `buildSearchIndex` in
 * `lib/source.ts`.
 */
export function SearchDialog(props: SharedProps) {
  const { locale } = useI18n();
  const { search, setSearch, query } = useDocsSearch({
    client: staticClient({ locale })
  });

  return (
    <SearchDialogRoot search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data !== "empty" ? query.data : null} />
      </SearchDialogContent>
    </SearchDialogRoot>
  );
}
