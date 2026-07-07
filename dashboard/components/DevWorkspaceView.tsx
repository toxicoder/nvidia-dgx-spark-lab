/**
 * Single dev workspace view — toggle, status, and embedded UI for Coder or Kasm.
 */
"use client";

import React from "react";
import { Loader2, Monitor, Code2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AlertDialog } from "@/components/ui/dialog";
import { WorkspaceEmbed } from "@/components/WorkspaceEmbed";
import { panelSubheaderClass } from "@/components/panel-styles";
import type { DevWorkspaceInfo, DevWorkspaceName, DevWorkspaceState } from "@/lib/types";

const RESOURCE_HINTS: Record<DevWorkspaceName, string> = {
  coder: "When running: ~500m–2 CPU, 1–4Gi RAM (Coder server)",
  kasm: "When running: ~500m–2 CPU, 1–4Gi RAM (Kasm control plane)"
};

const LABELS: Record<
  DevWorkspaceName,
  { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }
> = {
  coder: { title: "Coder", subtitle: "VS Code workspaces in the browser", icon: Code2 },
  kasm: { title: "Kasm", subtitle: "Streamed desktops and applications", icon: Monitor }
};

function statusVariant(state: DevWorkspaceState): "default" | "secondary" | "outline" | "destructive" {
  switch (state) {
    case "running":
      return "default";
    case "starting":
    case "stopping":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "outline";
  }
}

interface DevWorkspaceViewProps {
  workspace: DevWorkspaceInfo;
  pendingState?: DevWorkspaceState | null;
  busy: boolean;
  onToggle: (name: DevWorkspaceName, enabled: boolean) => void;
}

/** Displays workspace metadata, start/stop switch, and iframe embed when running. */
export function DevWorkspaceView({ workspace, pendingState, busy, onToggle }: DevWorkspaceViewProps) {
  const [confirmStop, setConfirmStop] = React.useState(false);
  const meta = LABELS[workspace.name];
  const Icon = meta.icon;
  const displayState = pendingState ?? workspace.state;
  const isOn = displayState === "running" || displayState === "starting";
  const isTransitional = displayState === "starting" || displayState === "stopping" || busy;

  const handleSwitch = (checked: boolean) => {
    if (checked) {
      onToggle(workspace.name, true);
      return;
    }
    setConfirmStop(true);
  };

  const confirmStopAction = async () => {
    onToggle(workspace.name, false);
    setConfirmStop(false);
  };

  return (
    <div data-testid={`dev-workspace-${workspace.name}`} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className={panelSubheaderClass}>
            <Icon className="h-4 w-4" />
            {meta.title}
          </div>
          <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
          <p className="text-[10px] text-muted-foreground">{RESOURCE_HINTS[workspace.name]}</p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={statusVariant(displayState)} className="capitalize">
            {isTransitional && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {displayState}
          </Badge>
          <Switch
            checked={isOn}
            disabled={isTransitional}
            aria-label={`Toggle ${meta.title}`}
            onCheckedChange={handleSwitch}
          />
        </div>
      </div>

      {displayState === "stopped" && (
        <div
          data-testid={`workspace-empty-${workspace.name}`}
          className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center"
        >
          <Icon className="h-10 w-10 text-muted-foreground/60" />
          <div>
            <p className="text-sm font-medium">{meta.title} is stopped</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Turn on the switch to deploy {meta.title} and free cluster resources when you are done.
            </p>
          </div>
        </div>
      )}

      {displayState === "running" && <WorkspaceEmbed key={workspace.url} url={workspace.url} title={meta.title} />}

      {(displayState === "starting" || displayState === "stopping") && (
        <div className="flex min-h-[40vh] items-center justify-center rounded-lg border border-border bg-muted/20">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {displayState === "starting" ? "Deploying Helm release and waiting for pods…" : "Stopping workspace…"}
          </div>
        </div>
      )}

      <AlertDialog
        open={confirmStop}
        onOpenChange={setConfirmStop}
        title={`Stop ${meta.title}?`}
        description={`This uninstalls the ${meta.title} Helm release and disconnects active sessions. Frees ~2 CPU and up to 4Gi RAM for inference workloads.`}
        confirmText="Stop"
        cancelText="Keep running"
        variant="destructive"
        onConfirm={confirmStopAction}
      />
    </div>
  );
}
