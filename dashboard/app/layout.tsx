import type React from "react";
import type { Metadata } from "next";
import "./globals.css";
import "./themes.css";
import { LegacyHashMigrator } from "@/components/LegacyHashMigrator";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DASHBOARD_THEMES, DEFAULT_THEME_ID, THEME_STORAGE_KEY } from "@/lib/themes";
import { ensureAdminUser } from "@/lib/seed-admin";

/**
 * Root application layout — theme bootstrap, admin seeding, and global providers.
 * Runs `ensureAdminUser()` once per cold start when admin env vars are set.
 */

/**
 * Apply the stored theme before first paint.
 *
 * The id list and the light/dark rule are derived from {@link DASHBOARD_THEMES}
 * rather than hand-copied. They used to be literals here, which meant a theme
 * added to the catalog silently reset to the default for every operator who had
 * chosen it, and the light/dark class could disagree with the catalog's `mode`.
 */
const themeInitScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var d=${JSON.stringify(DEFAULT_THEME_ID)};var v=${JSON.stringify(DASHBOARD_THEMES.map((theme) => theme.id))};var l=${JSON.stringify(DASHBOARD_THEMES.filter((theme) => theme.mode === "light").map((theme) => theme.id))};var t=localStorage.getItem(k)||d;if(v.indexOf(t)<0)t=d;var r=document.documentElement;r.setAttribute("data-theme",t);if(l.indexOf(t)>=0)r.classList.remove("dark");else r.classList.add("dark");}catch(e){}})();`;

/** Next.js document metadata; the template gives every section a distinct tab. */
export const metadata: Metadata = {
  title: {
    default: "DGX Spark Lab • Dashboard",
    template: "%s • DGX Spark Lab"
  },
  description: "Self-hosted control plane for the lab: inference, storage, workloads, and utilities."
};

/**
 * Root HTML layout — theme bootstrap script, admin seeding, and global providers.
 *
 * @param props.children - Application page tree.
 * @returns Root `<html>` document with theme and toast providers.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  await ensureAdminUser();

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-background font-sans text-foreground">
        <ThemeProvider>
          <LegacyHashMigrator />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
