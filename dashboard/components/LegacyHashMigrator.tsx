"use client";

import { useEffect } from "react";
import type React from "react";
import { usePathname, useRouter } from "next/navigation";

import { DASHBOARD_SECTIONS, type DashboardSectionSlug } from "@/lib/types";

/**
 * Old hashes that meant something other than a section and must be left alone.
 * `#main` is the skip-link target the shell owns.
 */
const NON_SECTION_HASHES = new Set(["main"]);

/**
 * Resolve a legacy `#section` fragment to its section slug.
 *
 * @param hash - `window.location.hash`, with or without the leading `#`.
 * @returns The matching slug, or `undefined` when it is not a section.
 */
export function legacyHashToSlug(hash: string): DashboardSectionSlug | undefined {
  const candidate = hash.replace(/^#/, "");
  if (candidate.length === 0 || NON_SECTION_HASHES.has(candidate)) return undefined;
  return DASHBOARD_SECTIONS.find((slug) => slug === candidate);
}

/**
 * Carry a bookmarked `/#section` URL to its new route.
 *
 * Sections used to be anchors on `/`; they are now routes. Operators have the
 * old URLs in runbooks and browser bookmarks, and a fragment is the one part of
 * a URL that never reaches the server, so middleware cannot rewrite it — this
 * small client hop is what makes the old links land on the right section
 * instead of dumping the operator on the overview.
 *
 * @returns `null`; the component renders nothing.
 */
export function LegacyHashMigrator(): React.JSX.Element | null {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;
    const slug = legacyHashToSlug(window.location.hash);
    if (!slug) return;
    router.replace(`/${slug}`);
  }, [pathname, router]);

  return null;
}
