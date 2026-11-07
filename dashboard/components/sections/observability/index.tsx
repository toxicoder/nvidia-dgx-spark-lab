import type React from "react";

import { ObservabilityPanel } from "@/components/ObservabilityPanel";
import { SectionFailure } from "@/components/SectionFailure";
import { getMonitoringStackStatus } from "@/lib/host";
import { attempt, sectionFailureMessage } from "@/lib/section-result";

/**
 * Observability section: Grafana, Prometheus, and the node exporters.
 *
 * @returns The observability panel, or a failure state with retry.
 */
export default async function ObservabilitySection(): Promise<React.JSX.Element> {
  const status = await attempt(getMonitoringStackStatus);

  if (!status.ok) {
    return <SectionFailure title="Observability" message={sectionFailureMessage("observability", status.error)} />;
  }

  return <ObservabilityPanel initialStatus={status.data} />;
}
