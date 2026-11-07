import type React from "react";

import { ResourcesPanel } from "@/components/ResourcesPanel";
import { SectionFailure } from "@/components/SectionFailure";
import { getClusterCapacity, getMonitoringStackStatus } from "@/lib/host";
import { attempt, sectionFailureMessage } from "@/lib/section-result";

/**
 * Resource Guard section: cluster headroom and the monitoring stack behind it.
 *
 * Headroom is the number the operator checks before starting anything GPU-heavy,
 * so a failure here is surfaced in this frame with a retry rather than thrown
 * past the route boundary. Monitoring is optional input — the panel degrades to
 * "no Grafana" instead of failing when it is down.
 *
 * @returns The Resource Guard panels, or a failure state with retry.
 */
export default async function ResourcesSection(): Promise<React.JSX.Element> {
  const [capacity, monitoring] = await Promise.all([attempt(getClusterCapacity), attempt(getMonitoringStackStatus)]);

  if (!capacity.ok) {
    return <SectionFailure title="Resource Guard" message={sectionFailureMessage("resources", capacity.error)} />;
  }

  return (
    <ResourcesPanel initialCapacity={capacity.data} {...(monitoring.ok ? { monitoringStatus: monitoring.data } : {})} />
  );
}
