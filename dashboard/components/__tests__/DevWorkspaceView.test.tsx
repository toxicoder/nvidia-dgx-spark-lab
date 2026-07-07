import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DevWorkspaceView } from "../DevWorkspaceView";
import type { DevWorkspaceInfo } from "@/lib/types";

describe("DevWorkspaceView", () => {
  const onToggle = vi.fn();

  const baseWorkspace: DevWorkspaceInfo = {
    name: "coder",
    state: "stopped",
    readyPods: 0,
    totalPods: 0,
    url: "http://localhost:32080",
    helmInstalled: false
  };

  it("renders stopped empty state", () => {
    render(<DevWorkspaceView workspace={baseWorkspace} busy={false} onToggle={onToggle} />);
    expect(screen.getByTestId("workspace-empty-coder")).toBeInTheDocument();
    expect(screen.getByText(/Coder is stopped/)).toBeInTheDocument();
  });

  it("starts workspace when switch turned on", () => {
    render(<DevWorkspaceView workspace={baseWorkspace} busy={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch", { name: /Toggle Coder/i }));
    expect(onToggle).toHaveBeenCalledWith("coder", true);
  });

  it("confirms before stopping running workspace", async () => {
    render(
      <DevWorkspaceView
        workspace={{ ...baseWorkspace, state: "running", readyPods: 1, totalPods: 1 }}
        busy={false}
        onToggle={onToggle}
      />
    );

    fireEvent.click(screen.getByRole("switch", { name: /Toggle Coder/i }));
    expect(screen.getByText(/Stop Coder\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Stop$/i }));

    await waitFor(() => {
      expect(onToggle).toHaveBeenCalledWith("coder", false);
    });
  });

  it("renders starting and stopping transitional states", () => {
    const { rerender } = render(
      <DevWorkspaceView workspace={baseWorkspace} pendingState="starting" busy={false} onToggle={onToggle} />
    );
    expect(screen.getByText(/Deploying Helm release/)).toBeInTheDocument();

    rerender(<DevWorkspaceView workspace={baseWorkspace} pendingState="stopping" busy={false} onToggle={onToggle} />);
    expect(screen.getByText(/Stopping workspace/)).toBeInTheDocument();
  });

  it("renders running embed", () => {
    render(
      <DevWorkspaceView
        workspace={{ ...baseWorkspace, state: "running", readyPods: 1, totalPods: 1 }}
        busy={false}
        onToggle={onToggle}
      />
    );
    expect(screen.getByTestId("workspace-embed")).toBeInTheDocument();
  });

  it("shows error badge variant", () => {
    render(<DevWorkspaceView workspace={{ ...baseWorkspace, state: "error" }} busy={false} onToggle={onToggle} />);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("renders kasm workspace labels and hints", () => {
    render(
      <DevWorkspaceView
        workspace={{ ...baseWorkspace, name: "kasm", url: "http://localhost:32081" }}
        busy={false}
        onToggle={onToggle}
      />
    );
    expect(screen.getByTestId("dev-workspace-kasm")).toBeInTheDocument();
    expect(screen.getByText(/Streamed desktops/)).toBeInTheDocument();
  });

  it("disables switch while busy", () => {
    render(<DevWorkspaceView workspace={baseWorkspace} busy pendingState={null} onToggle={onToggle} />);
    expect(screen.getByRole("switch", { name: /Toggle Coder/i })).toBeDisabled();
  });
});
