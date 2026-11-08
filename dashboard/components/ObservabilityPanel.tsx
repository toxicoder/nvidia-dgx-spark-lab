/**
 * Observability panel: Grafana/Headlamp status and deep links to provisioned dashboards.
 */
"use client";

import React from "react";
import { getMonitoringStackStatusAction } from "@/actions/host-actions";
import { Activity, BarChart3, Check, Gauge, LayoutDashboard, Server, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type StatusBadgeMap } from "@/components/ui/status-badge";
import { Panel, PanelActions, PanelBody, PanelFooter, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { PanelRefreshButton } from "@/components/ui/panel-refresh-button";
import { useToast } from "@/components/ui/toast";
import { surfaceCardClass } from "@/components/panel-styles";
import { type MonitoringServiceState, type MonitoringStackStatus } from "@/lib/types";

const POLL_MS = 30000;

interface ObservabilityPanelProps {
  initialStatus: MonitoringStackStatus;
}

/**
 * One state map for the whole monitoring stack.
 *
 * Declaring it over the closed `MonitoringServiceState` set means a state added in
 * `lib/types` is a compile error here. The previous per-panel `stateBadge` fell through to
 * a grey "stopped" badge for anything it did not recognise, so an `error` component read
 * the same as one the operator had stopped deliberately.
 */
const MONITORING_STATE_MAP: StatusBadgeMap<MonitoringServiceState> = {
  running: { label: "running", variant: "ok", icon: Check },
  starting: { label: "starting", variant: "warning" },
  error: { label: "error", variant: "danger", icon: Activity },
  stopped: { label: "stopped", variant: "muted" }
};

/**
 * One row of the stack inventory: component name, pod readiness, and health.
 * @param props - Row label and its service status.
 * @param props.label - Component name as the operator knows it.
 * @param props.status - Readiness and state from the host.
 * @returns The row.
 */
function ComponentRow({
  label,
  status
}: {
  label: string;
  status: MonitoringStackStatus["grafana"];
}): React.JSX.Element {
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-2 ${surfaceCardClass}`}>
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-xs tabular-nums text-muted-foreground">
          {status.readyPods}/{status.totalPods} pods
        </span>
        <StatusBadge state={status.state} map={MONITORING_STATE_MAP} />
      </span>
    </div>
  );
}

/** Pick a glyph that says what a dashboard is about. */
function dashboardIcon(uid: string): LucideIcon {
  if (uid.includes("gpu")) return Gauge;
  if (uid.includes("k8s") || uid.includes("nodes")) return Server;
  if (uid.includes("overview")) return LayoutDashboard;
  return BarChart3;
}

/**
 * Read-only observability gateway: links into Grafana and Headlamp.
 *
 * The panel owns its frame, so the heading and the refresh control sit beside the state
 * they act on. Every state of the closed set renders, so a component that has never come
 * up is distinguishable from one that was stopped on purpose.
 * @param props.initialStatus - Pre-fetched {@link MonitoringStackStatus}.
 * @returns Observability panel JSX.
 */
export function ObservabilityPanel({ initialStatus }: ObservabilityPanelProps): React.JSX.Element {
  const [status, setStatus] = React.useState(initialStatus);
  const [busy, setBusy] = React.useState(false);
  const { toast } = useToast();

  const refresh = React.useCallback(async () => {
    setBusy(true);
    try {
      const next = await getMonitoringStackStatusAction();
      setStatus(next);
    } catch (e) {
      toast({ title: "Observability status failed", description: String(e), variant: "error" });
    } finally {
      setBusy(false);
    }
  }, [toast]);

  React.useEffect(() => {
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const preferSso = process.env.NEXT_PUBLIC_TRUST_PROXY_AUTH === "1" || process.env.TRUST_PROXY_AUTH === "1";
  const grafanaUrl =
    (preferSso ? status.grafana.urls?.sso : status.grafana.urls?.nodeport) ||
    status.grafana.urls?.nodeport ||
    status.grafana.urls?.sso ||
    "";
  const headlampUrl =
    (preferSso ? status.headlamp.urls?.sso : status.headlamp.urls?.nodeport) ||
    status.headlamp.urls?.nodeport ||
    status.headlamp.urls?.sso ||
    "";

  /** Report the real clipboard outcome rather than assuming the write landed. */
  const reportCopy =
    (label: string) =>
    (ok: boolean): void => {
      if (ok) {
        toast({ title: `Copied ${label} URL`, variant: "success" });
      } else {
        toast({ title: "Copy failed", description: "Clipboard unavailable", variant: "error" });
      }
    };

  return (
    <Panel data-testid="observability-panel">
      <PanelHeader>
        <PanelTitle>
          <span className="inline-flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Metrics pipeline and dashboards
          </span>
        </PanelTitle>
        <PanelActions>
          <PanelRefreshButton onClick={() => void refresh()} busy={busy} />
        </PanelActions>
      </PanelHeader>

      <PanelBody>
        <div className="flex flex-wrap gap-2">
          {status.grafana.state === "running" && grafanaUrl ? (
            <>
              <Button size="sm" asChild>
                <a href={grafanaUrl} target="_blank" rel="noopener noreferrer">
                  Open Grafana
                </a>
              </Button>
              <CopyButton value={grafanaUrl} label="Copy URL" onCopy={reportCopy("Grafana")} />
            </>
          ) : null}
          {status.headlamp.state === "running" && headlampUrl ? (
            <Button size="sm" variant="secondary" asChild>
              <a href={headlampUrl} target="_blank" rel="noopener noreferrer">
                Open Headlamp
              </a>
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ComponentRow label="Grafana" status={status.grafana} />
          <ComponentRow label="Prometheus" status={status.prometheus} />
          <ComponentRow label="node-exporter" status={status.nodeExporter} />
          <ComponentRow label="kube-state-metrics" status={status.kubeStateMetrics} />
          <ComponentRow label="blackbox-exporter" status={status.blackboxExporter} />
          <ComponentRow label="DCGM exporter" status={status.dcgmExporter} />
          <ComponentRow label="Headlamp" status={status.headlamp} />
        </div>

        {status.dashboards.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Provisioned dashboards</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {status.dashboards.map((dash) => {
                const Icon = dashboardIcon(dash.uid);
                const href = preferSso ? dash.url : dash.nodeportUrl;
                return (
                  <Button key={dash.uid} size="sm" variant="outline" className="h-auto justify-start py-2" asChild>
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      <Icon className="mr-2 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="text-left text-xs">{dash.title}</span>
                    </a>
                  </Button>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={LayoutDashboard}
            title="No dashboards provisioned"
            description="Run the monitoring stack to provision the DGX Spark Lab dashboards."
          />
        )}
      </PanelBody>

      <PanelFooter>
        <span className="flex items-start gap-1.5">
          <Check className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            Grafana is provisioned with Prometheus datasource and 8 DGX Spark Lab dashboards. Use{" "}
            <code className="font-mono text-xs">./scripts/manage.sh monitoring verify</code> to validate scrape targets.
          </span>
        </span>
      </PanelFooter>
    </Panel>
  );
}
