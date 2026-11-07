import type React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/PageHeader";
import { SectionRollup } from "@/components/SectionRollup";
import { SectionFailure } from "@/components/SectionFailure";
import { MetricTile } from "@/components/ui/metric-tile";
import { SectionSkeleton } from "@/components/ui/section-skeleton";
import { listContainers, getClusterCapacity, getInferenceWorkloadsStatus } from "@/lib/host";
import { attempt, sectionFailureMessage } from "@/lib/section-result";

/**
 * Console landing page: orientation, not state.
 *
 * This route used to be the whole dashboard — ten sections, fourteen awaited
 * host reads, one shared skeleton, one shared error page. It is now the
 * overview: the handful of numbers that answer "is the lab healthy", plus a
 * link to each section, which loads its own data on its own route. The slowest
 * read in the console, the `/mnt/models` walk, is off the landing path
 * entirely, which is why this page can paint immediately.
 */
export const dynamic = "force-dynamic";

/** Next.js document metadata for the overview. */
export const metadata: Metadata = {
  title: "Overview",
  description: "Lab health at a glance, with a route to every operator section."
};

/**
 * The four numbers that answer "is the lab healthy right now".
 *
 * GPU headroom leads because it gates everything an operator is about to do.
 * Each read degrades on its own tile, so a dead kubelet costs one number.
 *
 * Exported for tests: it is an async server component behind a Suspense
 * boundary, so the only way to assert on its resolved output is to await it.
 *
 * @returns The KPI band.
 */
export async function OverviewKpis(): Promise<React.JSX.Element> {
  const [capacity, containers, workloads] = await Promise.all([
    attempt(getClusterCapacity),
    attempt(listContainers),
    attempt(getInferenceWorkloadsStatus)
  ]);

  if (!capacity.ok) {
    return <SectionFailure title="Cluster headroom" message={sectionFailureMessage("resources", capacity.error)} />;
  }

  const { free, allocatable, utilization } = capacity.data;
  // A host probe that answers with something other than an array is a failure to
  // report, not a zero to print — the old page silently rendered "0 running".
  const runningContainers = containers.ok && Array.isArray(containers.data) ? containers.data.length : null;
  const runningJobs =
    workloads.ok && Array.isArray(workloads.data.jobs)
      ? workloads.data.jobs.filter((job) => job.state === "running").length
      : null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricTile
        label="GPUs free"
        value={`${free.gpus}`}
        unit={`of ${allocatable.gpus}`}
        tone={free.gpus === 0 ? "warning" : "ok"}
        hint="What Resource Guard will admit right now"
      />
      <MetricTile
        label="GPU utilisation"
        value={`${Math.round(utilization.gpu_pct)}`}
        unit="%"
        tone={utilization.gpu_pct >= 90 ? "danger" : utilization.gpu_pct >= 75 ? "warning" : "neutral"}
        hint="Across the whole cluster"
      />
      {runningContainers === null ? (
        <MetricTile label="Containers" value="—" hint="Docker did not respond" tone="neutral" />
      ) : (
        <MetricTile label="Containers running" value={`${runningContainers}`} hint="On the Spark host" tone="neutral" />
      )}
      {runningJobs === null ? (
        <MetricTile label="Lanes running" value="—" hint="Inference API did not respond" tone="neutral" />
      ) : (
        <MetricTile
          label="Lanes running"
          value={`${runningJobs}`}
          hint="Inference jobs in the running state"
          tone={runningJobs > 0 ? "ok" : "neutral"}
        />
      )}
    </div>
  );
}

/**
 * Render the console overview.
 *
 * @returns The overview page.
 */
export default function DashboardOverview(): React.JSX.Element {
  return (
    <div className="space-y-8">
      <PageHeader
        title="DGX Spark Lab"
        description="Self-hosted control plane. Every section is its own page, so one unreachable service costs one page."
      />
      <Suspense fallback={<SectionSkeleton compact />}>
        <OverviewKpis />
      </Suspense>
      <SectionRollup />
    </div>
  );
}
