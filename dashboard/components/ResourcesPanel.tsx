/**
 * Cluster resources panel: GPU, CPU, and memory headroom with periodic refresh.
 */
"use client";

import React from "react";
import { getClusterCapacityAction } from "@/actions/host-actions";
import { Activity } from "lucide-react";

import { ErrorState } from "@/components/ui/error-state";
import { MetricTile, type MetricTileTone } from "@/components/ui/metric-tile";
import { PanelRefreshButton } from "@/components/ui/panel-refresh-button";
import { Panel, PanelActions, PanelBody, PanelFooter, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { surfaceCardClass } from "@/components/panel-styles";
import type { ClusterCapacity, MonitoringStackStatus } from "@/lib/types";

const POLL_MS = 30000;

/** Dashboards worth linking to when utilization climbs. */
const DASHBOARD_ALLOWLIST = ["spark-gpu", "spark-overview", "spark-nodes"] as const;

interface ResourcesPanelProps {
  initialCapacity: ClusterCapacity;
  monitoringStatus?: MonitoringStackStatus;
}

/**
 * Map utilization onto the metric tones.
 *
 * Utilization climbing is the signal that says "do not start another model", so loudness
 * tracks risk. Below 75% the number stays in the foreground colour rather than going
 * green, because three green tiles compete with each other and none of them is a decision.
 * @param pct - Utilization percentage.
 * @returns The tile tone.
 */
function toneForUtilization(pct: number): MetricTileTone {
  if (pct >= 90) return "danger";
  if (pct >= 75) return "warning";
  return "neutral";
}

/**
 * One resource line: label, available headroom as the headline figure, and the two
 * supporting facts (share of allocatable, and utilization) beneath it.
 * @param props - Label plus the available/allocatable pair and utilization.
 * @param props.label - Resource name.
 * @param props.available - Headroom figure to make the loudest thing on the tile.
 * @param props.total - Allocatable figure for the supporting line.
 * @param props.pct - Utilization percentage.
 * @returns The metric tile.
 */
function CapacityTile({
  label,
  available,
  total,
  pct
}: {
  label: string;
  available: string | number;
  total: string | number;
  pct: number;
}): React.JSX.Element {
  return (
    <MetricTile
      label={label}
      value={available}
      tone={toneForUtilization(pct)}
      hint={
        <>
          <span>available of {total} allocatable</span>
          <span className="tabular-nums">{Math.round(pct)}% used</span>
        </>
      }
    />
  );
}

/**
 * Polls cluster capacity and renders headroom as three decision-ready tiles.
 *
 * The panel owns its frame: the section wrapper is a data loader, so the heading and the
 * refresh control live here, beside the state they act on. A failed read keeps the header
 * and offers a retry, because Resource Guard is the one gate an operator most needs to
 * re-query without losing the page.
 * @param props.initialCapacity - Pre-fetched {@link ClusterCapacity}.
 * @param props.monitoringStatus - Optional monitoring stack status for deep links.
 * @returns Cluster resources panel JSX.
 */
export function ResourcesPanel({ initialCapacity, monitoringStatus }: ResourcesPanelProps): React.JSX.Element {
  const [capacity, setCapacity] = React.useState(initialCapacity);
  const [busy, setBusy] = React.useState(false);
  const { toast } = useToast();

  const refresh = React.useCallback(async () => {
    setBusy(true);
    try {
      const next = await getClusterCapacityAction();
      setCapacity(next);
    } catch (e) {
      toast({ title: "Capacity refresh failed", description: String(e), variant: "error" });
    } finally {
      setBusy(false);
    }
  }, [toast]);

  React.useEffect(() => {
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const nodeLabel = `Cluster capacity (${capacity.node_count} node${capacity.node_count === 1 ? "" : "s"})`;
  const hot =
    capacity.utilization.gpu_pct >= 75 || capacity.utilization.cpu_pct >= 75 || capacity.utilization.memory_pct >= 75;
  const dashboards = monitoringStatus?.dashboards?.filter((d) =>
    (DASHBOARD_ALLOWLIST as readonly string[]).includes(d.uid)
  );

  return (
    <Panel data-testid="resources-panel">
      <PanelHeader>
        <PanelTitle>
          <span className="inline-flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {nodeLabel}
          </span>
        </PanelTitle>
        <PanelActions>
          <PanelRefreshButton onClick={() => void refresh()} busy={busy} />
        </PanelActions>
      </PanelHeader>

      <PanelBody>
        {capacity.error ? (
          <ErrorState
            title="Resource Guard unavailable"
            message={capacity.error}
            onRetry={() => void refresh()}
            retryLabel="Retry capacity check"
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <CapacityTile
                label="GPUs"
                available={capacity.available.gpus}
                total={capacity.allocatable.gpus}
                pct={capacity.utilization.gpu_pct}
              />
              <CapacityTile
                label="CPU"
                available={`${capacity.available.cpu} cores`}
                total={`${capacity.allocatable.cpu} cores`}
                pct={capacity.utilization.cpu_pct}
              />
              <CapacityTile
                label="Memory"
                available={capacity.available.memory}
                total={capacity.allocatable.memory}
                pct={capacity.utilization.memory_pct}
              />
            </div>

            {hot && dashboards && dashboards.length > 0 ? (
              <div className={surfaceCardClass}>
                <p className="text-xs text-muted-foreground">
                  Utilization above 75%. Inspect detailed metrics in Grafana before starting another workload.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {dashboards.map((dash) => (
                    <a
                      key={dash.uid}
                      href={dash.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      {dash.title}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            <PanelFooter className="px-0 pb-0">
              Available = allocatable - requested - policy headroom (15% / 24Gi per node). Protects SSH and dashboard
              under load.
            </PanelFooter>
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
