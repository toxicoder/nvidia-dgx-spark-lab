import type React from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";
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
 * The dashboard's typeface, self-hosted.
 *
 * Left to itself the page inherits Tailwind's system stack, so one build renders in DejaVu
 * Sans on a Linux dev box, Noto Sans inside the pinned test image, and Segoe UI on an
 * operator's laptop. Text metrics follow the font, which made every visual baseline
 * environment-dependent and left operator screenshots unrepeatable. The latin subset covers
 * each glyph the UI renders, so nothing falls back to a font this file cannot see.
 */
const notoSans = localFont({
  src: "./fonts/NotoSans-latin.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-noto-sans",
  display: "swap",
  fallback: ["system-ui", "Arial", "sans-serif"],
  adjustFontFallback: false
});

/**
 * The companion monospace face for sizes, paths, and node names.
 *
 * It carries the same hazard as {@link notoSans}: Tailwind's default mono stack lands on
 * DejaVu Sans Mono on one host and Liberation Mono on another, and the storage table renders
 * its byte counts and file names in it.
 */
const notoSansMono = localFont({
  src: "./fonts/NotoSansMono-latin.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-noto-sans-mono",
  display: "swap",
  fallback: ["ui-monospace", "Consolas", "monospace"],
  adjustFontFallback: false
});

/**
 * Root HTML layout — theme bootstrap script, admin seeding, and global providers.
 *
 * @param props.children - Application page tree.
 * @returns Root `<html>` document with theme and toast providers.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  await ensureAdminUser();

  return (
    <html lang="en" className={`dark ${notoSans.variable} ${notoSansMono.variable}`} suppressHydrationWarning>
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
