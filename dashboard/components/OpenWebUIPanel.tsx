/**
 * Agent Chat panel — Open WebUI lifecycle backed by Hermes gateway.
 */
"use client";

import React from "react";
import { getOpenWebUIStatusAction, startOpenWebUIAction, stopOpenWebUIAction } from "@/actions/host-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { panelSubheaderClass } from "@/components/panel-styles";
import type { OpenWebUIStatus } from "@/lib/types";
import { Check, Copy, ExternalLink, Loader2, MessageSquare, Play, Square } from "lucide-react";

const POLL_MS = 10000;
const STACK_ID = "open-webui-lab";

interface OpenWebUIPanelProps {
  initialStatus: OpenWebUIStatus;
}

function stateBadge(state: OpenWebUIStatus["state"]) {
  if (state === "running") return <Badge variant="default">running</Badge>;
  if (state === "starting") return <Badge variant="secondary">starting</Badge>;
  return <Badge variant="outline">stopped</Badge>;
}

/**
 * Manages Open WebUI deploy and links to SSO / NodePort chat URLs.
 * @param props.initialStatus - Pre-fetched {@link OpenWebUIStatus}.
 * @returns Open WebUI panel JSX.
 */
export function OpenWebUIPanel({ initialStatus }: OpenWebUIPanelProps): React.JSX.Element {
  const [status, setStatus] = React.useState(initialStatus);
  const [busy, setBusy] = React.useState(false);
  const { toast } = useToast();

  const refresh = React.useCallback(async () => {
    try {
      const next = await getOpenWebUIStatusAction();
      setStatus(next);
    } catch (e) {
      toast({ title: "Open WebUI status failed", description: String(e), variant: "error" });
    }
  }, [toast]);

  React.useEffect(() => {
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const chatUrl = status.urls.sso || status.urls.nodeport;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(chatUrl);
      toast({ title: "Copied chat URL", variant: "success" });
    } catch (e) {
      toast({ title: "Copy failed", description: String(e), variant: "error" });
    }
  };

  const handleStart = async () => {
    setBusy(true);
    try {
      const result = await startOpenWebUIAction(STACK_ID, "yes");
      if (result.exitCode !== 0) {
        toast({
          title: "Start failed",
          description: result.stderr || result.stdout,
          variant: "error"
        });
        return;
      }
      toast({ title: "Open WebUI starting", description: "Hermes gateway backend", variant: "success" });
      await refresh();
    } catch (e) {
      toast({ title: "Start failed", description: String(e), variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    try {
      const result = await stopOpenWebUIAction();
      if (result.exitCode !== 0) {
        toast({
          title: "Stop failed",
          description: result.stderr || result.stdout,
          variant: "error"
        });
        return;
      }
      toast({ title: "Open WebUI stopped", variant: "success" });
      await refresh();
    } catch (e) {
      toast({ title: "Stop failed", description: String(e), variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const prereqs = [
    { label: "Nemotron orchestrator", hint: "nemotron-stack start nemotron-agentic-spark-1" },
    { label: "MCP toolkit", hint: "mcp-stack start mcp-agent-toolkit" },
    { label: `Hermes (${status.prerequisites.hermes_stack})`, hint: "manage.sh start-hermes" }
  ];

  return (
    <div data-testid="open-webui-panel" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className={panelSubheaderClass}>Agent Chat (Open WebUI)</span>
          {stateBadge(status.state)}
        </div>
        <div className="flex flex-wrap gap-2">
          {status.state === "stopped" ? (
            <Button size="sm" onClick={() => void handleStart()} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
              Deploy chat UI
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => void handleStop()} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Square className="mr-1 h-3.5 w-3.5" />}
              Stop
            </Button>
          )}
          {status.state === "running" && (
            <>
              <Button size="sm" variant="secondary" asChild>
                <a href={chatUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  Open chat
                </a>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void copyUrl()}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copy URL
              </Button>
            </>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Polished browser chat backed by the Hermes gateway — MCP tools (search, fetch, memory) flow through Hermes, not
        Open WebUI directly.
      </p>

      <div className="rounded-md border border-border bg-muted/30 p-3 text-[11px]">
        <div className="mb-2 font-medium text-foreground">Prerequisites</div>
        <ul className="space-y-1 text-muted-foreground">
          {prereqs.map((p) => (
            <li key={p.label} className="flex items-start gap-1.5">
              <Check className="mt-0.5 h-3 w-3 shrink-0 opacity-50" />
              <span>
                {p.label}
                <span className="ml-1 font-mono text-[10px] opacity-70">({p.hint})</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-2 text-[11px] sm:grid-cols-2">
        <div className="rounded border border-border px-3 py-2">
          <div className="text-muted-foreground">Hermes gateway</div>
          <div className="mt-0.5 font-mono text-[10px] break-all">{status.backend.hermes_gateway.url}</div>
          <div className="mt-1">
            {status.backend.hermes_gateway.reachable ? (
              <Badge variant="default" className="text-[9px]">
                reachable
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[9px]">
                not reachable
              </Badge>
            )}
          </div>
        </div>
        <div className="rounded border border-border px-3 py-2">
          <div className="text-muted-foreground">Access</div>
          <div className="mt-0.5 font-mono text-[10px] break-all">{chatUrl}</div>
          {status.urls.nodeport !== chatUrl && (
            <div className="mt-1 font-mono text-[10px] text-muted-foreground break-all">
              bypass: {status.urls.nodeport}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
