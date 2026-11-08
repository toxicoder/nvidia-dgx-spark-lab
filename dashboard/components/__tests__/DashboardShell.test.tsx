import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

import { DashboardShell } from "../DashboardShell";
import { ThemeProvider } from "../ThemeProvider";
import { DASHBOARD_SECTIONS, DASHBOARD_SECTION_GROUPS } from "@/lib/types";
import { SECTION_DESCRIPTORS } from "@/lib/section-registry";

const push = vi.fn();
const refresh = vi.fn();
const signOut = vi.fn<() => Promise<void>>();

let pathname = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => pathname
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: () => signOut() }
}));

/**
 * The shell tree every test renders, kept in one place so a rerender matches the first render.
 *
 * @param ui - Content to place in the main region.
 * @returns The themed shell element.
 */
function shellTree(ui: React.ReactNode = <div>content</div>) {
  return (
    <ThemeProvider>
      <DashboardShell hostname="spark-01" generatedAt={Date.UTC(2026, 0, 1, 12, 30, 0)}>
        {ui}
      </DashboardShell>
    </ThemeProvider>
  );
}

/**
 * Render the shell with the theme provider it expects.
 *
 * @param ui - Content to place in the main region.
 * @returns The testing-library render result.
 */
function renderShell(ui: React.ReactNode = <div>content</div>) {
  return render(shellTree(ui));
}

describe("DashboardShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = "/";
    window.location.hash = "";
  });

  it("links to every section in the closed set", () => {
    renderShell();
    for (const slug of DASHBOARD_SECTIONS) {
      const link = screen.getByTestId(`nav-${slug}`);
      expect(link).toHaveAttribute("href", `/${slug}`);
      expect(link).toHaveTextContent(SECTION_DESCRIPTORS[slug].label);
    }
  });

  it("groups the rail by operator intent", () => {
    renderShell();
    for (const group of DASHBOARD_SECTION_GROUPS) {
      expect(screen.getAllByText(new RegExp(group, "i")).length, `group ${group}`).toBeGreaterThan(0);
    }
  });

  it("uses routes rather than same-page anchors, so sections are deep-linkable", () => {
    renderShell();
    // The skip link is the one legitimate in-page target on the page.
    const anchors = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("#") && href !== "#main");
    expect(anchors).toEqual([]);
  });

  it("marks the active section from the pathname, not from the last click", () => {
    pathname = "/utilities";
    renderShell();
    expect(screen.getByTestId("nav-utilities")).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("nav-storage")).not.toHaveAttribute("aria-current");
  });

  it("marks nothing active on the overview", () => {
    renderShell();
    const active = screen.queryAllByTestId(/nav-/).filter((link) => link.getAttribute("aria-current") === "page");
    expect(active).toEqual([]);
  });

  it("gives keyboard users a skip link and a target to skip to", () => {
    renderShell();
    const skip = screen.getByRole("link", { name: /skip to content/i });
    expect(skip).toHaveAttribute("href", "#main");
    expect(document.getElementById("main")).toBeInTheDocument();
  });

  it("names its landmarks so two nav regions are distinguishable", () => {
    renderShell();
    expect(screen.getByRole("complementary", { name: /primary/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
  });

  it("renders the theme selector exactly once on desktop", () => {
    renderShell();
    // Two selectors used to render at once on desktop and none on a phone.
    expect(screen.getAllByTestId("theme-selector")).toHaveLength(1);
  });

  it("opens the mobile drawer with its own labelled nav", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    expect(screen.getByRole("navigation", { name: /dashboard sections/i })).toBeInTheDocument();
  });

  it("shows which node the console is describing and how fresh it is", () => {
    renderShell();
    expect(screen.getByTestId("shell-hostname")).toHaveTextContent("spark-01");
    expect(screen.getByTestId("shell-updated")).toHaveTextContent(/Updated \d{2}:\d{2}:\d{2}/);
  });

  it("re-reads host state from the header", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: /refresh host state/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("disables sign out while it is in flight", async () => {
    let release: () => void = () => {};
    signOut.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );

    renderShell();
    const button = screen.getByRole("button", { name: /sign out/i });
    fireEvent.click(button);
    expect(button).toBeDisabled();

    release();
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("renders route content inside main", () => {
    renderShell(<p>section body</p>);
    expect(screen.getByText("section body")).toBeInTheDocument();
  });
});

describe("DashboardShell mobile rail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = "/";
  });

  it("closes the drawer once the operator picks a section", () => {
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    const drawer = screen.getByTestId("ui-sheet");
    fireEvent.click(within(drawer).getByTestId("nav-storage"));

    expect(screen.queryByTestId("ui-sheet")).not.toBeInTheDocument();
  });

  it("closes the drawer when the route moves without a drawer click", () => {
    // A panel link, a router.push after a utility run, or a back gesture can all move the
    // route while the drawer is open. The drawer lives outside the routed tree, so nothing
    // unmounts it: its openness derives from the pathname to cover these.
    const { rerender } = renderShell();

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    expect(screen.getByTestId("ui-sheet")).toBeInTheDocument();

    pathname = "/tasks";
    rerender(shellTree());

    expect(screen.queryByTestId("ui-sheet")).not.toBeInTheDocument();
  });
});

describe("DashboardShell header without optional context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = "/";
  });

  it("omits the hostname and last-updated chips when the route supplies neither", () => {
    // A route that has not read the host yet must not render an empty pill or a
    // "Updated 00:00:00" lie.
    render(
      <ThemeProvider>
        <DashboardShell>content</DashboardShell>
      </ThemeProvider>
    );

    expect(screen.queryByTestId("shell-hostname")).not.toBeInTheDocument();
    expect(screen.queryByTestId("shell-updated")).not.toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("marks the rail item for the section the operator is on", () => {
    pathname = "/storage";
    renderShell();

    const active = screen.getByTestId("nav-storage");
    expect(active).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("nav-resources")).not.toHaveAttribute("aria-current");
  });
});
