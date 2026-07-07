import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DashboardShell } from "../DashboardShell";
import { ThemeProvider } from "../ThemeProvider";

const push = vi.fn();
const refresh = vi.fn();
const signOut = vi.fn();

function renderShell(ui: React.ReactNode = <div>content</div>) {
  return render(
    <ThemeProvider>
      <DashboardShell>{ui}</DashboardShell>
    </ThemeProvider>
  );
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh })
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: (...args: unknown[]) => signOut(...args) }
}));

describe("DashboardShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "";
  });

  it("renders navigation in page scroll order", () => {
    renderShell();
    const links = screen.getAllByRole("link").filter((l) => l.getAttribute("href")?.startsWith("#"));
    const labels = links.map((l) => l.textContent?.trim());
    expect(labels).toContain("Storage");
    expect(labels.indexOf("Storage")).toBeLessThan(labels.indexOf("Tasks"));
    expect(labels.indexOf("Tasks")).toBeLessThan(labels.indexOf("Workspaces"));
    expect(labels.indexOf("Workspaces")).toBeLessThan(labels.indexOf("Machine State"));
  });

  it("marks storage as active by default", () => {
    renderShell();
    const storage = screen.getByRole("link", { name: /Storage/i });
    expect(storage).toHaveAttribute("aria-current", "page");
  });

  it("renders theme selector", () => {
    renderShell();
    expect(screen.getAllByTestId("theme-selector").length).toBeGreaterThan(0);
  });

  it("opens mobile menu sheet", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    expect(screen.getAllByText("DGX Spark Lab").length).toBeGreaterThan(1);
  });

  it("does not render a quick create shortcut", () => {
    renderShell();
    expect(screen.queryByRole("link", { name: /Quick Create/i })).not.toBeInTheDocument();
  });

  it("closes mobile menu when nav link clicked", () => {
    const scrollIntoView = vi.fn();
    vi.spyOn(document, "querySelector").mockReturnValue({ scrollIntoView } as unknown as Element);
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    const tasksLinks = screen.getAllByRole("link", { name: /^Tasks$/i });
    fireEvent.click(tasksLinks[tasksLinks.length - 1]!);
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("updates active nav from hashchange", () => {
    renderShell();
    fireEvent.click(screen.getByRole("link", { name: /^Tasks$/i }));
    expect(screen.getByRole("link", { name: /^Tasks$/i })).toHaveAttribute("aria-current", "page");
  });

  it("scrolls to section when nav link clicked", () => {
    const scrollIntoView = vi.fn();
    const el = document.createElement("div");
    el.scrollIntoView = scrollIntoView;
    vi.spyOn(document, "querySelector").mockReturnValue(el);

    renderShell();
    fireEvent.click(screen.getByRole("link", { name: /Tasks/i }));
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("signs out and redirects to login", async () => {
    signOut.mockResolvedValue(undefined);
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: /Sign out/i }));
    await vi.waitFor(() => {
      expect(signOut).toHaveBeenCalled();
      expect(push).toHaveBeenCalledWith("/login");
      expect(refresh).toHaveBeenCalled();
    });
  });
});
