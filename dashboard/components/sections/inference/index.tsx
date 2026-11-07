import type React from "react";

import { InferencePanel } from "@/components/InferencePanel";
import { NemotronStackPanel } from "@/components/NemotronStackPanel";
import { SectionFailure } from "@/components/SectionFailure";
import {
  getClusterCapacity,
  getInferenceWorkloadsStatus,
  getNemotronCatalog,
  getNemotronStackStatus
} from "@/lib/host";
import { attempt, firstError, sectionFailureMessage } from "@/lib/section-result";
import type { ClusterCapacity, NemotronCatalog, NemotronStackStatus } from "@/lib/types";

/**
 * Inference section: the Nemotron multi-node stacks and the single-model jobs.
 *
 * These share one route because they share one decision — whether there is
 * headroom — and an operator weighing it should not have to hold two pages in
 * their head. Each half degrades on its own, so a dead Nemotron catalog does
 * not hide the jobs the operator can still start.
 *
 * @returns The stack and job panels, or failure states with retry.
 */
export default async function InferenceSection(): Promise<React.JSX.Element> {
  const [catalog, stackStatus, capacity, jobs] = await Promise.all([
    attempt(getNemotronCatalog),
    attempt(getNemotronStackStatus),
    attempt(getClusterCapacity),
    attempt(getInferenceWorkloadsStatus)
  ]);

  const catalogData: NemotronCatalog | null = catalog.ok ? catalog.data : null;
  const stackData: NemotronStackStatus | null = stackStatus.ok ? stackStatus.data : null;
  const capacityData: ClusterCapacity | null = capacity.ok ? capacity.data : null;

  return (
    <div className="space-y-6">
      {catalogData && stackData && capacityData ? (
        <NemotronStackPanel
          initialCatalog={catalogData}
          initialStackStatus={stackData}
          clusterCapacity={capacityData}
        />
      ) : (
        <SectionFailure
          title="Nemotron stacks"
          message={sectionFailureMessage("inference", firstError([catalog, stackStatus, capacity]))}
        />
      )}

      {jobs.ok ? (
        <InferencePanel initialStatus={jobs.data} />
      ) : (
        <SectionFailure title="Workload jobs" message={sectionFailureMessage("inference", jobs.error)} />
      )}
    </div>
  );
}
