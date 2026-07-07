/**
 * Dev workspaces panel — Coder and Kasm tabs with start/stop and status polling.
 */
"use client";

import React from "react";
import { getDevWorkspacesStatusAction, startDevWorkspaceAction, stopDevWorkspaceAction } from "@/actions/host-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { DevWorkspaceView } from "@/components/DevWorkspaceView";
import type { DevWorkspaceName, DevWorkspaceState, DevWorkspacesStatus } from "@/lib/types";

const POLL_MS = 5000;

interface WorkspacesPanelProps {
  initialStatus: DevWorkspacesStatus;
}

function isTransitional(state: DevWorkspaceState): boolean {
  return state === "starting" || state === "stopping";
}

/**
 * Coordinates Coder/Kasm workspace toggles and refreshes status while transitions are pending.
 * @param props.initialStatus - Pre-fetched {@link DevWorkspacesStatus}.
 * @returns Dev workspaces panel JSX.
 */
export function WorkspacesPanel({ initialStatus }: WorkspacesPanelProps): React.JSX.Element {
  const [status, setStatus] = React.useState(initialStatus);
  const [activeTab, setActiveTab] = React.useState<DevWorkspaceName>("coder");
  const [pending, setPending] = React.useState<Partial<Record<DevWorkspaceName, DevWorkspaceState>>>({});
  const [busy, setBusy] = React.useState(false);
  const { toast } = useToast();

  const refreshStatus = React.useCallback(async () => {
    try {
      const next = await getDevWorkspacesStatusAction();
      setStatus(next);
      return next;
    } catch (e) {
      toast({ title: "Status refresh failed", description: String(e), variant: "error" });
      return null;
    }
  }, [toast]);

  React.useEffect(() => {
    const coderState = pending.coder ?? status.coder.state;
    const kasmState = pending.kasm ?? status.kasm.state;
    if (!isTransitional(coderState) && !isTransitional(kasmState)) return;

    const id = setInterval(() => {
      void refreshStatus().then((next) => {
        if (!next) return;
        setPending((prev) => {
          const updated = { ...prev };
          (["coder", "kasm"] as const).forEach((name) => {
            const actual = next[name].state;
            const pendingState = prev[name];
            if (!pendingState) return;
            if (pendingState === "starting" && actual === "running") delete updated[name];
            if (pendingState === "stopping" && actual === "stopped") delete updated[name];
            if (pendingState === "starting" && actual === "stopped") delete updated[name];
          });
          return updated;
        });
      });
    }, POLL_MS);

    return () => clearInterval(id);
  }, [pending, refreshStatus, status.coder.state, status.kasm.state]);

  const handleToggle = async (name: DevWorkspaceName, enabled: boolean) => {
    setBusy(true);
    setPending((prev) => ({ ...prev, [name]: enabled ? "starting" : "stopping" }));

    try {
      const result = enabled ? await startDevWorkspaceAction(name) : await stopDevWorkspaceAction(name);
      if (result.exitCode !== 0) {
        setPending((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
        toast({
          title: `${enabled ? "Start" : "Stop"} failed`,
          description: result.stderr || result.stdout || `exit ${result.exitCode}`,
          variant: "error"
        });
        return;
      }

      toast({
        title: enabled ? "Workspace starting" : "Workspace stopping",
        description: name,
        variant: "success"
      });
      await refreshStatus();
    } catch (e) {
      setPending((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      toast({ title: "Workspace action failed", description: String(e), variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="workspaces-panel" className="w-full self-start space-y-4">
      {status.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {status.error}
        </p>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DevWorkspaceName)}>
        <TabsList>
          <TabsTrigger value="coder">Coder</TabsTrigger>
          <TabsTrigger value="kasm">Kasm</TabsTrigger>
        </TabsList>

        <TabsContent value="coder">
          <DevWorkspaceView
            workspace={status.coder}
            pendingState={pending.coder ?? null}
            busy={busy}
            onToggle={handleToggle}
          />
        </TabsContent>

        <TabsContent value="kasm">
          <DevWorkspaceView
            workspace={status.kasm}
            pendingState={pending.kasm ?? null}
            busy={busy}
            onToggle={handleToggle}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
