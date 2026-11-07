import type React from "react";

import { PageHeaderSkeleton, SectionSkeleton } from "@/components/ui/section-skeleton";

/**
 * Loading state for a single console section.
 *
 * Shape matches what the route actually renders — a heading block then one
 * card — so the swap does not move content under the cursor. It announces
 * itself, which the previous whole-page skeleton did not.
 *
 * @returns The section loading UI.
 */
export default function SectionLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <SectionSkeleton />
    </div>
  );
}
