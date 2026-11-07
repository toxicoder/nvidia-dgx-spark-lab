import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import { hintClass, panelRadiusClass } from "@/components/panel-styles";
import { Button } from "@/components/ui/button";

/** Props for {@link ErrorState}. */
export interface ErrorStateProps {
  /** Operator-facing sentence: what failed, in plain words. */
  message: string;
  /** Optional headline naming what failed, e.g. "Resource Guard". */
  title?: string;
  /** Raw detail (utility stderr, exit code, Zod issue) kept one click away. */
  detail?: string;
  /** Developer-only stack trace; callers gate this on NODE_ENV before passing it. */
  technical?: string;
  /** Re-run the failed read; the button only renders when this is supplied. */
  onRetry?: () => void;
  /** Label for the retry button. */
  retryLabel?: string;
  /** Extra actions rendered beside retry, e.g. a link back to the overview. */
  actions?: React.ReactNode;
  /** Extra classes for call-site nudges. */
  className?: string;
}

/**
 * Inline failure block with the retry affordance that early returns kept eating.
 *
 * `ResourcesPanel` answered a Resource Guard failure with `if (error) return <div>` —
 * a dead red sentence, header and Refresh button discarded, so the one gate the
 * operator most needs to re-query could only be re-queryed by reloading the page. This
 * block is inline (the header survives) and always offers a way forward.
 * @param props - Message, optional detail, optional retry.
 * @returns The alert-role error block.
 */
export function ErrorState({
  message,
  title,
  detail,
  technical,
  onRetry,
  retryLabel = "Retry",
  actions,
  className
}: ErrorStateProps): React.JSX.Element {
  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn(
        "flex flex-col items-start gap-2 border border-destructive/40 bg-destructive/10 p-3 text-sm",
        panelRadiusClass,
        className
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <span className="min-w-0">
          {title ? (
            <span data-testid="error-state-title" className="block font-semibold text-destructive">
              {title}
            </span>
          ) : null}
          <span className="block font-medium text-destructive">{message}</span>
        </span>
      </div>

      {detail ? (
        <details data-slot="error-state-detail" data-testid="error-state-detail" className={cn(hintClass, "w-full")}>
          <summary className="cursor-pointer">Details</summary>
          <pre className="mt-1 font-mono text-xs whitespace-pre-wrap break-all">{detail}</pre>
        </details>
      ) : null}

      {technical ? (
        <pre
          data-slot="error-state-technical"
          data-testid="error-state-technical"
          className="max-h-40 w-full overflow-auto font-mono text-[11px] whitespace-pre-wrap break-all text-destructive/80"
        >
          {technical}
        </pre>
      ) : null}

      {onRetry || actions ? (
        <div className="flex flex-wrap items-center gap-2">
          {onRetry ? (
            <Button size="sm" variant="outline" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
