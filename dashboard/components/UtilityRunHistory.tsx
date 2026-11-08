/** Recent utility script runs - compact table with status badge and timestamp. */
import * as React from "react";
import { CircleCheck, CircleHelp, CircleX, History, MinusCircle } from "lucide-react";

import { formatTimestamp } from "@/lib/format";
import { compactTableClass } from "@/components/panel-styles";
import { EmptyState } from "@/components/ui/empty-state";
import { PanelTitle } from "@/components/ui/panel";
import { Separator } from "@/components/ui/separator";
import { StatusBadge, type StatusBadgeMap } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { UtilityRun } from "@/lib/db/schema";

/**
 * The verdicts `lib/db/repositories/utility-runs.ts` actually writes: exit 0 is
 * `success`, exit 2 is `noop`, anything else is `error`; a row inserted before the
 * status column landed carries `null`. A closed set here means a new verdict in the
 * writer shows up as an unmapped state instead of silently rendering as `success`.
 */
const RUN_STATUSES = ["success", "noop", "error", "unknown"] as const;

/** One member of {@link RUN_STATUSES}. */
type RunStatus = (typeof RUN_STATUSES)[number];

/** Loudness tracks risk: an errored run shouts, a no-op recedes. */
const RUN_STATUS_MAP: StatusBadgeMap<RunStatus> = {
  success: { label: "success", variant: "ok", icon: CircleCheck },
  noop: { label: "noop", variant: "muted", icon: MinusCircle },
  error: { label: "error", variant: "danger", icon: CircleX },
  unknown: { label: "unknown", variant: "neutral", icon: CircleHelp }
};

/**
 * Narrow a stored status onto {@link RUN_STATUSES}.
 * @param status - Raw `utility_runs.status`; nullable in the schema.
 * @returns `true` when the status is one the badge map covers.
 */
function isRunStatus(status: string): status is RunStatus {
  return (RUN_STATUSES as readonly string[]).includes(status);
}

/**
 * Resolve the badge state for one run record.
 * @param status - Raw `utility_runs.status`.
 * @returns The map key to render; `unknown` for a null or unrecognised verdict.
 */
function runStatusOf(status: string | null): RunStatus {
  return status !== null && isRunStatus(status) ? status : "unknown";
}

/** Props for {@link UtilityRunHistory}. */
interface UtilityRunHistoryProps {
  /** Recent run records, newest first, as stored in SQLite. */
  runs: UtilityRun[];
}

/**
 * Chronological list of utility run records from the database.
 *
 * The rows were hand-rolled flex divs with a `text-[9px]` outline badge, so a failed
 * run read as a greyed-out success; they are now the shared dense table with one
 * status mapper, and the empty case is a real {@link EmptyState} instead of a bare
 * sentence that gave the operator nothing to do next.
 * @param props - Component props.
 * @param props.runs - Recent run records.
 * @returns The run-history block.
 */
export function UtilityRunHistory({ runs }: UtilityRunHistoryProps): React.JSX.Element {
  return (
    <div data-testid="utility-run-history" className="space-y-2">
      <PanelTitle as="h3">Recent runs</PanelTitle>
      <Separator decorative />
      {runs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No utility runs recorded yet."
          description="Run a script above and its verdict and start time land here."
          className="py-6"
        />
      ) : (
        <Table className={compactTableClass}>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Script</TableHead>
              <TableHead className="w-28 text-xs">Status</TableHead>
              <TableHead className="w-44 text-xs">Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="truncate font-mono text-sm">{run.name}</TableCell>
                <TableCell>
                  <StatusBadge state={runStatusOf(run.status)} map={RUN_STATUS_MAP} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {formatTimestamp(run.started_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
