import type React from "react";
import { hostname as osHostname } from "node:os";

import { DashboardShell } from "@/components/DashboardShell";
import { requireSession } from "@/lib/require-session";

/**
 * Authenticated console segment layout — wraps every route in {@link DashboardShell}.
 *
 * The shell needs two facts a client component cannot supply: which physical
 * node it is describing, and when the server last read it. Both are cheap here
 * (`node:os`, not a host probe) and both used to be absent, which left the
 * sticky header with nothing to carry but marketing copy.
 *
 * @param props.children - Nested route content.
 * @returns The console shell around the route.
 * @throws Via {@link requireSession} when no session is present.
 */
export default async function DashboardShellLayout({
  children
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  await requireSession();

  return (
    <DashboardShell hostname={osHostname()} generatedAt={Date.now()}>
      {children}
    </DashboardShell>
  );
}
