/**
 * Inference workloads panel — start/stop K8s jobs with capacity gating and heavy-model confirmation.
 */
"use client";

import React from "react";
import {
  checkCapacityAction,
  getInferenceWorkloadsAction,
  startInferenceWorkloadAction,
  stopInferenceWorkloadAction
} from "@/actions/host-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { panelSubheaderClass } from "@/components/panel-styles";
import { CapacityGateDialog } from "@/components/CapacityGateDialog";
import { HeavyConfirmDialog } from "@/components/HeavyConfirmDialog";
import type { CapacityCheck, InferenceModelName, InferenceWorkloadsStatus } from "@/lib/types";
import { Loader2, Play, Square } from "lucide-react";

const POLL_MS = 10000;

const STARTABLE_MODELS: { id: InferenceModelName; label: string; heavy: boolean }[] = [
  { id: "kimi-test", label: "kimi-test", heavy: false },
  { id: "ray-head", label: "ray-head", heavy: false },
  { id: "nemotron-3-nano-30b", label: "nano-30b", heavy: true },
  { id: "nemotron-3-nano-omni-30b", label: "nano-omni", heavy: true },
  { id: "nemotron-3-super-120b", label: "super-120b", heavy: true },
  { id: "kimi", label: "kimi (full)", heavy: true },
  { id: "nemotron-3-ultra", label: "nemotron-3-ultra", heavy: true },
  { id: "glm-5.2", label: "glm-5.2", heavy: true },
  { id: "qwen3.5-122b-a10b-nvfp4", label: "qwen-122b-nvfp4", heavy: true },
  { id: "qwen3.5-397b-spark2", label: "qwen-397b-spark2", heavy: true },
  { id: "qwen3.5-397b-nvfp4", label: "qwen-397b-nvfp4", heavy: true },
  { id: "qwen3.6-27b-nvfp4", label: "qwen3.6-27b", heavy: true },
  { id: "qwen3.6-35b-a3b-nvfp4", label: "qwen3.6-35b-a3b", heavy: true }
];

interface InferencePanelProps {
  initialStatus: InferenceWorkloadsStatus;
}

function stateBadge(state: string) {
  if (state === "running") return <Badge variant="default">running</Badge>;
  if (state === "succeeded") return <Badge variant="secondary">succeeded</Badge>;
  if (state === "failed") return <Badge variant="destructive">failed</Badge>;
  return <Badge variant="outline">stopped</Badge>;
}

/**
 * Polls workload status and drives start/stop actions for inference models.
 * @param props.initialStatus - Pre-fetched {@link InferenceWorkloadsStatus}.
 * @returns Inference workloads panel JSX.
 */
export function InferencePanel({ initialStatus }: InferencePanelProps): React.JSX.Element {
  const [status, setStatus] = React.useState(initialStatus);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [gateOpen, setGateOpen] = React.useState(false);
  const [heavyOpen, setHeavyOpen] = React.useState(false);
  const [pendingModel, setPendingModel] = React.useState<InferenceModelName | null>(null);
  const [lastCheck, setLastCheck] = React.useState<CapacityCheck | null>(null);
  const { toast } = useToast();

  const refresh = React.useCallback(async () => {
    try {
      const next = await getInferenceWorkloadsAction();
      setStatus(next);
    } catch (e) {
      toast({ title: "Inference status failed", description: String(e), variant: "error" });
    }
  }, [toast]);

  React.useEffect(() => {
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const runStart = async (model: InferenceModelName) => {
    setBusy(model);
    try {
      const result = await startInferenceWorkloadAction(model, "yes");
      if (result.exitCode !== 0) {
        toast({
          title: "Start failed",
          description: result.stderr || result.stdout,
          variant: "error"
        });
        return;
      }
      toast({ title: "Workload submitted", description: model, variant: "success" });
      await refresh();
    } finally {
      setBusy(null);
      setPendingModel(null);
    }
  };

  const beginStart = async (model: InferenceModelName, heavy: boolean) => {
    setPendingModel(model);
    const check = await checkCapacityAction(`model:${model}`);
    setLastCheck(check);
    if (!check.ok) {
      setGateOpen(true);
      return;
    }
    if (heavy) {
      setHeavyOpen(true);
      return;
    }
    await runStart(model);
  };

  const handleStop = async (job: string) => {
    setBusy(job);
    try {
      const result = await stopInferenceWorkloadAction(job);
      if (result.exitCode !== 0) {
        toast({ title: "Stop failed", description: result.stderr || result.stdout, variant: "error" });
        return;
      }
      toast({ title: "Job stopped", description: job, variant: "success" });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div data-testid="inference-panel" className="space-y-4">
      <div className={panelSubheaderClass}>Inference workloads (ai-inference)</div>

      {status.error && <p className="text-sm text-destructive">{status.error}</p>}

      <div className="space-y-2">
        {status.jobs.map((job) => {
          const startable = STARTABLE_MODELS.find((m) => m.id === job.model);
          return (
            <div
              key={job.job}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{job.model}</span>
                {stateBadge(job.state)}
                {job.active ? (
                  <span className="text-[10px] text-muted-foreground">{job.active} active pod(s)</span>
                ) : null}
              </div>
              <div className="flex gap-1">
                {startable ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void beginStart(job.model as InferenceModelName, startable.heavy)}
                  >
                    {busy === job.model ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </Button>
                ) : null}
                {job.state === "running" ? (
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void handleStop(job.job)}>
                    {busy === job.job ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">Quick start:</span>
        {STARTABLE_MODELS.map((m) => (
          <Button
            key={m.id}
            size="sm"
            variant="secondary"
            disabled={busy !== null}
            onClick={() => void beginStart(m.id, m.heavy)}
          >
            {m.label}
          </Button>
        ))}
      </div>

      <CapacityGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        check={lastCheck}
        onFreed={async () => {
          if (!pendingModel) return;
          const recheck = await checkCapacityAction(`model:${pendingModel}`);
          setLastCheck(recheck);
          if (recheck.ok) {
            setGateOpen(false);
            const heavy = STARTABLE_MODELS.find((m) => m.id === pendingModel)?.heavy;
            if (heavy) setHeavyOpen(true);
            else await runStart(pendingModel);
          }
        }}
      />

      <HeavyConfirmDialog
        open={heavyOpen}
        onOpenChange={setHeavyOpen}
        modelLabel={pendingModel ?? ""}
        onConfirm={() => {
          if (pendingModel) void runStart(pendingModel);
        }}
      />
    </div>
  );
}
