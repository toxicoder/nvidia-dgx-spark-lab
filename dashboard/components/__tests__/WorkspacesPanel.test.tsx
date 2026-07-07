import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorkspacesPanel } from "../WorkspacesPanel";
import { fakeDevWorkspacesStatus } from "@/lib/mocks/fixtures";

vi.mock("@/actions/host-actions", () => ({
  getDevWorkspacesStatusAction: vi.fn(),
  startDevWorkspaceAction: vi.fn(),
  stopDevWorkspaceAction: vi.fn()
}));

import { getDevWorkspacesStatusAction, startDevWorkspaceAction, stopDevWorkspaceAction } from "@/actions/host-actions";

const toastMock = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock })
}));

describe("WorkspacesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDevWorkspacesStatusAction).mockResolvedValue(fakeDevWorkspacesStatus);
    vi.mocked(startDevWorkspaceAction).mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 });
    vi.mocked(stopDevWorkspaceAction).mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders coder and kasm tabs with initial status", () => {
    render(<WorkspacesPanel initialStatus={fakeDevWorkspacesStatus} />);
    expect(screen.getByTestId("workspaces-panel")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Coder/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Kasm/i })).toBeInTheDocument();
    expect(screen.getByTestId("dev-workspace-coder")).toBeInTheDocument();
  });

  it("shows status error banner", () => {
    render(<WorkspacesPanel initialStatus={{ ...fakeDevWorkspacesStatus, error: "kubectl unreachable" }} />);
    expect(screen.getByText(/kubectl unreachable/)).toBeInTheDocument();
  });

  it("shows running embed for coder and empty state on kasm tab", () => {
    render(<WorkspacesPanel initialStatus={fakeDevWorkspacesStatus} />);
    expect(screen.getByTestId("workspace-embed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Kasm/i }));
    expect(screen.getByTestId("workspace-empty-kasm")).toBeInTheDocument();
  });

  it("starts workspace when switch turned on", async () => {
    const stoppedStatus = {
      ...fakeDevWorkspacesStatus,
      kasm: { ...fakeDevWorkspacesStatus.kasm, state: "stopped" as const }
    };
    render(<WorkspacesPanel initialStatus={stoppedStatus} />);
    fireEvent.click(screen.getByRole("tab", { name: /Kasm/i }));

    fireEvent.click(screen.getByRole("switch", { name: /Toggle Kasm/i }));

    await waitFor(() => {
      expect(startDevWorkspaceAction).toHaveBeenCalledWith("kasm");
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Workspace starting", variant: "success" })
      );
    });
  });

  it("confirms before stopping a running workspace", async () => {
    render(<WorkspacesPanel initialStatus={fakeDevWorkspacesStatus} />);
    fireEvent.click(screen.getByRole("switch", { name: /Toggle Coder/i }));

    expect(screen.getByText(/Stop Coder/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Stop$/i }));

    await waitFor(() => {
      expect(stopDevWorkspaceAction).toHaveBeenCalledWith("coder");
    });
  });

  it("uses stdout when start fails without stderr", async () => {
    vi.mocked(startDevWorkspaceAction).mockResolvedValue({
      stdout: "stdout only",
      stderr: "",
      exitCode: 2
    });

    const stoppedStatus = {
      ...fakeDevWorkspacesStatus,
      kasm: { ...fakeDevWorkspacesStatus.kasm, state: "stopped" as const }
    };
    render(<WorkspacesPanel initialStatus={stoppedStatus} />);
    fireEvent.click(screen.getByRole("tab", { name: /Kasm/i }));
    fireEvent.click(screen.getByRole("switch", { name: /Toggle Kasm/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Start failed", description: "stdout only" })
      );
    });
  });

  it("uses exit code when stop fails without stderr or stdout", async () => {
    vi.mocked(stopDevWorkspaceAction).mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 7
    });

    render(<WorkspacesPanel initialStatus={fakeDevWorkspacesStatus} />);
    fireEvent.click(screen.getByRole("switch", { name: /Toggle Coder/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Stop$/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Stop failed", description: "exit 7" }));
    });
  });

  it("uses stdout and exit code when stop fails without stderr", async () => {
    vi.mocked(stopDevWorkspaceAction).mockResolvedValue({
      stdout: "stop stdout",
      stderr: "",
      exitCode: 3
    });

    render(<WorkspacesPanel initialStatus={fakeDevWorkspacesStatus} />);
    fireEvent.click(screen.getByRole("switch", { name: /Toggle Coder/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Stop$/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Stop failed", description: "stop stdout" })
      );
    });
  });

  it("toasts failure when start returns non-zero exit", async () => {
    vi.mocked(startDevWorkspaceAction).mockResolvedValue({
      stdout: "",
      stderr: "helm error",
      exitCode: 1
    });

    const stoppedStatus = {
      ...fakeDevWorkspacesStatus,
      kasm: { ...fakeDevWorkspacesStatus.kasm, state: "stopped" as const }
    };
    render(<WorkspacesPanel initialStatus={stoppedStatus} />);
    fireEvent.click(screen.getByRole("tab", { name: /Kasm/i }));
    fireEvent.click(screen.getByRole("switch", { name: /Toggle Kasm/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Start failed", description: "helm error" })
      );
    });
  });

  it("toasts exception from workspace action", async () => {
    vi.mocked(startDevWorkspaceAction).mockRejectedValue(new Error("network"));
    const stoppedStatus = {
      ...fakeDevWorkspacesStatus,
      kasm: { ...fakeDevWorkspacesStatus.kasm, state: "stopped" as const }
    };
    render(<WorkspacesPanel initialStatus={stoppedStatus} />);
    fireEvent.click(screen.getByRole("tab", { name: /Kasm/i }));
    fireEvent.click(screen.getByRole("switch", { name: /Toggle Kasm/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Workspace action failed", variant: "error" })
      );
    });
  });

  it("clears pending when start ends in stopped state", async () => {
    vi.useFakeTimers();
    vi.mocked(getDevWorkspacesStatusAction).mockResolvedValue({
      ...fakeDevWorkspacesStatus,
      kasm: { ...fakeDevWorkspacesStatus.kasm, state: "stopped" as const }
    });
    const startingStatus = {
      ...fakeDevWorkspacesStatus,
      kasm: { ...fakeDevWorkspacesStatus.kasm, state: "starting" as const }
    };
    render(<WorkspacesPanel initialStatus={startingStatus} />);
    await vi.advanceTimersByTimeAsync(5000);
    expect(getDevWorkspacesStatusAction).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("clears pending state when workspace reaches target state", async () => {
    vi.useFakeTimers();
    const startingStatus = {
      ...fakeDevWorkspacesStatus,
      kasm: { ...fakeDevWorkspacesStatus.kasm, state: "stopped" as const }
    };
    vi.mocked(startDevWorkspaceAction).mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 });
    vi.mocked(getDevWorkspacesStatusAction).mockResolvedValue({
      ...fakeDevWorkspacesStatus,
      kasm: { ...fakeDevWorkspacesStatus.kasm, state: "running" as const }
    });

    render(<WorkspacesPanel initialStatus={startingStatus} />);
    fireEvent.click(screen.getByRole("tab", { name: /Kasm/i }));
    fireEvent.click(screen.getByRole("switch", { name: /Toggle Kasm/i }));

    await vi.advanceTimersByTimeAsync(5000);
    expect(getDevWorkspacesStatusAction).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("polls status while workspace is transitional", async () => {
    vi.useFakeTimers();
    const startingStatus = {
      ...fakeDevWorkspacesStatus,
      kasm: { ...fakeDevWorkspacesStatus.kasm, state: "starting" as const }
    };
    vi.mocked(getDevWorkspacesStatusAction).mockResolvedValue({
      ...fakeDevWorkspacesStatus,
      kasm: { ...fakeDevWorkspacesStatus.kasm, state: "running" as const }
    });

    render(<WorkspacesPanel initialStatus={startingStatus} />);
    await vi.advanceTimersByTimeAsync(5000);

    expect(getDevWorkspacesStatusAction).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("clears pending when stop completes to stopped state", async () => {
    vi.useFakeTimers();
    vi.mocked(getDevWorkspacesStatusAction).mockResolvedValue({
      ...fakeDevWorkspacesStatus,
      coder: { ...fakeDevWorkspacesStatus.coder, state: "stopped" as const }
    });

    render(<WorkspacesPanel initialStatus={fakeDevWorkspacesStatus} />);
    fireEvent.click(screen.getByRole("switch", { name: /Toggle Coder/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Stop$/i }));
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(getDevWorkspacesStatusAction).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("clears pending when start ends in stopped state via poll", async () => {
    vi.useFakeTimers();
    const stoppedStatus = {
      ...fakeDevWorkspacesStatus,
      kasm: { ...fakeDevWorkspacesStatus.kasm, state: "stopped" as const }
    };
    vi.mocked(getDevWorkspacesStatusAction).mockResolvedValue(stoppedStatus);

    render(<WorkspacesPanel initialStatus={stoppedStatus} />);
    fireEvent.click(screen.getByRole("tab", { name: /Kasm/i }));
    fireEvent.click(screen.getByRole("switch", { name: /Toggle Kasm/i }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(getDevWorkspacesStatusAction).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("toasts refresh failure during transitional polling", async () => {
    vi.useFakeTimers();
    vi.mocked(getDevWorkspacesStatusAction).mockRejectedValue(new Error("api down"));
    const startingStatus = {
      ...fakeDevWorkspacesStatus,
      coder: { ...fakeDevWorkspacesStatus.coder, state: "starting" as const }
    };

    render(<WorkspacesPanel initialStatus={startingStatus} />);
    await vi.advanceTimersByTimeAsync(5000);

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Status refresh failed", variant: "error" })
    );
    vi.useRealTimers();
  });
});
