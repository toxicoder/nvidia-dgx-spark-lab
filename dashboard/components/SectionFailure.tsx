"use client";

import type React from "react";
import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/ui/error-state";

interface SectionFailureProps {
  /** Headline naming the section that failed, e.g. "Storage". */
  title: string;
  /** Cause, from `lib/section-result`'s `attempt`. */
  message: string;
}

/**
 * Client-side retry surface for a section whose host read failed.
 *
 * The section modules are server components, so a retry cannot be a callback
 * they hand down; re-running the server render is what actually re-reads the
 * host. That makes this the one place a failed section recovers without a full
 * page reload, which matters because the section is now a route of its own.
 *
 * @param props - Component props.
 * @param props.title - Headline naming the failed section.
 * @param props.message - Cause to show the operator.
 * @returns An alert with a working "Try again" action.
 */
export function SectionFailure({ title, message }: SectionFailureProps): React.JSX.Element {
  const router = useRouter();

  return <ErrorState title={title} message={message} onRetry={() => router.refresh()} />;
}
