import type React from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { requireSession } from "@/lib/require-session";

/**
 * Authenticated dashboard segment layout — wraps pages in `DashboardShell`.
 * @param props.children - Nested dashboard page content.
 * @returns Dashboard shell with navigation chrome.
 * @throws When session is missing ({@link requireSession}).
 */
export default async function DashboardShellLayout({
  children
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  await requireSession();
  return <DashboardShell>{children}</DashboardShell>;
}
