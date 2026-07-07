/**
 * Single utility script row — run and status actions with sheet output display.
 */
"use client";

import React from "react";
import { runUtilityAction, getUtilityStatusAction } from "@/actions/host-actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UtilityOutput } from "@/components/UtilityOutput";
import type { UtilityRun } from "@/lib/db/schema";
import type { UtilityRunResult, UtilityStatus } from "@/lib/types";

/** Runs or queries a utility script and shows structured output in a slide-over sheet. */
export function UtilityRow({
  utility,
  lastRun
}: {
  utility: { name: string; path: string };
  lastRun?: UtilityRun | null;
}) {
  const [isRunning, setIsRunning] = React.useState(false);
  const [result, setResult] = React.useState<UtilityRunResult | UtilityStatus | null>(null);
  const [showSheet, setShowSheet] = React.useState(false);
  const { toast } = useToast();

  const runAction = async () => {
    setIsRunning(true);
    try {
      const res = await runUtilityAction(utility.name);
      setResult(res);
      setShowSheet(true);
      toast({
        title: "Run completed",
        description: `Utility ${utility.name} executed.`,
        variant: "success"
      });
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "error" });
    } finally {
      setIsRunning(false);
    }
  };

  const statusAction = async () => {
    setIsRunning(true);
    try {
      const res = await getUtilityStatusAction(utility.name);
      setResult(res);
      setShowSheet(true);
      toast({
        title: "Status loaded",
        description: utility.name,
        variant: "success"
      });
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "error" });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      <div data-testid="utility-row" className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-sm">{utility.name}</span>
            {lastRun?.status && (
              <Badge variant="outline" className="text-[9px]">
                last: {lastRun.status}
              </Badge>
            )}
          </div>
          <div className="truncate text-[10px] text-muted-foreground">{utility.path}</div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={runAction} disabled={isRunning} variant="tonal" size="sm" className="text-xs">
            {isRunning ? "..." : "Run"}
          </Button>
          <Button onClick={statusAction} disabled={isRunning} variant="outline" size="sm" className="text-xs">
            {isRunning ? "..." : "Status"}
          </Button>
        </div>
      </div>

      <Sheet open={showSheet} onOpenChange={setShowSheet} title={`Result: ${utility.name}`}>
        {result ? <UtilityOutput result={result} /> : <Skeleton className="h-20" />}
      </Sheet>
    </>
  );
}
