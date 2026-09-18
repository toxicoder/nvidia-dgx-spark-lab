import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Provider } from "@/components/provider";
import { SITE_NAME } from "@/lib/site";

import "./global.css";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — Docs`,
    template: `%s | ${SITE_NAME}`
  },
  description: `Operator documentation for the ${SITE_NAME} Kubernetes lab.`
};

/**
 * Root layout: applies the Voltage theme and mounts the framework providers.
 *
 * `suppressHydrationWarning` is required by `next-themes`: its theme script rewrites the
 * `class` attribute on `<html>` before React hydrates, which otherwise trips the mismatch
 * check.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen" suppressHydrationWarning>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
