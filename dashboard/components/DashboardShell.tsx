"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, RefreshCw, LayoutDashboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ThemeSelector } from "@/components/ThemeSelector";
import { useTheme } from "@/components/ThemeProvider";
import { authClient } from "@/lib/auth-client";
import { SECTION_DESCRIPTORS, SECTION_GROUP_LABELS, sectionsForGroup } from "@/lib/section-registry";
import { DASHBOARD_SECTION_GROUPS } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Height of the sticky header, shared with the scroll offset in globals.css. */
const HEADER_CLASS =
  "sticky top-0 z-30 h-14 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/70";

interface NavContentProps {
  /** True inside the mobile drawer, where taps must dismiss it. */
  isMobile?: boolean;
  /** Current pathname, used to mark the active section. */
  pathname: string;
  /** Called after a mobile nav tap to close the drawer. */
  onNavigate?: () => void;
  /** Sign the operator out. */
  onSignOut: () => void | Promise<void>;
  /** True while sign-out is in flight, so the button cannot be pressed twice. */
  signingOut: boolean;
}

/**
 * Rail body: brand, grouped section links, theme picker, sign out.
 *
 * The links are generated from the same registry that drives the routes and the
 * page titles, so a section cannot ship without a link to it again.
 *
 * @param props - Component props.
 * @param props.isMobile - True inside the mobile drawer, where taps dismiss it.
 * @param props.pathname - Current pathname, used to mark the active section.
 * @param props.onNavigate - Called after a mobile nav tap.
 * @param props.onSignOut - Sign the operator out.
 * @param props.signingOut - True while sign-out is in flight.
 * @returns The rail body.
 */
function NavContent({
  isMobile = false,
  pathname,
  onNavigate,
  onSignOut,
  signingOut
}: NavContentProps): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <div className={cn("flex h-full flex-col", isMobile ? "p-4" : "p-3")}>
      <Link
        href="/"
        {...(onNavigate ? { onClick: onNavigate } : {})}
        className="mb-6 flex items-center gap-3 rounded-[var(--md-sys-shape-corner-medium)] px-3 pt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--md-sys-shape-corner-medium)] bg-primary text-primary-foreground">
          <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="text-base font-semibold tracking-tight text-card-foreground">DGX Spark Lab</span>
      </Link>

      <nav aria-label={isMobile ? "Dashboard sections" : "Primary"} className="flex-1 space-y-5">
        {DASHBOARD_SECTION_GROUPS.map((group) => (
          <div key={group}>
            <h2 className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {SECTION_GROUP_LABELS[group]}
            </h2>
            <ul className="space-y-1">
              {sectionsForGroup(group).map((descriptor) => {
                const href = `/${descriptor.slug}`;
                const isActive = pathname === href;
                const Icon = descriptor.icon;
                return (
                  <li key={descriptor.slug}>
                    <Link
                      href={href}
                      {...(onNavigate ? { onClick: onNavigate } : {})}
                      aria-current={isActive ? "page" : undefined}
                      data-testid={`nav-${descriptor.slug}`}
                      className={cn(
                        "flex items-center gap-3 rounded-[var(--md-sys-shape-corner-medium)] px-3 py-2 text-sm font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                        isActive
                          ? "bg-primary font-semibold text-primary-foreground"
                          : "text-muted-foreground hover:bg-secondary hover:text-card-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {descriptor.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto space-y-2 pt-6">
        {!isMobile ? <div className="px-1 text-xs text-muted-foreground">{theme.label}</div> : null}
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => void onSignOut()}
          disabled={signingOut}
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </div>
  );
}

interface DashboardShellProps {
  /** Route content for the active section. */
  children: React.ReactNode;
  /** Host name to show in the header, so an operator knows which node they are on. */
  hostname?: string;
  /** When the server last read host state, in ms since the epoch. */
  generatedAt?: number;
}

/**
 * Console chrome: skip link, grouped rail, sticky header, main region.
 *
 * Two structural bugs lived here. `overflow-x-hidden` on the flex row made that
 * row the scroll container, so the sticky header never actually pinned and the
 * rail scrolled off an eight-screen page; and the rail was a hand-maintained
 * list of anchor links, so it drifted from the page and lost a section. The row
 * now uses `overflow-x-clip`, which does not create a scroll container, the rail
 * is its own sticky scroller, and the links come from the section registry.
 *
 * @param props - Component props.
 * @param props.children - Route content for the active section.
 * @param props.hostname - Host name to show in the header.
 * @param props.generatedAt - When the server last read host state.
 * @returns The console shell.
 */
export function DashboardShell({ children, hostname, generatedAt }: DashboardShellProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerRequested, setDrawerRequested] = useState(false);
  const [drawerPath, setDrawerPath] = useState(pathname);
  const [signingOut, setSigningOut] = useState(false);

  // The drawer sits outside the routed tree, so a route change never unmounts it. Deriving
  // its openness from the pathname closes it on every navigation, including a link rendered
  // inside a panel, and keeps that close out of an effect and its cascading re-render.
  const mobileOpen = drawerRequested && drawerPath === pathname;

  const openDrawer = (): void => {
    setDrawerPath(pathname);
    setDrawerRequested(true);
  };

  const closeDrawer = (): void => {
    setDrawerRequested(false);
  };

  const signOut = async (): Promise<void> => {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  const activeSection = Object.values(SECTION_DESCRIPTORS).find((descriptor) => pathname === `/${descriptor.slug}`);
  const updatedLabel =
    generatedAt === undefined ? null : new Date(generatedAt).toLocaleTimeString("en-GB", { hour12: false });

  return (
    <div className="flex min-h-screen w-full overflow-x-clip">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--md-sys-shape-corner-medium)] focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <aside
        aria-label="Primary"
        data-testid="sidebar"
        className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-border lg:bg-card"
      >
        <NavContent pathname={pathname} onSignOut={signOut} signingOut={signingOut} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setDrawerRequested} side="left" title="Menu">
        <NavContent isMobile pathname={pathname} onNavigate={closeDrawer} onSignOut={signOut} signingOut={signingOut} />
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className={HEADER_CLASS}>
          <div className="flex h-full items-center justify-between gap-3 px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={openDrawer}
                className="h-11 w-11 shrink-0 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </Button>
              <div className="min-w-0 truncate text-sm font-semibold tracking-tight text-card-foreground">
                <Link href="/" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {activeSection ? activeSection.label : "DGX Spark Lab"}
                </Link>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {hostname ? (
                <span
                  data-testid="shell-hostname"
                  className="hidden rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground sm:inline"
                >
                  {hostname}
                </span>
              ) : null}
              {updatedLabel ? (
                <span
                  data-testid="shell-updated"
                  className="hidden text-xs tabular-nums text-muted-foreground md:inline"
                >
                  Updated {updatedLabel}
                </span>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => router.refresh()}
                aria-label="Refresh host state"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <ThemeSelector compact className="w-auto min-w-[8.5rem] shrink-0" />
            </div>
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full min-w-0 max-w-full flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8"
        >
          {children}
        </main>

        <footer className="border-t border-border px-4 py-4 text-xs text-muted-foreground lg:px-6">
          Actions are scoped to the lab account. Destructive operations confirm first.
        </footer>
      </div>
    </div>
  );
}
