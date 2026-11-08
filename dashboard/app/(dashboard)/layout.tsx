import type React from "react";
import { hostname as osHostname } from "node:os";

import { DashboardShell } from "@/components/DashboardShell";
import { requireSession } from "@/lib/require-session";

/**
 * Read the two request-time facts the sticky header carries.
 *
 * Both reads are impure, so they stay out of the component body: a render has to be a pure
 * function of its inputs, and inlining `Date.now()` in the JSX is exactly what the
 * purity rule rejects. Doing it here keeps each read once-per-request on the server.
 *
 * @returns The node name and the moment this request read it.
 */
async function readShellFacts(): Promise<{ hostname: string; generatedAt: number }> {
  return { hostname: osHostname(), generatedAt: Date.now() };
}

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
  const { hostname, generatedAt } = await readShellFacts();

  return (
    <DashboardShell hostname={hostname} generatedAt={generatedAt}>
      {children}
    </DashboardShell>
  );
}
