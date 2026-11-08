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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { metricLabelClass } from "@/components/panel-styles";
import { CapacityGateDialog } from "@/components/CapacityGateDialog";
import { HeavyConfirmDialog } from "@/components/HeavyConfirmDialog";
import type { CapacityCheck, InferenceModelName, InferenceWorkloadsStatus } from "@/lib/types";
import { isInferenceModelName } from "@/lib/types";
import { ChevronDown, Loader2, Play, Square } from "lucide-react";

const POLL_MS = 10000;

/** What a startable model produces; drives the grouping in the quick-start catalog. */
const QUICK_START_GROUPS = ["language", "visual"] as const;

/** One member of {@link QUICK_START_GROUPS}. */
type QuickStartGroup = (typeof QUICK_START_GROUPS)[number];

/** Heading per group, shown inside the disclosure. */
const QUICK_START_GROUP_LABELS: Readonly<Record<QuickStartGroup, string>> = {
  language: "Language models",
  visual: "Visual generation"
};

/** One entry of the quick-start catalog. */
interface StartableModel {
  id: InferenceModelName;
  label: string;
  /** True when starting it needs most of the node, so it costs a capacity check and a confirm. */
  heavy: boolean;
  group: QuickStartGroup;
}

const STARTABLE_MODELS: StartableModel[] = [
  { id: "kimi-test", label: "kimi-test", heavy: false, group: "language" },
  { id: "ray-head", label: "ray-head", heavy: false, group: "language" },
  { id: "nemotron-3-nano-30b", label: "nano-30b", heavy: true, group: "language" },
  { id: "nemotron-3-nano-omni-30b", label: "nano-omni", heavy: true, group: "language" },
  { id: "nemotron-3-super-120b", label: "super-120b", heavy: true, group: "language" },
  { id: "kimi", label: "kimi (full)", heavy: true, group: "language" },
  { id: "nemotron-3-ultra", label: "nemotron-3-ultra", heavy: true, group: "language" },
  { id: "glm-5.2", label: "glm-5.2", heavy: true, group: "language" },
  { id: "qwen3.5-122b-a10b-nvfp4", label: "qwen-122b-nvfp4", heavy: true, group: "language" },
  { id: "qwen3.5-397b-spark2", label: "qwen-397b-spark2", heavy: true, group: "language" },
  { id: "qwen3.5-397b-nvfp4", label: "qwen-397b-nvfp4", heavy: true, group: "language" },
  { id: "qwen3.6-27b-nvfp4", label: "qwen3.6-27b", heavy: true, group: "language" },
  { id: "qwen3.6-35b-a3b-nvfp4", label: "qwen3.6-35b-a3b", heavy: true, group: "language" },
  { id: "qwen3.8-27b-nvfp4", label: "qwen3.8-27b", heavy: true, group: "language" },
  { id: "qwen3.8-flash-next-nvfp4", label: "qwen3.8-flash-next", heavy: true, group: "language" },
  { id: "glm-5.3-flash", label: "glm-5.3-flash", heavy: true, group: "language" },
  { id: "deepseek-v4.1-flash", label: "dsv4.1-flash", heavy: true, group: "language" },
  { id: "deepseek-v4-flash-dspark", label: "dsv4-flash-dspark", heavy: true, group: "language" },
  { id: "glm-5.3-flash-exl3-tensorfold", label: "glm53-exl3-tensorfold", heavy: true, group: "language" },
  { id: "qwen3.8-27b-exl3-16gb", label: "qwen38-27b-exl3", heavy: true, group: "language" },
  { id: "qwen3.8-27b-tensorfold", label: "qwen38-27b-tensorfold", heavy: true, group: "language" },
  { id: "qwen3.8-flash-next-tensorfold", label: "qwen38-flashnext-tf", heavy: true, group: "language" },
  { id: "litellm", label: "litellm", heavy: false, group: "language" },
  { id: "comfy-base", label: "comfy-base", heavy: true, group: "visual" },
  { id: "flux-fast", label: "flux-fast", heavy: true, group: "visual" },
  { id: "flux-quality", label: "flux-quality", heavy: true, group: "visual" },
  { id: "ltx-balanced", label: "ltx-balanced", heavy: true, group: "visual" },
  { id: "ltx-quality", label: "ltx-quality", heavy: true, group: "visual" },
  { id: "flux-to-ltx", label: "flux-to-ltx", heavy: true, group: "visual" }
];

/** Cheap starts the operator reaches for most, so they stay on the surface. */
const QUICK_START_LIGHT = STARTABLE_MODELS.filter((m) => !m.heavy);

/** Costly starts, grouped and folded behind the disclosure. */
const QUICK_START_HEAVY = STARTABLE_MODELS.filter((m) => m.heavy);

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

  const handleFreed = async () => {
    if (!pendingModel) return;
    const recheck = await checkCapacityAction(`model:${pendingModel}`);
    setLastCheck(recheck);
    if (recheck.ok) {
      setGateOpen(false);
      const heavy = STARTABLE_MODELS.find((m) => m.id === pendingModel)?.heavy;
      if (heavy) setHeavyOpen(true);
      else await runStart(pendingModel);
    }
  };

  return (
    <Panel data-testid="inference-panel">
      <PanelHeader>
        <PanelTitle>Inference &amp; visual workloads</PanelTitle>
        <PanelDescription>ai-inference; ComfyUI via port-forward :8188</PanelDescription>
      </PanelHeader>

      <PanelBody className="space-y-4">
        {status.error && <p className="text-sm text-destructive">{status.error}</p>}

        <div className="space-y-2">
          {status.jobs.map((job) => {
            // A live Job can name a model the catalog no longer lists, so the name is
            // narrowed here and only a catalogued model gets a Start button.
            const reportedModel = job.model;
            const startable = isInferenceModelName(reportedModel)
              ? STARTABLE_MODELS.find((m) => m.id === reportedModel)
              : undefined;
            return (
              <div
                key={job.job}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{job.model}</span>
                  {stateBadge(job.state)}
                  {job.active ? (
                    <span className="text-xs text-muted-foreground">{job.active} active pod(s)</span>
                  ) : null}
                </div>
                <div className="flex gap-1">
                  {startable ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void beginStart(startable.id, startable.heavy)}
                    >
                      {busy === job.model ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  ) : null}
                  {job.state === "running" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void handleStop(job.job)}
                    >
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

        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={metricLabelClass}>Quick start:</span>
            {QUICK_START_LIGHT.map((m) => (
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

          {/* 24 of the 29 catalogued models evict a running lane, so they are grouped and
            folded: an always-open wall of identical buttons hid which start was costly. */}
          <Collapsible>
            <CollapsibleTrigger
              className="group flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="quick-start-more"
            >
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
              More models ({QUICK_START_HEAVY.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              <p className="text-xs text-warning">
                Heavy models need free capacity. Starting one can evict a running lane.
              </p>
              {QUICK_START_GROUPS.map((group) => (
                <div key={group} className="space-y-1.5">
                  <div className={metricLabelClass}>{QUICK_START_GROUP_LABELS[group]}</div>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_START_HEAVY.filter((m) => m.group === group).map((m) => (
                      <Button
                        key={m.id}
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => void beginStart(m.id, m.heavy)}
                      >
                        {m.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <CapacityGateDialog
          open={gateOpen}
          onOpenChange={setGateOpen}
          check={lastCheck}
          onFreed={() => void handleFreed()}
        />

        <HeavyConfirmDialog
          open={heavyOpen}
          onOpenChange={setHeavyOpen}
          modelLabel={pendingModel ?? ""}
          onConfirm={() => {
            if (pendingModel) void runStart(pendingModel);
          }}
        />
      </PanelBody>
    </Panel>
  );
}
