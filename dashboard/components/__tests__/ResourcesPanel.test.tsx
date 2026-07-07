import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ResourcesPanel } from "../ResourcesPanel";
import { fakeClusterCapacity, fakeMonitoringStackStatus } from "@/lib/mocks/fixtures";

const getClusterCapacityAction = vi.fn();
const toastMock = vi.fn();

vi.mock("@/actions/host-actions", () => ({
  getClusterCapacityAction: (...args: unknown[]) => getClusterCapacityAction(...args)
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock })
}));

describe("ResourcesPanel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getClusterCapacityAction.mockResolvedValue(fakeClusterCapacity);
  });

  it("renders capacity metrics", () => {
    render(<ResourcesPanel initialCapacity={fakeClusterCapacity} />);
    expect(screen.getByText(/Cluster capacity/)).toBeInTheDocument();
    expect(screen.getByText(/GPUs/)).toBeInTheDocument();
    expect(screen.getByText("0% used")).toBeInTheDocument();
    expect(screen.getByText(/available of 2 allocatable/)).toBeInTheDocument();
  });

  it("shows warning and critical utilization badges", () => {
    const warnCapacity = {
      ...fakeClusterCapacity,
      utilization: { gpu_pct: 80, cpu_pct: 80, memory_pct: 80 }
    };
    const { unmount } = render(<ResourcesPanel initialCapacity={warnCapacity} />);
    expect(screen.getAllByText(/80% used/).length).toBeGreaterThan(0);
    unmount();

    const criticalCapacity = {
      ...fakeClusterCapacity,
      utilization: { gpu_pct: 95, cpu_pct: 95, memory_pct: 95 }
    };
    render(<ResourcesPanel initialCapacity={criticalCapacity} />);
    expect(screen.getAllByText(/95% used/).length).toBeGreaterThan(0);
  });

  it("shows singular node label", () => {
    render(<ResourcesPanel initialCapacity={{ ...fakeClusterCapacity, node_count: 1 }} />);
    expect(screen.getByText(/1 node\)/)).toBeInTheDocument();
  });

  it("shows error state", () => {
    render(<ResourcesPanel initialCapacity={{ ...fakeClusterCapacity, error: "kubectl unreachable" }} />);
    expect(screen.getByText(/kubectl unreachable/)).toBeInTheDocument();
  });

  it("refreshes capacity on button click", async () => {
    const updated = { ...fakeClusterCapacity, available: { ...fakeClusterCapacity.available, gpus: 1 } };
    getClusterCapacityAction.mockResolvedValue(updated);

    render(<ResourcesPanel initialCapacity={fakeClusterCapacity} />);
    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));

    await waitFor(() => {
      expect(getClusterCapacityAction).toHaveBeenCalled();
    });
  });

  it("polls capacity on interval", async () => {
    vi.useFakeTimers();
    render(<ResourcesPanel initialCapacity={fakeClusterCapacity} />);
    await vi.advanceTimersByTimeAsync(30000);
    expect(getClusterCapacityAction).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("shows Grafana deep links when utilization is high", () => {
    const warnCapacity = {
      ...fakeClusterCapacity,
      utilization: { gpu_pct: 80, cpu_pct: 10, memory_pct: 10 }
    };
    render(<ResourcesPanel initialCapacity={warnCapacity} monitoringStatus={fakeMonitoringStackStatus} />);
    expect(screen.getByText(/Utilization above 75%/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Lab Overview/i })).toBeInTheDocument();
  });

  it("toasts refresh failure", async () => {
    getClusterCapacityAction.mockRejectedValue(new Error("timeout"));
    render(<ResourcesPanel initialCapacity={fakeClusterCapacity} />);
    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Capacity refresh failed", variant: "error" })
      );
    });
  });
});
