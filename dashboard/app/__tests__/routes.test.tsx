import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

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
  });

  it("renders main dashboard page with mocked host data", async () => {
    const DashboardPage = (await import("@/app/(dashboard)/page")).default;
    const jsx = await DashboardPage();
    render(jsx);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getAllByText("Resource Guard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Secrets Vault").length).toBeGreaterThan(0);
  });

  it("handles non-array container list on dashboard page", async () => {
    vi.resetModules();
    vi.doMock("@/lib/host", async () => {
      const actual = await vi.importActual<typeof import("@/lib/host")>("@/lib/host");
      return { ...actual, listContainers: async () => null as never };
    });
    const DashboardPage = (await import("@/app/(dashboard)/page")).default;
    const jsx = await DashboardPage();
    render(jsx);
    expect(screen.getByText(/0 containers running/)).toBeInTheDocument();
    vi.doUnmock("@/lib/host");
    vi.resetModules();
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
