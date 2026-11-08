/**
 * Single utility script row - run and status actions with sheet output display.
 */
"use client";

import React from "react";
import { CircleCheck, CircleHelp, CircleX, LoaderCircle, MinusCircle } from "lucide-react";

import { runUtilityAction, getUtilityStatusAction } from "@/actions/host-actions";
import { cn } from "@/lib/utils";
import { surfaceCardClass } from "@/components/panel-styles";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusBadgeMap } from "@/components/ui/status-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UtilityOutput } from "@/components/UtilityOutput";
import type { UtilityRun } from "@/lib/db/schema";
import type { UtilityRunResult, UtilityStatus } from "@/lib/types";

/** The verdicts the run recorder writes, plus the null-status fallback. */
const LAST_RUN_STATUSES = ["success", "noop", "error", "unknown"] as const;

/** One member of {@link LAST_RUN_STATUSES}. */
type LastRunStatus = (typeof LAST_RUN_STATUSES)[number];

/**
 * The chip carries its own `last: ` prefix so the row still reads as "the last run of
 * this script said X" once the badge leaves the row's sentence and stands alone.
 */
const LAST_RUN_STATUS_MAP: StatusBadgeMap<LastRunStatus> = {
  success: { label: "last: success", variant: "ok", icon: CircleCheck },
  noop: { label: "last: noop", variant: "muted", icon: MinusCircle },
  error: { label: "last: error", variant: "danger", icon: CircleX },
  unknown: { label: "last: unknown", variant: "neutral", icon: CircleHelp }
};

/**
 * Narrow a stored verdict onto the badge map's closed set.
 * @param status - Raw `utility_runs.status`.
 * @returns `true` when the badge map covers the status.
 */
function isLastRunStatus(status: string): status is LastRunStatus {
  return (LAST_RUN_STATUSES as readonly string[]).includes(status);
}

/**
 * Resolve the chip state for the last recorded run.
 * @param status - Raw `utility_runs.status`, non-empty at the only call site.
 * @returns The map key to render; `unknown` for a verdict outside the closed set.
 */
function lastRunStatusOf(status: string): LastRunStatus {
  return isLastRunStatus(status) ? status : "unknown";
}

/** Props for {@link UtilityRow}. */
interface UtilityRowProps {
  /** The allow-listed script, as discovered under `scripts/utilities/`. */
  utility: { name: string; path: string };
  /** Most recent run record for this script, when one exists. */
  lastRun?: UtilityRun | null;
}

/**
 * Run or query one utility script and show structured output in a slide-over sheet.
 *
 * Both actions share one `isRunning` latch: the script runs on the host and a second
 * press while the first is in flight would start a competing run, so the buttons stay
 * disabled and announce `aria-busy` for the whole call. The previous busy cue swapped
 * the label for "...", which changed the accessible name mid-flight and reflowed the
 * row; the spinner icon and `aria-busy` say the same thing without either.
 * @param props - Component props.
 * @param props.utility - The script to run or query.
 * @param props.lastRun - Most recent run record, rendered as a status chip.
 * @returns The utility row.
 */
export function UtilityRow({ utility, lastRun }: UtilityRowProps): React.JSX.Element {
  const [isRunning, setIsRunning] = React.useState(false);
  const [result, setResult] = React.useState<UtilityRunResult | UtilityStatus | null>(null);
  const [showSheet, setShowSheet] = React.useState(false);
  const { toast } = useToast();

  const runAction = async (): Promise<void> => {
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

  const statusAction = async (): Promise<void> => {
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
      <div data-testid="utility-row" className={cn(surfaceCardClass, "flex items-center justify-between gap-4")}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="truncate font-mono text-sm">{utility.name}</span>
                </TooltipTrigger>
                <TooltipContent>{utility.name}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {lastRun?.status ? <StatusBadge state={lastRunStatusOf(lastRun.status)} map={LAST_RUN_STATUS_MAP} /> : null}
          </div>
          <div className="truncate text-xs text-muted-foreground">{utility.path}</div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={() => void runAction()} disabled={isRunning} aria-busy={isRunning} variant="tonal" size="sm">
            {isRunning ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : null}
            Run
          </Button>
          <Button
            onClick={() => void statusAction()}
            disabled={isRunning}
            aria-busy={isRunning}
            variant="outline"
            size="sm"
          >
            {isRunning ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : null}
            Status
          </Button>
        </div>
      </div>

      <Sheet open={showSheet} onOpenChange={setShowSheet} title={`Result: ${utility.name}`}>
        {result ? <UtilityOutput result={result} /> : <Skeleton className="h-20" />}
      </Sheet>
    </>
  );
}
