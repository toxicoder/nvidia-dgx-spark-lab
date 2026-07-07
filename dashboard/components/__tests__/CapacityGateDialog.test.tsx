import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { fakeFreeResourceSuggestions, fakeVisualCapacityCheck } from "@/lib/mocks/fixtures";

const hostMocks = vi.hoisted(() => ({
  suggestFreeResourcesAction: vi.fn(),
  stopDevWorkspaceAction: vi.fn(),
  stopInferenceWorkloadAction: vi.fn()
}));

vi.mock("@/actions/host-actions", () => hostMocks);

const toastMock = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock })
}));

import { CapacityGateDialog } from "../CapacityGateDialog";

describe("CapacityGateDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostMocks.suggestFreeResourcesAction.mockResolvedValue(fakeFreeResourceSuggestions);
    hostMocks.stopDevWorkspaceAction.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
    hostMocks.stopInferenceWorkloadAction.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("loads suggestions when opened with a capacity check", async () => {
    render(<CapacityGateDialog open onOpenChange={vi.fn()} check={fakeVisualCapacityCheck} onFreed={vi.fn()} />);

    expect(screen.getByText(/Insufficient resources/i)).toBeInTheDocument();
    expect(screen.getByText(/insufficient_gpu/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Stop Coder workspaces/i)).toBeInTheDocument();
    });
    expect(hostMocks.suggestFreeResourcesAction).toHaveBeenCalledWith("model:kimi");
  });

  it("shows empty state when no suggestions", async () => {
    hostMocks.suggestFreeResourcesAction.mockResolvedValue([]);

    render(<CapacityGateDialog open onOpenChange={vi.fn()} check={fakeVisualCapacityCheck} onFreed={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/No automatic suggestions/i)).toBeInTheDocument();
    });
  });

  it("applies a suggestion and calls onFreed on success", async () => {
    const onFreed = vi.fn();

    render(<CapacityGateDialog open onOpenChange={vi.fn()} check={fakeVisualCapacityCheck} onFreed={onFreed} />);

    await waitFor(() => screen.getByText(/Stop Coder workspaces/i));
    fireEvent.click(screen.getByRole("button", { name: /Apply/i }));

    await waitFor(() => {
      expect(hostMocks.stopDevWorkspaceAction).toHaveBeenCalledWith("coder");
      expect(onFreed).toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Resources freed", variant: "success" }));
    });
  });

  it("applies kasm stop suggestion", async () => {
    hostMocks.suggestFreeResourcesAction.mockResolvedValue([
      {
        id: "stop-kasm",
        label: "Stop Kasm workspaces",
        action: "dev:kasm",
        reversible: true,
        impact: "Frees desktops",
        applicable: true,
        frees: { cpu: "2", memory: "4Gi", gpus: 0 }
      }
    ]);

    render(<CapacityGateDialog open onOpenChange={vi.fn()} check={fakeVisualCapacityCheck} onFreed={vi.fn()} />);

    await waitFor(() => screen.getByText(/Stop Kasm workspaces/i));
    fireEvent.click(screen.getByRole("button", { name: /Apply/i }));
    await waitFor(() => {
      expect(hostMocks.stopDevWorkspaceAction).toHaveBeenCalledWith("kasm");
    });
  });

  it("applies stop-job suggestion", async () => {
    hostMocks.suggestFreeResourcesAction.mockResolvedValue([
      {
        id: "stop-jobs",
        label: "Stop inference jobs",
        action: "stop-job:kimi-test,ray-head",
        reversible: true,
        impact: "Stops jobs",
        applicable: true,
        frees: { cpu: "8", memory: "32Gi", gpus: 1 }
      }
    ]);

    render(<CapacityGateDialog open onOpenChange={vi.fn()} check={fakeVisualCapacityCheck} onFreed={vi.fn()} />);

    await waitFor(() => screen.getByText(/Stop inference jobs/i));
    fireEvent.click(screen.getByRole("button", { name: /Apply/i }));
    await waitFor(() => {
      expect(hostMocks.stopInferenceWorkloadAction).toHaveBeenCalledWith("kimi-test");
      expect(hostMocks.stopInferenceWorkloadAction).toHaveBeenCalledWith("ray-head");
    });
  });

  it("applies stop-inference suggestion", async () => {
    hostMocks.suggestFreeResourcesAction.mockResolvedValue([
      {
        id: "stop-all",
        label: "Stop all inference",
        action: "stop-inference",
        reversible: true,
        impact: "Stops all",
        applicable: true,
        frees: { cpu: "16", memory: "64Gi", gpus: 2 }
      }
    ]);

    render(<CapacityGateDialog open onOpenChange={vi.fn()} check={fakeVisualCapacityCheck} onFreed={vi.fn()} />);

    await waitFor(() => screen.getByText(/Stop all inference/i));
    fireEvent.click(screen.getByRole("button", { name: /Apply/i }));
    await waitFor(() => {
      expect(hostMocks.stopInferenceWorkloadAction).toHaveBeenCalledWith("all");
    });
  });

  it("returns false for unknown suggestion action", async () => {
    hostMocks.suggestFreeResourcesAction.mockResolvedValue([
      {
        id: "noop",
        label: "Unknown action",
        action: "unknown:thing",
        reversible: false,
        impact: "none",
        applicable: false,
        frees: { cpu: "0", memory: "0Gi", gpus: 0 }
      }
    ]);

    const onFreed = vi.fn();
    render(<CapacityGateDialog open onOpenChange={vi.fn()} check={fakeVisualCapacityCheck} onFreed={onFreed} />);

    await waitFor(() => screen.getByText(/Unknown action/i));
    fireEvent.click(screen.getByRole("button", { name: /Apply/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Could not free resources", variant: "error" })
      );
    });
    expect(onFreed).not.toHaveBeenCalled();
  });

  it("closes dialog via footer button", async () => {
    const onOpenChange = vi.fn();
    render(<CapacityGateDialog open onOpenChange={onOpenChange} check={fakeVisualCapacityCheck} onFreed={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Close/i })[0]!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("handles stop-job action with empty job list segment", async () => {
    hostMocks.suggestFreeResourcesAction.mockResolvedValue([
      {
        id: "stop-empty",
        label: "Stop nothing",
        action: "stop-job:",
        reversible: false,
        impact: "none",
        applicable: true,
        frees: { cpu: "0", memory: "0Gi", gpus: 0 }
      }
    ]);
    const onFreed = vi.fn();
    render(<CapacityGateDialog open onOpenChange={vi.fn()} check={fakeVisualCapacityCheck} onFreed={onFreed} />);
    await waitFor(() => screen.getByText(/Stop nothing/i));
    fireEvent.click(screen.getByRole("button", { name: /Apply/i }));
    await waitFor(() => expect(onFreed).toHaveBeenCalled());
  });

  it("stops applying stop-job suggestions when a job fails", async () => {
    hostMocks.suggestFreeResourcesAction.mockResolvedValue([
      {
        id: "stop-jobs",
        label: "Stop inference jobs",
        action: "stop-job:kimi-test,ray-head",
        reversible: true,
        impact: "Stops jobs",
        applicable: true,
        frees: { cpu: "8", memory: "32Gi", gpus: 1 }
      }
    ]);
    hostMocks.stopInferenceWorkloadAction
      .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "busy" });

    const onFreed = vi.fn();
    render(<CapacityGateDialog open onOpenChange={vi.fn()} check={fakeVisualCapacityCheck} onFreed={onFreed} />);

    await waitFor(() => screen.getByText(/Stop inference jobs/i));
    fireEvent.click(screen.getByRole("button", { name: /Apply/i }));

    await waitFor(() => {
      expect(hostMocks.stopInferenceWorkloadAction).toHaveBeenCalledTimes(2);
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Could not free resources", variant: "error" })
      );
    });
    expect(onFreed).not.toHaveBeenCalled();
  });

  it("toasts error when apply fails", async () => {
    hostMocks.stopDevWorkspaceAction.mockResolvedValue({ exitCode: 1, stdout: "", stderr: "fail" });

    render(<CapacityGateDialog open onOpenChange={vi.fn()} check={fakeVisualCapacityCheck} onFreed={vi.fn()} />);

    await waitFor(() => screen.getByText(/Stop Coder workspaces/i));
    fireEvent.click(screen.getByRole("button", { name: /Apply/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Could not free resources", variant: "error" })
      );
    });
  });
});
