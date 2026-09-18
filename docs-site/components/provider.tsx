"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

import { SearchDialog } from "@/components/search-dialog";

/**
 * Wires the framework contexts the docs chrome needs.
 *
 * `next-themes` is enabled so the light/dark switch drives the `.dark` class that the
 * Voltage token block in `app/global.css` keys off.  Search uses the static Orama/ZBSearch
 * client, which fetches the exported index from the `/api/search` route at runtime — that
 * is what keeps search working in the `output: "export"` build published to GitHub Pages.
 */
export function Provider({ children }: { children: ReactNode }) {
  return (
    <RootProvider theme={{ attribute: "class", defaultTheme: "system" }} search={{ SearchDialog }}>
      {children}
    </RootProvider>
  );
}
