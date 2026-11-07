"use client";

import type React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

interface SectionErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary for a single console section.
 *
 * Because a section is now a route, this boundary covers one panel group and
 * nothing else — the failure that used to blank ten sections now blanks one, and
 * the sidebar stays intact so the operator can simply go somewhere else. It
 * offers a retry and a way home rather than advice about dev servers.
 *
 * @param props - Boundary props supplied by Next.js.
 * @param props.error - The caught error, carrying a server-log `digest` in prod.
 * @param props.reset - Re-renders the segment, which re-runs the host reads.
 * @returns The section failure UI.
 */
export default function SectionError({ error, reset }: SectionErrorProps): React.JSX.Element {
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <ErrorState
      title="This section could not be loaded"
      message={error.message || "An unexpected error occurred while reading host state."}
      {...(error.digest ? { detail: `Digest ${error.digest}` } : {})}
      onRetry={reset}
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link href="/">Back to overview</Link>
        </Button>
      }
      {...(isDev && error.stack ? { technical: error.stack } : {})}
    />
  );
}
