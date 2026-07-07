/** Recent utility script runs — compact list with status badge and timestamp. */
import { Badge } from "@/components/ui/badge";
import { formatTimestamp } from "@/lib/format";
import type { UtilityRun } from "@/lib/db/schema";

/** Renders a chronological list of utility run records from the database. */
export function UtilityRunHistory({ runs }: { runs: UtilityRun[] }) {
  if (runs.length === 0) {
    return <p className="text-xs text-muted-foreground">No utility runs recorded yet.</p>;
  }

  return (
    <div className="space-y-2 text-xs" data-testid="utility-run-history">
      {runs.map((run) => (
        <div
          key={run.id}
          className="flex items-center justify-between rounded-[var(--md-sys-shape-corner-medium)] border border-border bg-muted/30 px-3 py-2"
        >
          <span className="font-mono">{run.name}</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px]">
              {run.status || "unknown"}
            </Badge>
            <span className="text-muted-foreground tabular-nums">{formatTimestamp(run.started_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
