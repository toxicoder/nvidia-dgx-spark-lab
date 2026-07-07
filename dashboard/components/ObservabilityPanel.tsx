/**
 * Observability panel — Grafana/Headlamp status and deep links to provisioned dashboards.
 */
"use client";

import React from "react";
import { getMonitoringStackStatusAction } from "@/actions/host-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { panelSubheaderClass } from "@/components/panel-styles";
import type { MonitoringServiceStatus, MonitoringStackStatus } from "@/lib/types";
import {
  Activity,
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  Gauge,
  LayoutDashboard,
  RefreshCw,
  Server
} from "lucide-react";

const POLL_MS = 30000;

interface ObservabilityPanelProps {
  initialStatus: MonitoringStackStatus;
}

function stateBadge(state: MonitoringServiceStatus["state"]) {
  if (state === "running") return <Badge variant="default">running</Badge>;
  if (state === "starting") return <Badge variant="secondary">starting</Badge>;
  if (state === "error") return <Badge variant="destructive">error</Badge>;
  return <Badge variant="outline">stopped</Badge>;
}

function ComponentRow({ label, status }: { label: string; status: MonitoringServiceStatus }) {
  return (
    <div className="flex items-center justify-between rounded-[var(--md-sys-shape-corner-medium)] border border-border bg-[var(--md-sys-color-surface-container-low)] px-3 py-2">
      <div className="text-xs font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {status.readyPods}/{status.totalPods} pods
        </span>
        {stateBadge(status.state)}
      </div>
    </div>
  );
}

/**
 * Read-only observability gateway — links into Grafana and Headlamp.
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

  const copyUrl = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: `Copied ${label} URL`, variant: "success" });
    } catch (e) {
      toast({ title: "Copy failed", description: String(e), variant: "error" });
    }
  };

  const dashboardIcon = (uid: string) => {
    if (uid.includes("gpu")) return Gauge;
    if (uid.includes("k8s") || uid.includes("nodes")) return Server;
    if (uid.includes("overview")) return LayoutDashboard;
    return BarChart3;
  };

  return (
    <div data-testid="observability-panel" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className={panelSubheaderClass}>
          <Activity className="h-4 w-4" />
          Metrics pipeline &amp; dashboards
        </div>
        <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={busy}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {status.grafana.state === "running" && grafanaUrl && (
          <>
            <Button size="sm" asChild>
              <a href={grafanaUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                Open Grafana
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={() => void copyUrl(grafanaUrl, "Grafana")}>
              <Copy className="mr-1 h-3.5 w-3.5" />
              Copy URL
            </Button>
          </>
        )}
        {status.headlamp.state === "running" && headlampUrl && (
          <Button size="sm" variant="secondary" asChild>
            <a href={headlampUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              Open Headlamp
            </a>
          </Button>
        )}
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

      {status.dashboards.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Provisioned dashboards</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {status.dashboards.map((dash) => {
              const Icon = dashboardIcon(dash.uid);
              const href = preferSso ? dash.url : dash.nodeportUrl;
              return (
                <Button key={dash.uid} size="sm" variant="outline" className="h-auto justify-start py-2" asChild>
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    <Icon className="mr-2 h-3.5 w-3.5 shrink-0" />
                    <span className="text-left text-xs">{dash.title}</span>
                  </a>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
        <Check className="mt-0.5 h-3 w-3 shrink-0" />
        Grafana is provisioned with Prometheus datasource and 8 DGX Spark Lab dashboards. Use{" "}
        <code className="text-[9px]">./scripts/manage.sh monitoring verify</code> to validate scrape targets.
      </p>
    </div>
  );
}
