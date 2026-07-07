"use client";

import type React from "react";
import { Button } from "@/components/ui/button";

/**
 * Enhanced login error boundary page (Next.js auto Error Boundary for segment).
 * Lightweight: digest + guidance. Pairs with top-level dashboard error.tsx.
 */
/**
 * Login segment error boundary UI.
 * @param props.error - Caught error with optional Next.js digest.
 * @param props.reset - Callback to retry rendering the segment.
 * @returns Login error recovery UI.
 */
export default function LoginError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-destructive">{error.message || "Login page failed to load."}</p>
      {error.digest && <p className="text-[10px] tabular-nums text-muted-foreground">Digest: {error.digest}</p>}
      <Button onClick={reset} variant="outline" size="sm">
        Retry
      </Button>
      <p className="text-[10px] text-muted-foreground">Check credentials or network; use dev tools for details.</p>
    </div>
  );
}
