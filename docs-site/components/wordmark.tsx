"use client";

import type { ReactNode } from "react";

import { BRAND, SITE_NAME } from "@/lib/site";

/**
 * Lowercase brand wordmark with the project name as the docs subtitle.
 *
 * MkDocs rendered the site name as the header title; the brand voice replaces it and the
 * project name moves to the secondary line, which is how the Voltage brand sheet pairs them.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={`flex flex-col leading-none ${className ?? ""}`} aria-label={`${BRAND} ${SITE_NAME}`}>
      <span className="text-1.125rem font-bold tracking-tight lowercase text-fd-foreground">{BRAND}</span>
      <span className="text-0.6875rem font-medium text-fd-muted-foreground">{SITE_NAME}</span>
    </div>
  );
}

/** Repository icon used for the header's GitHub link. */
export function RepoIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden role="img">
      <title>GitHub</title>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.42-1.305.762-1.605-2.665-.305-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23a9.58 9.58 0 0 1 3-.402c1.02.005 2.04.138 3 .402 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.62-5.485 5.92.42.36.81 1.1.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .322.21.694.825.576 4.765-1.587 8.194-6.085 8.194-11.382 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
