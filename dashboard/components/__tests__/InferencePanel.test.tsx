import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { fakeCapacityCheck, fakeInferenceWorkloadsStatus } from "@/lib/mocks/fixtures";

const hostMocks = vi.hoisted(() => ({
  getInferenceWorkloadsAction: vi.fn(),
  checkCapacityAction: vi.fn(),
  startInferenceWorkloadAction: vi.fn(),
  stopInferenceWorkloadAction: vi.fn(),
  suggestFreeResourcesAction: vi.fn(),
  stopDevWorkspaceAction: vi.fn()
}));

vi.mock("@/actions/host-actions", () => hostMocks);

const toastMock = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock })
}));

import { InferencePanel } from "../InferencePanel";

describe("InferencePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostMocks.getInferenceWorkloadsAction.mockResolvedValue(fakeInferenceWorkloadsStatus);
    hostMocks.checkCapacityAction.mockResolvedValue(fakeCapacityCheck);
    hostMocks.startInferenceWorkloadAction.mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "" });
    hostMocks.stopInferenceWorkloadAction.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
    hostMocks.suggestFreeResourcesAction.mockResolvedValue([]);
    hostMocks.stopDevWorkspaceAction.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("renders workloads and quick-start buttons", () => {
    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);

    expect(screen.getByTestId("inference-panel")).toBeInTheDocument();
    expect(screen.getByText(/Inference.*visual workloads/i)).toBeInTheDocument();
    expect(screen.getAllByText("kimi-test").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /kimi-test/i }).length).toBeGreaterThan(0);
  });

  it("starts a light model when capacity is ok", async () => {
    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);

    fireEvent.click(screen.getByRole("button", { name: /^kimi-test$/i }));

    await waitFor(() => {
      expect(hostMocks.checkCapacityAction).toHaveBeenCalledWith("model:kimi-test");
      expect(hostMocks.startInferenceWorkloadAction).toHaveBeenCalledWith("kimi-test", "yes");
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Workload submitted", variant: "success" })
      );
    });
  });

  it("opens capacity gate when check fails", async () => {
    hostMocks.checkCapacityAction.mockResolvedValue({
      ...fakeCapacityCheck,
      ok: false,
      verdict: "insufficient_gpu"
    });

    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);
    fireEvent.click(screen.getByRole("button", { name: /^kimi-test$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Insufficient resources/i)).toBeInTheDocument();
    });
    expect(hostMocks.startInferenceWorkloadAction).not.toHaveBeenCalled();
  });

  it("opens heavy confirm for large models", async () => {
    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);

    fireEvent.click(screen.getByRole("button", { name: /kimi \(full\)/i }));

    await waitFor(() => {
      expect(screen.getByText(/Heavy workload confirmation/i)).toBeInTheDocument();
    });
    expect(hostMocks.startInferenceWorkloadAction).not.toHaveBeenCalled();
  });

  it("stops a running job", async () => {
    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);

    const runningBadge = screen.getByText("running");
    const runningRow = runningBadge.closest("div")?.parentElement?.parentElement;
    const rowButtons = runningRow?.querySelectorAll("button") ?? [];
    fireEvent.click(rowButtons[rowButtons.length - 1]!);

    await waitFor(() => {
      expect(hostMocks.stopInferenceWorkloadAction).toHaveBeenCalledWith("kimi-test");
    });
  });

  it("shows status error banner", () => {
    render(<InferencePanel initialStatus={{ ...fakeInferenceWorkloadsStatus, error: "kubectl unreachable" }} />);
    expect(screen.getByText(/kubectl unreachable/)).toBeInTheDocument();
  });

  it("shows succeeded and failed job badges", () => {
    render(
      <InferencePanel
        initialStatus={{
          namespace: "ai-inference",
          jobs: [
            { model: "kimi-test", job: "kimi-test", active: 0, state: "succeeded" },
            { model: "kimi", job: "kimi", active: 0, state: "failed" },
            { model: "ray-head", job: "ray-head", active: 0, state: "absent" }
          ]
        }}
      />
    );
    expect(screen.getByText("succeeded")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("stopped")).toBeInTheDocument();
  });

  it("starts heavy model after confirmation", async () => {
    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);
    fireEvent.click(screen.getByRole("button", { name: /kimi \(full\)/i }));
    await waitFor(() => screen.getByPlaceholderText("yes"));
    fireEvent.change(screen.getByPlaceholderText("yes"), { target: { value: "yes" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm start/i }));

    await waitFor(() => {
      expect(hostMocks.startInferenceWorkloadAction).toHaveBeenCalledWith("kimi", "yes");
    });
  });

  it("opens heavy confirm after capacity gate freed for heavy model", async () => {
    hostMocks.checkCapacityAction
      .mockResolvedValueOnce({ ...fakeCapacityCheck, ok: false, verdict: "insufficient_gpu" })
      .mockResolvedValueOnce(fakeCapacityCheck);
    hostMocks.suggestFreeResourcesAction.mockResolvedValue([
      {
        id: "stop-coder",
        label: "Stop Coder workspaces",
        action: "dev:coder",
        reversible: true,
        impact: "Frees CPU",
        applicable: true,
        frees: { cpu: "2", memory: "4Gi", gpus: 0 }
      }
    ]);

    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);
    fireEvent.click(screen.getByRole("button", { name: /kimi \(full\)/i }));
    await waitFor(() => screen.getByText(/Stop Coder workspaces/i));
    fireEvent.click(screen.getAllByRole("button", { name: /Apply/i })[0]!);

    await waitFor(() => {
      expect(screen.getByText(/Heavy workload confirmation/i)).toBeInTheDocument();
    });
  });

  it("retries start after capacity gate freed", async () => {
    hostMocks.checkCapacityAction
      .mockResolvedValueOnce({ ...fakeCapacityCheck, ok: false, verdict: "insufficient_gpu" })
      .mockResolvedValueOnce(fakeCapacityCheck);
    hostMocks.suggestFreeResourcesAction.mockResolvedValue([
      {
        id: "stop-coder",
        label: "Stop Coder workspaces",
        action: "dev:coder",
        reversible: true,
        impact: "Frees CPU",
        applicable: true,
        frees: { cpu: "2", memory: "4Gi", gpus: 0 }
      }
    ]);

    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);
    fireEvent.click(screen.getByRole("button", { name: /^kimi-test$/i }));
    await waitFor(() => screen.getByText(/Stop Coder workspaces/i));
    fireEvent.click(screen.getAllByRole("button", { name: /Apply/i })[0]!);

    await waitFor(() => {
      expect(hostMocks.startInferenceWorkloadAction).toHaveBeenCalledWith("kimi-test", "yes");
    });
  });

  it("toasts refresh failure from polling", async () => {
    vi.useFakeTimers();
    hostMocks.getInferenceWorkloadsAction.mockRejectedValue(new Error("api down"));
    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);
    await vi.advanceTimersByTimeAsync(10000);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Inference status failed", variant: "error" })
    );
    vi.useRealTimers();
  });

  it("toasts error when stop fails", async () => {
    hostMocks.stopInferenceWorkloadAction.mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "stop rejected"
    });
    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);
    const runningBadge = screen.getByText("running");
    const runningRow = runningBadge.closest("div")?.parentElement?.parentElement;
    const rowButtons = runningRow?.querySelectorAll("button") ?? [];
    fireEvent.click(rowButtons[rowButtons.length - 1]!);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Stop failed", variant: "error" }));
    });
  });

  it("starts workload from job row play button", async () => {
    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);
    const kimiLabel = screen
      .getAllByText("kimi")
      .find((el) => el.classList.contains("font-medium") && el.closest("[data-testid='inference-panel']"));
    const kimiRow = kimiLabel?.closest(".border-border");
    expect(kimiRow).toBeTruthy();
    fireEvent.click(kimiRow!.querySelector("button")!);

    await waitFor(() => {
      expect(hostMocks.checkCapacityAction).toHaveBeenCalledWith("model:kimi");
      expect(screen.getByText(/Heavy workload confirmation/i)).toBeInTheDocument();
    });
  });

  it("shows busy spinner while workload start is in flight", async () => {
    let resolveStart!: (v: unknown) => void;
    hostMocks.startInferenceWorkloadAction.mockReturnValue(
      new Promise((r) => {
        resolveStart = r;
      })
    );

    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);
    fireEvent.click(screen.getByRole("button", { name: /^kimi-test$/i }));

    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).toBeTruthy();
    });
    resolveStart({ exitCode: 0, stdout: "ok", stderr: "" });
  });

  it("shows busy spinner on stop button for running job", async () => {
    let resolveStop!: (v: unknown) => void;
    hostMocks.stopInferenceWorkloadAction.mockReturnValue(
      new Promise((r) => {
        resolveStop = r;
      })
    );

    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);
    const runningBadge = screen.getByText("running");
    const runningRow = runningBadge.closest("div")?.parentElement?.parentElement;
    const rowButtons = runningRow?.querySelectorAll("button") ?? [];
    fireEvent.click(rowButtons[rowButtons.length - 1]!);

    await waitFor(() => {
      expect(runningRow!.querySelector(".animate-spin")).toBeTruthy();
    });
    resolveStop({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("hides start button for jobs that are not startable models", () => {
    render(
      <InferencePanel
        initialStatus={{
          namespace: "ai-inference",
          jobs: [{ model: "custom-model", job: "custom-model", active: 0, state: "absent" }]
        }}
      />
    );
    const row = screen.getByText("custom-model").closest(".border-border");
    expect(row?.querySelector("button")).toBeNull();
  });

  it("shows active pod count for running jobs", () => {
    render(
      <InferencePanel
        initialStatus={{
          ...fakeInferenceWorkloadsStatus,
          jobs: fakeInferenceWorkloadsStatus.jobs.map((j) => (j.state === "running" ? { ...j, active: 2 } : j))
        }}
      />
    );
    expect(screen.getByText(/2 active pod\(s\)/)).toBeInTheDocument();
  });

  it("shows error toast when start fails", async () => {
    hostMocks.startInferenceWorkloadAction.mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "job rejected"
    });

    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);
    fireEvent.click(screen.getByRole("button", { name: /^kimi-test$/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Start failed", variant: "error" }));
    });
  });

  it("uses stdout when start fails without stderr", async () => {
    hostMocks.startInferenceWorkloadAction.mockResolvedValue({
      exitCode: 1,
      stdout: "stdout only",
      stderr: ""
    });

    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);
    fireEvent.click(screen.getByRole("button", { name: /^kimi-test$/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Start failed", description: "stdout only" })
      );
    });
  });

  it("uses stdout when stop fails without stderr", async () => {
    hostMocks.stopInferenceWorkloadAction.mockResolvedValue({
      exitCode: 1,
      stdout: "stop stdout",
      stderr: ""
    });

    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);
    const runningBadge = screen.getByText("running");
    const runningRow = runningBadge.closest("div")?.parentElement?.parentElement;
    const rowButtons = runningRow?.querySelectorAll("button") ?? [];
    fireEvent.click(rowButtons[rowButtons.length - 1]!);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Stop failed", description: "stop stdout" })
      );
    });
  });

  it("keeps gate open when recheck still fails after freeing resources", async () => {
    hostMocks.checkCapacityAction
      .mockResolvedValueOnce({ ...fakeCapacityCheck, ok: false, verdict: "insufficient_gpu" })
      .mockResolvedValueOnce({ ...fakeCapacityCheck, ok: false, verdict: "still_insufficient" });
    hostMocks.suggestFreeResourcesAction.mockResolvedValue([
      {
        id: "stop-coder",
        label: "Stop Coder workspaces",
        action: "dev:coder",
        reversible: true,
        impact: "Frees CPU",
        applicable: true,
        frees: { cpu: "2", memory: "4Gi", gpus: 0 }
      }
    ]);

    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);
    fireEvent.click(screen.getByRole("button", { name: /^kimi-test$/i }));
    await waitFor(() => screen.getByText(/Stop Coder workspaces/i));
    fireEvent.click(screen.getAllByRole("button", { name: /Apply/i })[0]!);

    await waitFor(() => {
      expect(hostMocks.checkCapacityAction).toHaveBeenCalledTimes(2);
    });
    expect(hostMocks.startInferenceWorkloadAction).not.toHaveBeenCalled();
    expect(screen.getByText(/Insufficient resources/i)).toBeInTheDocument();
  });
});
