/**
 * Dialog shown when a workload fails capacity checks; suggests safe actions to free cluster resources.
 */
"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  suggestFreeResourcesAction,
  stopDevWorkspaceAction,
  stopInferenceWorkloadAction
} from "@/actions/host-actions";
import type { CapacityCheck, FreeResourceSuggestion } from "@/lib/types";
import { useToast } from "@/components/ui/toast";

interface CapacityGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  check: CapacityCheck | null;
  onFreed: () => void;
}

async function applySuggestion(suggestion: FreeResourceSuggestion): Promise<boolean> {
  const act = suggestion.action;
  if (act === "dev:coder") {
    const r = await stopDevWorkspaceAction("coder");
    return r.exitCode === 0;
  }
  if (act === "dev:kasm") {
    const r = await stopDevWorkspaceAction("kasm");
    return r.exitCode === 0;
  }
  if (act.startsWith("stop-job:")) {
    const jobs = act.slice("stop-job:".length).split(",");
    for (const job of jobs) {
      const r = await stopInferenceWorkloadAction(job.trim());
      if (r.exitCode !== 0) return false;
    }
    return true;
  }
  if (act === "stop-inference") {
    const r = await stopInferenceWorkloadAction("all");
    return r.exitCode === 0;
  }
  return false;
}

/** Displays required vs available capacity and one-click suggestions to free resources. */
export function CapacityGateDialog({ open, onOpenChange, check, onFreed }: CapacityGateDialogProps) {
  const [suggestions, setSuggestions] = React.useState<FreeResourceSuggestion[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    if (!open || !check?.action) return;
    void suggestFreeResourcesAction(check.action).then(setSuggestions);
  }, [open, check?.action]);

  const handleApply = async (s: FreeResourceSuggestion) => {
    setBusy(s.id);
    try {
      const ok = await applySuggestion(s);
      if (!ok) {
        toast({ title: "Could not free resources", description: s.label, variant: "error" });
        return;
      }
      toast({ title: "Resources freed", description: s.label, variant: "success" });
      onFreed();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insufficient resources</DialogTitle>
          <DialogDescription>
            {check?.verdict ?? "unknown"} — free resources safely before continuing.
          </DialogDescription>
        </DialogHeader>

        {check && (
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Required: </span>
              {check.required.gpus} GPUs, {check.required.cpu} CPU, {check.required.memory}
            </div>
            <div>
              <span className="text-muted-foreground">Available: </span>
              {check.available.gpus} GPUs, {check.available.cpu} CPU, {check.available.memory}
            </div>
          </div>
        )}

        <div className="max-h-48 space-y-2 overflow-y-auto">
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No automatic suggestions. Stop workloads via CLI or Inference panel.
            </p>
          ) : (
            suggestions.map((s) => (
              <div
                key={s.id}
                className="flex items-start justify-between gap-2 rounded-md border border-border p-2 text-sm"
              >
                <div>
                  <div className="font-medium">{s.label}</div>
                  <div className="text-[10px] text-muted-foreground">{s.impact}</div>
                </div>
                <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => void handleApply(s)}>
                  {busy === s.id ? "…" : "Apply"}
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
