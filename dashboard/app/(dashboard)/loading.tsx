import type React from "react";

import { PageHeaderSkeleton, SectionSkeleton } from "@/components/ui/section-skeleton";

/**
 * Loading state for the console overview.
 *
 * The previous skeleton showed two cards for a page that renders thirteen, and
 * said nothing to a screen reader. This one mirrors the overview's actual shape
 * — heading block, KPI band, roll-up — and announces that it is loading.
 *
 * @returns The overview loading UI.
 */
export default function DashboardLoading(): React.JSX.Element {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <SectionSkeleton key={index} compact />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    </div>
  );
}
