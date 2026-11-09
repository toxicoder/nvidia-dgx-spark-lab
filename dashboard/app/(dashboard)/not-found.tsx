import type React from "react";
import Link from "next/link";
import { Compass } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DASHBOARD_SECTIONS } from "@/lib/types";

/**
 * Not-found page for the console shell.
 *
 * `notFound()` in `app/(dashboard)/[section]/page.tsx` routes here for any segment outside the
 * `DASHBOARD_SECTIONS` closed set. Without this file Next rendered its unstyled default inside
 * the dashboard chrome: no heading that matched the console's outline, no way back, and text
 * set in the platform font, which was the last page in the app not using the bundled typeface.
 *
 * @returns The heading, an explanation, and the route back to the overview.
 */
export default function NotFound(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Section not found"
        description={`The console has ${DASHBOARD_SECTIONS.length} sections. Check the address, or start from the overview.`}
      />
      <EmptyState
        icon={Compass}
        title="No section lives at that address"
        description="Every section is listed on the overview and in the sidebar, so nothing here is lost."
        action={
          <Button asChild>
            <Link href="/">Back to the overview</Link>
          </Button>
        }
      />
    </div>
  );
}
