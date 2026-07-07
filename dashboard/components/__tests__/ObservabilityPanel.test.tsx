import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ObservabilityPanel } from "@/components/ObservabilityPanel";
import { fakeMonitoringStackStatus } from "@/lib/mocks/fixtures";

const hostMocks = vi.hoisted(() => ({
  getMonitoringStackStatusAction: vi.fn()
}));

const toastMock = vi.fn();

vi.mock("@/actions/host-actions", () => hostMocks);

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock })
}));

describe("ObservabilityPanel", () => {
  const writeText = vi.fn();

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    Object.assign(navigator, { clipboard: { writeText } });
    hostMocks.getMonitoringStackStatusAction.mockResolvedValue(fakeMonitoringStackStatus);
  });

  it("renders observability panel with component rows", () => {
    render(<ObservabilityPanel initialStatus={fakeMonitoringStackStatus} />);
    expect(screen.getByTestId("observability-panel")).toBeInTheDocument();
    expect(screen.getByText("Grafana")).toBeInTheDocument();
    expect(screen.getByText("Prometheus")).toBeInTheDocument();
    expect(screen.getByText("Lab Overview")).toBeInTheDocument();
  });

  it("refresh updates status via server action", async () => {
    const refreshed = {
      ...fakeMonitoringStackStatus,
      grafana: { ...fakeMonitoringStackStatus.grafana, readyPods: 2, totalPods: 2 }
    };
    hostMocks.getMonitoringStackStatusAction.mockResolvedValue(refreshed);

    render(<ObservabilityPanel initialStatus={fakeMonitoringStackStatus} />);
    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));

    await waitFor(() => {
      expect(hostMocks.getMonitoringStackStatusAction).toHaveBeenCalled();
    });
    expect(screen.getAllByText("2/2 pods").length).toBeGreaterThan(0);
  });

  it("shows toast when refresh fails", async () => {
    hostMocks.getMonitoringStackStatusAction.mockRejectedValue(new Error("refresh failed"));

    render(<ObservabilityPanel initialStatus={fakeMonitoringStackStatus} />);
    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Observability status failed", variant: "error" })
      );
    });
  });

  it("copies Grafana URL", async () => {
    render(<ObservabilityPanel initialStatus={fakeMonitoringStackStatus} />);
    fireEvent.click(screen.getByRole("button", { name: /Copy URL/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(fakeMonitoringStackStatus.grafana.urls?.nodeport);
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Copied Grafana URL" }));
    });
  });

  it("toasts when copy fails", async () => {
    writeText.mockRejectedValue(new Error("clipboard denied"));
    render(<ObservabilityPanel initialStatus={fakeMonitoringStackStatus} />);
    fireEvent.click(screen.getByRole("button", { name: /Copy URL/i }));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Copy failed", variant: "error" }));
    });
  });

  it("renders starting and error service badges", () => {
    const mixed = {
      ...fakeMonitoringStackStatus,
      prometheus: { ...fakeMonitoringStackStatus.prometheus, state: "starting" as const },
      nodeExporter: { ...fakeMonitoringStackStatus.nodeExporter, state: "error" as const },
      headlamp: { ...fakeMonitoringStackStatus.headlamp, state: "stopped" as const }
    };
    render(<ObservabilityPanel initialStatus={mixed} />);
    expect(screen.getByText("starting")).toBeInTheDocument();
    expect(screen.getByText("error")).toBeInTheDocument();
    expect(screen.getByText("stopped")).toBeInTheDocument();
  });

  it("polls monitoring status on interval", async () => {
    vi.useFakeTimers();
    render(<ObservabilityPanel initialStatus={fakeMonitoringStackStatus} />);
    await vi.advanceTimersByTimeAsync(30000);
    expect(hostMocks.getMonitoringStackStatusAction).toHaveBeenCalled();
  });

  it("falls back to nodeport URLs when SSO is missing", () => {
    vi.stubEnv("TRUST_PROXY_AUTH", "1");
    const nodeportOnly = {
      ...fakeMonitoringStackStatus,
      grafana: {
        ...fakeMonitoringStackStatus.grafana,
        urls: { sso: "", nodeport: "http://localhost:32083" }
      },
      headlamp: {
        ...fakeMonitoringStackStatus.headlamp,
        urls: { sso: "", nodeport: "http://localhost:32084" }
      }
    };
    render(<ObservabilityPanel initialStatus={nodeportOnly} />);
    expect(screen.getByRole("link", { name: /Open Grafana/i })).toHaveAttribute("href", "http://localhost:32083");
    expect(screen.getByRole("link", { name: /Open Headlamp/i })).toHaveAttribute("href", "http://localhost:32084");
    vi.unstubAllEnvs();
  });

  it("falls back from empty nodeport to SSO URL", () => {
    const ssoOnly = {
      ...fakeMonitoringStackStatus,
      grafana: {
        ...fakeMonitoringStackStatus.grafana,
        urls: { sso: "https://grafana.sso", nodeport: "" }
      }
    };
    render(<ObservabilityPanel initialStatus={ssoOnly} />);
    expect(screen.getByRole("link", { name: /Open Grafana/i })).toHaveAttribute("href", "https://grafana.sso");
  });

  it("handles missing URL objects without crashing", () => {
    const noUrls = {
      ...fakeMonitoringStackStatus,
      grafana: { ...fakeMonitoringStackStatus.grafana, state: "stopped" as const, urls: undefined },
      headlamp: { ...fakeMonitoringStackStatus.headlamp, state: "stopped" as const, urls: undefined }
    };
    render(<ObservabilityPanel initialStatus={noUrls as typeof fakeMonitoringStackStatus} />);
    expect(screen.queryByRole("link", { name: /Open Grafana/i })).not.toBeInTheDocument();
  });

  it("prefers SSO URLs when TRUST_PROXY_AUTH is set", () => {
    vi.stubEnv("TRUST_PROXY_AUTH", "1");
    render(<ObservabilityPanel initialStatus={fakeMonitoringStackStatus} />);
    expect(screen.getByRole("link", { name: /Open Grafana/i })).toHaveAttribute(
      "href",
      fakeMonitoringStackStatus.grafana.urls?.sso
    );
    expect(screen.getByRole("link", { name: /Open Headlamp/i })).toHaveAttribute(
      "href",
      fakeMonitoringStackStatus.headlamp.urls?.sso
    );
    vi.unstubAllEnvs();
  });
});
