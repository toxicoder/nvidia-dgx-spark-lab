/** Structured utility run/status output - avoids raw JSON dumps in sheets. */
import * as React from "react";

import { cn } from "@/lib/utils";
import { metricLabelClass, surfaceCardClass } from "@/components/panel-styles";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { truncateOutput } from "@/lib/format";
import type { UtilityRunResult, UtilityStatus } from "@/lib/types";

/** How one output block should read: neutral stdout, or destructive stderr. */
type OutputTone = "neutral" | "danger";

/** Props for {@link OutputBlock}. */
interface OutputBlockProps {
  /** Stream name, shown as the block label and used for the copy control's name. */
  label: string;
  /** Full stream text; the block previews it truncated and copies it whole. */
  text: string;
  /** Visual weight; `danger` tints the frame for stderr. */
  tone: OutputTone;
}

/**
 * One labelled stream block: a scrollable mono preview plus a verified copy.
 *
 * The preview is capped by {@link truncateOutput} so a runaway log cannot blow the
 * sheet out, while the copy button hands over the text in full - a clipboard that
 * silently carried the truncated preview would be the worse lie of the two.
 * @param props - Component props.
 * @param props.label - Stream name.
 * @param props.text - Full stream text.
 * @param props.tone - Neutral for stdout, danger for stderr.
 * @returns The output block.
 */
function OutputBlock({ label, text, tone }: OutputBlockProps): React.JSX.Element {
  return (
    <div className={cn(surfaceCardClass, tone === "danger" && "border-destructive/40 bg-destructive/5")}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={cn(metricLabelClass, tone === "danger" && "text-destructive")}>{label}</span>
        <CopyButton value={text} label={`Copy ${label}`} />
      </div>
      <ScrollArea label={`${label} output`} className={tone === "danger" ? "h-32" : "h-48"}>
        <pre
          className={cn(
            "font-mono text-xs whitespace-pre-wrap break-words",
            tone === "danger" ? "text-destructive" : "text-foreground"
          )}
        >
          {truncateOutput(text)}
        </pre>
      </ScrollArea>
    </div>
  );
}

/** Props for {@link UtilityOutput}. */
interface UtilityOutputProps {
  /** Either a run result (exit code and streams) or a status document. */
  result: UtilityRunResult | UtilityStatus;
}

/**
 * Structured utility run/status output - avoids raw JSON dumps in sheets.
 * @param props - Component props.
 * @param props.result - The result or status document to render.
 * @returns The structured output block.
 */
export function UtilityOutput({ result }: UtilityOutputProps): React.JSX.Element {
  const stdout = "stdout" in result && result.stdout ? String(result.stdout) : null;
  const stderr = "stderr" in result && result.stderr ? String(result.stderr) : null;

  return (
    <div className="space-y-3">
      {"exitCode" in result && (
        <div className="flex items-center justify-between gap-3">
          <span className={metricLabelClass}>Exit code</span>
          <Badge variant={result.exitCode === 0 ? "default" : "destructive"}>{String(result.exitCode)}</Badge>
        </div>
      )}
      {"status" in result && result.status ? (
        <div className="flex items-center justify-between gap-3">
          <span className={metricLabelClass}>Status</span>
          <span className="font-mono text-sm text-foreground">{String(result.status)}</span>
        </div>
      ) : null}
      {stdout ? <OutputBlock label="stdout" text={stdout} tone="neutral" /> : null}
      {stderr ? <OutputBlock label="stderr" text={stderr} tone="danger" /> : null}
    </div>
  );
}
