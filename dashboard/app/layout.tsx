import type React from "react";
import type { Metadata } from "next";
import "./globals.css";
import "./themes.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DEFAULT_THEME_ID, THEME_STORAGE_KEY } from "@/lib/themes";
import { ensureAdminUser } from "@/lib/seed-admin";

/**
 * Root application layout — theme bootstrap, admin seeding, and global providers.
 * Runs `ensureAdminUser()` once per cold start when admin env vars are set.
 */
const themeInitScript = `(function(){try{var k="${THEME_STORAGE_KEY}";var d="${DEFAULT_THEME_ID}";var v=["spark-lime","ocean-teal","violet-dusk","sunset-amber","rose-neon","arctic-frost","mono-slate","cyber-mint","daylight","paper-sand"];var t=localStorage.getItem(k)||d;if(v.indexOf(t)<0)t=d;var r=document.documentElement;r.setAttribute("data-theme",t);if(t==="daylight"||t==="paper-sand")r.classList.remove("dark");else r.classList.add("dark");}catch(e){}})();`;

/** Next.js document metadata for the dashboard app. */
export const metadata: Metadata = {
  title: "DGX Spark Lab • Dashboard",
  description: "Self-hosted control plane for the lab (Tasks, Storage, Machine State)"
};

/**
 * Root HTML layout — theme bootstrap script, admin seeding, and global providers.
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
      <body className="bg-background text-foreground font-sans">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
