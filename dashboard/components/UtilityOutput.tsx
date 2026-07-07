"use client";

import { Badge } from "@/components/ui/badge";
import { truncateOutput } from "@/lib/format";
import type { UtilityRunResult, UtilityStatus } from "@/lib/types";

/** Structured utility run/status output — avoids raw JSON dumps in sheets. */
export function UtilityOutput({ result }: { result: UtilityRunResult | UtilityStatus }) {
  return (
    <div className="space-y-3 text-xs">
      {"exitCode" in result && (
        <div className="flex items-center gap-2">
          <span className="md3-label-medium text-muted-foreground">Exit code</span>
          <Badge variant={result.exitCode === 0 ? "default" : "destructive"}>{String(result.exitCode)}</Badge>
        </div>
      )}
      {"status" in result && result.status && (
        <div className="flex items-center justify-between gap-3 border-b border-border py-1">
          <span className="text-muted-foreground">Status</span>
          <span className="font-mono text-foreground">{String(result.status)}</span>
        </div>
      )}
      {"stdout" in result && result.stdout ? (
        <div className="rounded-[var(--md-sys-shape-corner-medium)] border border-border bg-muted/30 p-3">
          <div className="md3-label-medium mb-1 text-muted-foreground">stdout</div>
          <div className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-foreground">
            {truncateOutput(String(result.stdout))}
          </div>
        </div>
      ) : null}
      {"stderr" in result && result.stderr ? (
        <div className="rounded-[var(--md-sys-shape-corner-medium)] border border-destructive/40 bg-destructive/5 p-3">
          <div className="md3-label-medium mb-1 text-destructive">stderr</div>
          <div className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-destructive">
            {truncateOutput(String(result.stderr))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
