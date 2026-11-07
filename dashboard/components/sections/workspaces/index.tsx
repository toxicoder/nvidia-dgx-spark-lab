import type React from "react";

import { SectionFailure } from "@/components/SectionFailure";
import { WorkspacesPanel } from "@/components/WorkspacesPanel";
import { getDevWorkspacesStatus } from "@/lib/host";
import { attempt, sectionFailureMessage } from "@/lib/section-result";

/**
 * Dev Workspaces section: the Coder and Kasm environments.
 *
 * @returns The workspaces panel, or a failure state with retry.
 */
export default async function WorkspacesSection(): Promise<React.JSX.Element> {
  const status = await attempt(getDevWorkspacesStatus);

  if (!status.ok) {
    return <SectionFailure title="Dev Workspaces" message={sectionFailureMessage("workspaces", status.error)} />;
  }

  return <WorkspacesPanel initialStatus={status.data} />;
}
