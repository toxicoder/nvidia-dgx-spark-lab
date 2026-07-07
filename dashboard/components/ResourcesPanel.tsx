/**
 * Cluster resources panel — GPU, CPU, and memory capacity with periodic refresh.
 */
"use client";

import React from "react";
import { getClusterCapacityAction } from "@/actions/host-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { panelSubheaderClass } from "@/components/panel-styles";
import type { ClusterCapacity, MonitoringStackStatus } from "@/lib/types";
import { Activity, Cpu, ExternalLink, MemoryStick, RefreshCw, Zap } from "lucide-react";

const POLL_MS = 30000;

interface ResourcesPanelProps {
  initialCapacity: ClusterCapacity;
  monitoringStatus?: MonitoringStackStatus;
}

function statusVariant(pct: number): "default" | "secondary" | "destructive" {
  if (pct >= 90) return "destructive";
  if (pct >= 75) return "secondary";
  return "default";
}

function MetricCard({
  label,
  icon: Icon,
  available,
  total,
  pct
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  available: string | number;
  total: string | number;
  pct: number;
}) {
  return (
    <div className="rounded-[var(--md-sys-shape-corner-medium)] border border-border bg-[var(--md-sys-color-surface-container-low)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <Badge variant={statusVariant(pct)} className="text-[10px]">
          {Math.round(pct)}% used
        </Badge>
      </div>
      <div className="text-lg font-semibold tabular-nums tracking-tight">{available}</div>
      <div className="text-[10px] text-muted-foreground">available of {total} allocatable</div>
    </div>
  );
}

/**
 * Polls cluster capacity and renders utilization metric cards with status badges.
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

  if (capacity.error) {
    return <div className="text-sm text-destructive">Resource Guard unavailable: {capacity.error}</div>;
  }

  return (
    <div data-testid="resources-panel" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className={panelSubheaderClass}>
          <Activity className="h-4 w-4" />
          Cluster capacity ({capacity.node_count} node{capacity.node_count === 1 ? "" : "s"})
        </div>
        <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={busy}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          label="GPUs"
          icon={Zap}
          available={capacity.available.gpus}
          total={capacity.allocatable.gpus}
          pct={capacity.utilization.gpu_pct}
        />
        <MetricCard
          label="CPU"
          icon={Cpu}
          available={`${capacity.available.cpu} cores`}
          total={`${capacity.allocatable.cpu} cores`}
          pct={capacity.utilization.cpu_pct}
        />
        <MetricCard
          label="Memory"
          icon={MemoryStick}
          available={capacity.available.memory}
          total={capacity.allocatable.memory}
          pct={capacity.utilization.memory_pct}
        />
      </div>

      {(capacity.utilization.gpu_pct >= 75 ||
        capacity.utilization.cpu_pct >= 75 ||
        capacity.utilization.memory_pct >= 75) &&
        monitoringStatus?.dashboards && (
          <div className="rounded-[var(--md-sys-shape-corner-medium)] border border-border bg-[var(--md-sys-color-surface-container-low)] px-3 py-2">
            <p className="text-[10px] text-muted-foreground">
              Utilization above 75% — inspect detailed metrics in Grafana.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {monitoringStatus.dashboards
                .filter((d) => d.uid === "spark-gpu" || d.uid === "spark-overview" || d.uid === "spark-nodes")
                .map((dash) => (
                  <a
                    key={dash.uid}
                    href={dash.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {dash.title}
                  </a>
                ))}
            </div>
          </div>
        )}

      <p className="text-[10px] text-muted-foreground">
        Available = allocatable − requested − policy headroom (15% / 64Gi per node). Protects SSH and dashboard under
        load.
      </p>
    </div>
  );
}
