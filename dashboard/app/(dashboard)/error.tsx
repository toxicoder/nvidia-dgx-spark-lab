"use client";

import type React from "react";
import { Button } from "@/components/ui/button";

/**
 * Enhanced route-level error UI for the (dashboard) segment.
 * Next.js wraps this as an Error Boundary automatically.
 * Lightweight improvements: shows digest (prod), dev-only stack, guidance.
 * See also components/ErrorBoundary.tsx for client-component sub-tree protection (e.g. around Treemap viz).
 */
/**
 * Dashboard segment error boundary UI.
 * @param props.error - Caught error with optional Next.js digest.
 * @param props.reset - Callback to retry rendering the segment.
 * @returns Dashboard error recovery UI with dev-only stack trace.
 */
export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  const isDev = process.env.NODE_ENV !== "production";
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-lg font-semibold">Dashboard failed to load</h2>
      <p className="max-w-md text-sm text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
      {error.digest && <p className="text-[10px] text-muted-foreground tabular-nums">Digest: {error.digest}</p>}
      {isDev && error.stack && (
        <pre className="max-w-full overflow-auto text-left text-[10px] text-destructive whitespace-pre-wrap border p-2 rounded">
          {error.stack}
        </pre>
      )}
      <Button onClick={reset} variant="outline" size="sm">
        Try again
      </Button>
      <p className="text-[10px] text-muted-foreground max-w-xs">
        If this persists after retry, check console or restart the dev server.
      </p>
    </div>
  );
}
