/**
 * Nemotron agentic stack panel — catalog, start/stop, and Spark-2 profile selection with capacity gating.
 */
"use client";

import React from "react";
import {
  checkCapacityAction,
  getNemotronStackStatusAction,
  startNemotronStackAction,
  stopNemotronStackAction
} from "@/actions/host-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { panelSubheaderClass } from "@/components/panel-styles";
import { CapacityGateDialog } from "@/components/CapacityGateDialog";
import { HeavyConfirmDialog } from "@/components/HeavyConfirmDialog";
import type {
  CapacityCheck,
  ClusterCapacity,
  NemotronCatalog,
  NemotronStackId,
  NemotronStackStatus
} from "@/lib/types";
import { Check, Copy, Loader2, Shield, Square } from "lucide-react";

const POLL_MS = 10000;

const PILLAR_LABELS: Record<string, string> = {
  orchestrator: "Orchestrator",
  document_intel: "Document intel",
  rag: "RAG retrieval",
  safety: "Safety guard",
  speech: "Speech"
};

const SPARK2_PROFILES: NemotronStackId[] = [
  "nemotron-agentic-spark-2-agent",
  "nemotron-agentic-spark-2-reasoning",
  "qwen-agentic-spark-2"
];

interface NemotronStackPanelProps {
  initialCatalog: NemotronCatalog;
  initialStackStatus: NemotronStackStatus;
  clusterCapacity: ClusterCapacity;
}

function stacksForNodes(catalog: NemotronCatalog, nodeCount: number): NemotronStackId[] {
  return (Object.entries(catalog.stacks) as [NemotronStackId, (typeof catalog.stacks)[string]][])
    .filter(([, s]) => {
      const min = s.min_nodes ?? 1;
      const max = s.max_nodes ?? 99;
      return nodeCount >= min && nodeCount <= max;
    })
    .map(([id]) => id);
}

function defaultStackForNodes(nodeCount: number): NemotronStackId {
  if (nodeCount >= 4) return "nemotron-agentic-spark-4";
  if (nodeCount === 3) return "nemotron-agentic-spark-3";
  if (nodeCount === 2) return "nemotron-agentic-spark-2-agent";
  return "nemotron-agentic-spark-1";
}

function endpointUrl(svc: string, port = 8000): string {
  return `http://${svc}.ai-inference.svc.cluster.local:${port}/v1`;
}

/**
 * Manages nemotron stack lifecycle and displays pillar health from the catalog.
 * @param props.initialCatalog - Pre-fetched {@link NemotronCatalog}.
 * @param props.initialStackStatus - Pre-fetched {@link NemotronStackStatus}.
 * @param props.clusterCapacity - Cluster capacity for node-count gating.
 * @returns Nemotron stack panel JSX.
 */
export function NemotronStackPanel({
  initialCatalog,
  initialStackStatus,
  clusterCapacity
}: NemotronStackPanelProps): React.JSX.Element {
  const [catalog] = React.useState(initialCatalog);
  const [stackStatus, setStackStatus] = React.useState(initialStackStatus);
  const nodeCount = clusterCapacity.node_count;
  const matchingStacks = React.useMemo(() => stacksForNodes(catalog, nodeCount), [catalog, nodeCount]);
  const defaultStack = React.useMemo(() => defaultStackForNodes(nodeCount), [nodeCount]);
  const [selectedStack, setSelectedStack] = React.useState<NemotronStackId>(defaultStack);
  const [spark2Profile, setSpark2Profile] = React.useState<NemotronStackId>("nemotron-agentic-spark-2-agent");
  const [busy, setBusy] = React.useState(false);
  const [gateOpen, setGateOpen] = React.useState(false);
  const [heavyOpen, setHeavyOpen] = React.useState(false);
  const [lastCheck, setLastCheck] = React.useState<CapacityCheck | null>(null);
  const { toast } = useToast();

  const activeStackId: NemotronStackId =
    nodeCount === 2 && matchingStacks.includes(spark2Profile)
      ? spark2Profile
      : matchingStacks.includes(selectedStack)
        ? selectedStack
        : defaultStack;

  const preset = catalog.stacks[activeStackId];
  const health = stackStatus.stacks.find((s) => s.id === activeStackId);

  const refresh = React.useCallback(async () => {
    try {
      const next = await getNemotronStackStatusAction();
      setStackStatus(next);
    } catch (e) {
      toast({ title: "Stack status failed", description: String(e), variant: "error" });
    }
  }, [toast]);

  React.useEffect(() => {
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const runStart = async (stackId: NemotronStackId) => {
    setBusy(true);
    try {
      const result = await startNemotronStackAction(stackId, "yes");
      if (result.exitCode !== 0) {
        toast({
          title: "Stack deploy failed",
          description: result.stderr || result.stdout,
          variant: "error"
        });
        return;
      }
      toast({ title: "Stack deploying", description: preset?.label ?? stackId, variant: "success" });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const beginDeploy = async () => {
    const check = await checkCapacityAction(`stack:${activeStackId}`);
    setLastCheck(check);
    if (!check.ok) {
      setGateOpen(true);
      return;
    }
    if (preset?.heavy) {
      setHeavyOpen(true);
      return;
    }
    await runStart(activeStackId);
  };

  const handleStop = async () => {
    setBusy(true);
    try {
      const result = await stopNemotronStackAction(activeStackId);
      if (result.exitCode !== 0) {
        toast({ title: "Stop failed", description: result.stderr || result.stdout, variant: "error" });
        return;
      }
      toast({ title: "Stack stopped", variant: "success" });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const copyEndpoint = (url: string) => {
    void navigator.clipboard.writeText(url);
    toast({ title: "Copied endpoint", description: url, variant: "success" });
  };

  if (!preset) {
    return (
      <p className="text-sm text-muted-foreground">
        No Nemotron stack preset for {nodeCount} node(s). Add nodes or pick another profile.
      </p>
    );
  }

  const serviceCount = preset.stack_with?.length ?? 0;
  const gpuRequired = preset.stack_with?.reduce((sum, m) => {
    const meta = catalog.models[m];
    return sum + (meta?.cpu_only ? 0 : 1);
  }, 0);

  return (
    <div
      data-testid="nemotron-stack-panel"
      className="space-y-4 rounded-md border border-border bg-[var(--md-sys-color-surface-container-low)] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className={panelSubheaderClass}>Nemotron Agentic Stack</div>
          <p className="text-xs text-muted-foreground">{preset.description}</p>
        </div>
        <Badge variant="secondary">{nodeCount}× DGX Spark</Badge>
      </div>

      {nodeCount === 2 ? (
        <div className="flex flex-wrap gap-2">
          {SPARK2_PROFILES.map((id) => (
            <Button
              key={id}
              size="sm"
              variant={spark2Profile === id ? "default" : "outline"}
              onClick={() => setSpark2Profile(id)}
            >
              {catalog.stacks[id]?.label ?? id}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {matchingStacks.map((id) => (
            <Button
              key={id}
              size="sm"
              variant={selectedStack === id ? "default" : "outline"}
              onClick={() => setSelectedStack(id)}
            >
              {catalog.stacks[id]?.label ?? id}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border px-3 py-2 text-sm">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Stack budget</div>
          <div className="tabular-nums">
            {serviceCount} services · ~{gpuRequired} GPU(s) for LLM/Parse
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {clusterCapacity.available.gpus} GPU(s) available · {clusterCapacity.available.memory} memory
          </div>
        </div>
        <div className="rounded-md border border-border px-3 py-2 text-sm">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Agent pillars</div>
          <div className="flex flex-wrap gap-1">
            {(preset.pillars ?? []).map((p) => (
              <Badge key={p} variant="outline" className="text-[10px]">
                <Check className="mr-0.5 h-2.5 w-2.5" />
                {PILLAR_LABELS[p] ?? p}
              </Badge>
            ))}
          </div>
          {preset.quality_notes ? (
            <p className="mt-1 text-[10px] text-muted-foreground">{preset.quality_notes}</p>
          ) : null}
        </div>
      </div>

      {health?.components?.length ? (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Components</div>
          <div className="flex flex-wrap gap-1">
            {health.components.map((c) => (
              <Badge key={c.model} variant={c.state === "running" ? "default" : "outline"} className="text-[10px]">
                {c.model}: {c.state}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => void beginDeploy()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="mr-1 h-3.5 w-3.5" />}
          Deploy full stack
        </Button>
        {health?.healthy || health?.components?.some((c) => c.state === "running") ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleStop()}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="mr-1 h-3.5 w-3.5" />}
            Stop stack
          </Button>
        ) : null}
      </div>

      {health?.healthy ? (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="text-xs font-medium text-muted-foreground">OpenAI-compatible endpoints</div>
          {(preset.stack_with ?? []).map((m) => {
            const meta = catalog.models[m];
            if (!meta?.openai_svc) return null;
            const url = endpointUrl(meta.openai_svc, meta.port);
            return (
              <div
                key={m}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-2 py-1.5 text-xs"
              >
                <span className="font-medium">{meta.display_name ?? m}</span>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copyEndpoint(url)}>
                  <Copy className="mr-1 h-3 w-3" />
                  Copy URL
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}

      <CapacityGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        check={lastCheck}
        onFreed={async () => {
          const recheck = await checkCapacityAction(`stack:${activeStackId}`);
          setLastCheck(recheck);
          if (recheck.ok) {
            setGateOpen(false);
            if (preset?.heavy) setHeavyOpen(true);
            else await runStart(activeStackId);
          }
        }}
      />

      <HeavyConfirmDialog
        open={heavyOpen}
        onOpenChange={setHeavyOpen}
        modelLabel={preset.label}
        onConfirm={() => void runStart(activeStackId)}
      />
    </div>
  );
}
