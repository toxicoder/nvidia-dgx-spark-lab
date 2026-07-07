"use client";

import React, { useEffect, useState } from "react";
import {
  Menu,
  LayoutDashboard,
  Cpu,
  HardDrive,
  Wrench,
  Server,
  LogOut,
  Monitor,
  Activity,
  Brain,
  BarChart3,
  KeyRound
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ThemeSelector } from "@/components/ThemeSelector";
import { useTheme } from "@/components/ThemeProvider";

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Order matches dashboard page scroll: storage → tasks → workspaces → system → utilities */
const navLinks: NavLink[] = [
  { href: "#resources", label: "Resources", icon: Activity },
  { href: "#observability", label: "Observability", icon: BarChart3 },
  { href: "#inference", label: "Inference", icon: Brain },
  { href: "#storage", label: "Storage", icon: HardDrive },
  { href: "#tasks", label: "Tasks", icon: Cpu },
  { href: "#workspaces", label: "Workspaces", icon: Monitor },
  { href: "#system", label: "Machine State", icon: Server },
  { href: "#utilities", label: "Utilities", icon: Wrench },
  { href: "#secrets", label: "Secrets", icon: KeyRound }
];

interface NavContentProps {
  isMobile?: boolean;
  active: string;
  setActive: (hash: string) => void;
  onMobileClose: () => void;
  onSignOut: () => void | Promise<void>;
}

function NavContent({ isMobile = false, active, setActive, onMobileClose, onSignOut }: NavContentProps) {
  const { theme } = useTheme();
  return (
    <div className={cn("flex h-full flex-col", isMobile ? "p-4" : "p-3")}>
      <div className="mb-6 flex items-center gap-3 px-3 pt-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-[var(--md-sys-shape-corner-medium)] border border-primary/30 bg-primary">
          <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="text-base font-semibold tracking-tight text-[var(--md-sys-color-on-surface)]">
          DGX Spark Lab
        </div>
      </div>

      <nav className="flex-1 space-y-1.5">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = active === link.href;
          return (
            <a
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                setActive(link.href);
                document.querySelector(link.href)?.scrollIntoView({
                  behavior: "smooth"
                });
                if (isMobile) onMobileClose();
              }}
              className={cn(
                "flex items-center gap-3 rounded-[var(--md-sys-shape-corner-medium)] px-3 py-2.5 text-sm font-medium transition-all",
                "hover:bg-[var(--md-sys-color-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]",
                isActive
                  ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                  : "text-[var(--md-sys-color-on-surface-variant)]"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </a>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 p-2">
        <ThemeSelector compact className="w-full max-w-full" />
        <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={onSignOut}>
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
        <div className="px-1 text-[10px] text-muted-foreground">{theme.label} • MD3 + shadcn</div>
      </div>
    </div>
  );
}

/** App shell with sidebar navigation, theme selector, and responsive mobile drawer. */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("#storage");

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash || "#storage";
      setActive(hash);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const signOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  const navProps = {
    active,
    setActive,
    onMobileClose: () => setMobileOpen(false),
    onSignOut: signOut
  };

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden">
      <aside
        data-testid="sidebar"
        className="hidden lg:flex lg:w-56 lg:shrink-0 lg:flex-col lg:border-r lg:border-[var(--md-sys-color-outline-variant)] lg:bg-[var(--md-sys-color-surface)]"
      >
        <NavContent {...navProps} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen} side="left" title="Menu">
        <NavContent {...navProps} isMobile />
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--md-sys-color-surface)]/60">
          <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMobileOpen(true)}
                className="h-11 w-11 shrink-0"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div className="truncate text-sm font-semibold tracking-tight text-[var(--md-sys-color-on-surface)]">
                DGX Spark Lab
              </div>
            </div>
            <div className="hidden text-xs text-[var(--md-sys-color-on-surface-variant)] lg:block">
              Efficient • Safe • MD3 modern
            </div>
            <div className="flex items-center gap-3">
              <ThemeSelector compact className="hidden w-auto min-w-[8.75rem] max-w-[10.5rem] shrink-0 sm:flex" />
              <div className="hidden text-xs text-[var(--md-sys-color-on-surface-variant)] md:block">
                Scoped • NodePort • Self-hosted
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>

        <footer className="border-t border-[var(--md-sys-color-outline-variant)] px-4 py-4 text-[10px] text-muted-foreground lg:px-6">
          Built with shadcn/ui + Material Design 3. All actions scoped for safety.
        </footer>
      </div>
    </div>
  );
}
