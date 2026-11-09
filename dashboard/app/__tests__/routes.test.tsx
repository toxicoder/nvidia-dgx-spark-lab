import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { DASHBOARD_SECTIONS } from "@/lib/types";

vi.mock("@/components/DashboardShell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-shell">{children}</div>
}));

/** Async server panels suspend in jsdom — stub for route-level smoke coverage. */
function panelStub(label: string) {
  const Stub = () => <div>{label}</div>;
  Stub.displayName = `PanelStub(${label})`;
  return Stub;
}
vi.mock("@/components/ResourcesPanel", () => ({ ResourcesPanel: panelStub("Resource Guard") }));
vi.mock("@/components/InferencePanel", () => ({ InferencePanel: panelStub("Inference") }));
vi.mock("@/components/NemotronStackPanel", () => ({ NemotronStackPanel: panelStub("Nemotron") }));
vi.mock("@/components/StoragePanel", () => ({
  StoragePanel: ({ visualShowDupesSheet }: { visualShowDupesSheet?: boolean }) => (
    <div data-testid="storage-panel">{visualShowDupesSheet ? "dupes-fixture" : "Storage"}</div>
  )
}));
vi.mock("@/components/TasksPanel", () => ({ TasksPanel: panelStub("Tasks") }));
vi.mock("@/components/WorkspacesPanel", () => ({ WorkspacesPanel: panelStub("Workspaces") }));
vi.mock("@/components/MachineStatePanel", () => ({ MachineStatePanel: panelStub("Machine") }));
vi.mock("@/components/UtilitiesPanel", () => ({ UtilitiesPanel: panelStub("Utilities") }));
vi.mock("@/components/SecretsPanel", () => ({ SecretsPanel: panelStub("Secrets Vault") }));
vi.mock("@/components/ObservabilityPanel", () => ({ ObservabilityPanel: panelStub("Observability") }));
vi.mock("@/components/OpenWebUIPanel", () => ({ OpenWebUIPanel: panelStub("Agent Chat") }));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({
    onOpenChange,
    children,
    title
  }: {
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
    title?: string;
  }) => (
    <div data-testid="sheet-mock">
      <span>{title}</span>
      <button type="button" onClick={() => onOpenChange?.(false)}>
        sheet-close
      </button>
      {children}
    </div>
  )
}));

describe("app routes", () => {
  beforeEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("renders login page", async () => {
    const LoginPage = (await import("@/app/login/page")).default;
    render(<LoginPage />);
    expect(screen.getByText("DGX Spark Lab Dashboard")).toBeInTheDocument();
    expect(screen.getByText(/Sign in to access/)).toBeInTheDocument();
  });

  it("renders login error boundary", async () => {
    const LoginError = (await import("@/app/login/error")).default;
    const reset = vi.fn();
    render(<LoginError error={new Error("auth failed")} reset={reset} />);
    expect(screen.getByText("auth failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(reset).toHaveBeenCalled();
  });

  it("renders login error boundary fallback message", async () => {
    const LoginError = (await import("@/app/login/error")).default;
    render(<LoginError error={{ message: "" } as Error} reset={vi.fn()} />);
    expect(screen.getByText("Login page failed to load.")).toBeInTheDocument();
  });

  it("renders login error boundary digest", async () => {
    const LoginError = (await import("@/app/login/error")).default;
    const err = Object.assign(new Error("x"), { digest: "login-digest" });
    render(<LoginError error={err} reset={vi.fn()} />);
    expect(screen.getByText(/Digest: login-digest/)).toBeInTheDocument();
  });

  it("renders dashboard loading skeleton", async () => {
    const Loading = (await import("@/app/(dashboard)/loading")).default;
    render(<Loading />);
    expect(screen.getAllByTestId("ui-skeleton").length).toBeGreaterThan(0);
  });

  it("renders dashboard error boundary with digest", async () => {
    const DashboardError = (await import("@/app/(dashboard)/error")).default;
    const reset = vi.fn();
    const err = Object.assign(new Error("load failed"), { digest: "abc123" });
    render(<DashboardError error={err} reset={reset} />);
    expect(screen.getByText("Dashboard failed to load")).toBeInTheDocument();
    expect(screen.getByText(/Digest: abc123/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalled();
  });

  it("renders dashboard error boundary fallback and dev stack", async () => {
    const DashboardError = (await import("@/app/(dashboard)/error")).default;
    const err = Object.assign(new Error(""), { stack: "Error at test.ts:1" });
    render(<DashboardError error={err} reset={vi.fn()} />);
    expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
    expect(screen.getByText(/Error at test.ts/)).toBeInTheDocument();
  });

  it("hides dashboard error stack in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const DashboardError = (await import("@/app/(dashboard)/error")).default;
    const err = Object.assign(new Error("prod"), { stack: "secret stack" });
    render(<DashboardError error={err} reset={vi.fn()} />);
    expect(screen.queryByText(/secret stack/)).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it("renders dashboard layout with session bypass", async () => {
    const Layout = (await import("@/app/(dashboard)/layout")).default;
    const jsx = await Layout({ children: <span>child</span> });
    render(jsx);
    expect(screen.getByTestId("dashboard-shell")).toBeInTheDocument();
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("renders root layout and seeds admin in mock mode", async () => {
    const RootLayout = (await import("@/app/layout")).default;
    const jsx = await RootLayout({ children: <span>app-child</span> });
    render(jsx);
    expect(screen.getByText("app-child")).toBeInTheDocument();

    // jsdom drops a rendered <html> element, so the classes are read off the element the
    // layout returns. These two are the only route to the self-hosted faces: drop one and
    // the page falls back to the platform default while every other test stays green.
    const htmlProps = jsx.props as unknown as { className?: string };
    const classes = (htmlProps.className ?? "").split(/\s+/);
    expect(classes).toContain("--font-noto-sans");
    expect(classes).toContain("--font-noto-sans-mono");
  });

  it("renders the dashboard not-found page for an unknown section", async () => {
    const NotFound = (await import("@/app/(dashboard)/not-found")).default;
    render(<NotFound />);

    // `notFound()` in the `[section]` route lands here. Before this page existed the operator
    // got Next's unstyled default, which was also the one page left rendering in the system
    // font. The heading and the way back are the two things the page has to get right.
    expect(screen.getByRole("heading", { name: "Section not found", level: 1 })).toBeInTheDocument();
    const home = screen.getByRole("link", { name: /back to the overview/i });
    expect(home).toHaveAttribute("href", "/");
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders the overview and links to every section in the closed set", async () => {
    const OverviewPage = (await import("@/app/(dashboard)/page")).default;
    const jsx = await OverviewPage();
    render(jsx);

    expect(screen.getByRole("heading", { name: "DGX Spark Lab", level: 1 })).toBeInTheDocument();

    // The whole point of the roll-up: no section is reachable only by scrolling,
    // which is how Agent Chat went missing from the old hand-maintained sidebar.
    for (const slug of DASHBOARD_SECTIONS) {
      const card = screen.getByTestId(`section-nav-card-${slug}`);
      expect(card).toHaveAttribute("href", `/${slug}`);
    }
  });

  it("degrades a KPI tile when a host probe returns a non-array", async () => {
    vi.resetModules();
    vi.doMock("@/lib/host", async () => {
      const actual = await vi.importActual<typeof import("@/lib/host")>("@/lib/host");
      return { ...actual, listContainers: async () => null as never };
    });
    const { OverviewKpis } = await import("@/app/(dashboard)/page");
    render(await OverviewKpis());

    // A probe that answers with garbage must not read as "0 containers running".
    expect(screen.queryByText(/0 containers running/)).not.toBeInTheDocument();

    const labels = screen.getAllByTestId("metric-tile-label").map((el) => el.textContent?.trim());
    expect(labels).toContain("Containers");

    const values = screen.getAllByTestId("metric-tile-value").map((el) => el.textContent?.trim());
    expect(values).toContain("—");
    vi.doUnmock("@/lib/host");
    vi.resetModules();
  });

  it("renders every section route as its own page", async () => {
    const SectionPage = (await import("@/app/(dashboard)/[section]/page")).default;

    for (const slug of DASHBOARD_SECTIONS) {
      const jsx = await SectionPage({ params: Promise.resolve({ section: slug }) });
      const { unmount } = render(jsx);
      // The route owns the h1 and the section starts at an h2, which is what
      // makes the heading outline navigable on a page that used to be h1 -> h3.
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
      unmount();
    }
  });

  it("gives each section a distinct document title", async () => {
    const { generateMetadata } = await import("@/app/(dashboard)/[section]/page");
    const titles = await Promise.all(
      DASHBOARD_SECTIONS.map(async (slug) => {
        const meta = await generateMetadata({ params: Promise.resolve({ section: slug }) });
        return meta.title;
      })
    );

    // Ten sections sharing one title made the tab bar and runbook links useless.
    expect(new Set(titles).size).toBe(DASHBOARD_SECTIONS.length);
  });

  it("404s a section route that is not in the closed set", async () => {
    const SectionPage = (await import("@/app/(dashboard)/[section]/page")).default;
    await expect(SectionPage({ params: Promise.resolve({ section: "not-a-section" }) })).rejects.toThrow();
  });

  it("renders dev panels fixture page under mocks", async () => {
    const DevPanels = (await import("@/app/dev/panels/page")).default;
    const jsx = await DevPanels();
    render(jsx);
    expect(screen.getByText("Panel fixture gallery")).toBeInTheDocument();
  });

  it("renders dev UI component gallery", async () => {
    const DevUi = (await import("@/app/dev/ui/page")).default;
    render(<DevUi />);
    expect(screen.getByText("UI component gallery")).toBeInTheDocument();
    expect(screen.getByTestId("visual-test-fixtures")).toBeInTheDocument();
  });

  it("renders dev empty-dupes fixture page", async () => {
    const EmptyDupes = (await import("@/app/dev/panels/empty-dupes/page")).default;
    const jsx = await EmptyDupes();
    render(jsx);
    expect(screen.getByTestId("visual-panel-fixtures")).toBeInTheDocument();
  });

  it("renders dev utility-sheet fixture page", async () => {
    const UtilitySheet = (await import("@/app/dev/panels/utility-sheet/page")).default;
    render(<UtilitySheet />);
    expect(screen.getByTestId("visual-panel-fixtures")).toBeInTheDocument();
  });

  it("renders VisualUtilitySheetFixture client component", async () => {
    const { VisualUtilitySheetFixture } = await import("@/app/dev/panels/utility-sheet/VisualUtilitySheetFixture");
    render(<VisualUtilitySheetFixture />);
    expect(screen.getByText("Result: spark-clock")).toBeInTheDocument();
  });

  it("invokes VisualUtilitySheetFixture sheet onOpenChange noop", async () => {
    const { VisualUtilitySheetFixture } = await import("@/app/dev/panels/utility-sheet/VisualUtilitySheetFixture");
    render(<VisualUtilitySheetFixture />);
    fireEvent.click(screen.getByRole("button", { name: "sheet-close" }));
  });
});

describe("dev route production guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("calls notFound for dev panels in production without mocks", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("USE_MOCKS", "0");
    const DevPanels = (await import("@/app/dev/panels/page")).default;
    await expect(DevPanels()).rejects.toThrow("NOT_FOUND");
  });

  it("calls notFound for dev UI gallery in production without mocks", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("USE_MOCKS", "0");
    const DevUi = (await import("@/app/dev/ui/page")).default;
    expect(() => DevUi()).toThrow("NOT_FOUND");
  });

  it("calls notFound for dev utility-sheet page in production without mocks", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("USE_MOCKS", "0");
    const Page = (await import("@/app/dev/panels/utility-sheet/page")).default;
    expect(() => Page()).toThrow("NOT_FOUND");
  });

  it("calls notFound for dev empty-dupes page in production without mocks", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("USE_MOCKS", "0");
    const Page = (await import("@/app/dev/panels/empty-dupes/page")).default;
    await expect(Page()).rejects.toThrow("NOT_FOUND");
  });
});
