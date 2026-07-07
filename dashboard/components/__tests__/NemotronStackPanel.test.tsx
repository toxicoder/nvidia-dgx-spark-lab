import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NemotronStackPanel } from "@/components/NemotronStackPanel";
import { fakeClusterCapacity, fakeNemotronCatalog, fakeNemotronStackStatus } from "@/lib/mocks/fixtures";

const hostMocks = vi.hoisted(() => ({
  checkCapacityAction: vi.fn(),
  getNemotronStackStatusAction: vi.fn(),
  startNemotronStackAction: vi.fn(),
  stopNemotronStackAction: vi.fn(),
  suggestFreeResourcesAction: vi.fn(),
  stopDevWorkspaceAction: vi.fn()
}));

const toastMock = vi.fn();

vi.mock("@/actions/host-actions", () => hostMocks);

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock })
}));

describe("NemotronStackPanel", () => {
  const writeText = vi.fn();

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, { clipboard: { writeText } });
    hostMocks.checkCapacityAction.mockResolvedValue({
      ok: true,
      verdict: "ok",
      action: "stack:nemotron-agentic-spark-1",
      heavy: true,
      required: { gpus: 1, cpu: "16", memory: "59Gi" },
      available: { gpus: 2, cpu: "17.7", memory: "0Gi" },
      deficit: {}
    });
    hostMocks.getNemotronStackStatusAction.mockResolvedValue(fakeNemotronStackStatus);
    hostMocks.startNemotronStackAction.mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "" });
    hostMocks.stopNemotronStackAction.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
    hostMocks.suggestFreeResourcesAction.mockResolvedValue([]);
    hostMocks.stopDevWorkspaceAction.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("renders full stack preset for 1-node cluster", () => {
    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );
    expect(screen.getByTestId("nemotron-stack-panel")).toBeInTheDocument();
    expect(screen.getByText(/Full Agentic Stack \(1× Spark\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deploy full stack/i })).toBeInTheDocument();
    expect(screen.getByText(/Orchestrator/)).toBeInTheDocument();
  });

  it("shows 2-node profile picker", () => {
    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 2 }}
      />
    );
    expect(screen.getByText(/Dual Nano/)).toBeInTheDocument();
    expect(screen.getByText(/Super \+ Nano/)).toBeInTheDocument();
  });

  it("shows 3-node and 4-node presets", () => {
    const { rerender } = render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 3 }}
      />
    );
    expect(screen.getByText(/3× Spark/)).toBeInTheDocument();

    rerender(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 4 }}
      />
    );
    expect(screen.getAllByText(/4× Spark/).length).toBeGreaterThan(0);
  });

  it("shows no preset message when catalog has no matching stack", () => {
    render(
      <NemotronStackPanel
        initialCatalog={{ models: {}, pillars: {}, stacks: {} }}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );
    expect(screen.getByText(/No Nemotron stack preset/)).toBeInTheDocument();
  });

  it("opens heavy confirm before deploying heavy stack", async () => {
    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Deploy full stack/i }));

    await waitFor(() => {
      expect(screen.getByText(/Heavy workload confirmation/i)).toBeInTheDocument();
    });
    expect(hostMocks.startNemotronStackAction).not.toHaveBeenCalled();
  });

  it("deploys stack after heavy confirmation", async () => {
    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Deploy full stack/i }));
    await waitFor(() => screen.getByPlaceholderText("yes"));
    fireEvent.change(screen.getByPlaceholderText("yes"), { target: { value: "yes" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm start/i }));

    await waitFor(() => {
      expect(hostMocks.startNemotronStackAction).toHaveBeenCalledWith("nemotron-agentic-spark-1", "yes");
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Stack deploying" }));
    });
  });

  it("opens capacity gate when check fails", async () => {
    hostMocks.checkCapacityAction.mockResolvedValue({
      ok: false,
      verdict: "insufficient_gpu",
      action: "stack:nemotron-agentic-spark-1",
      heavy: true,
      required: { gpus: 2, cpu: "16", memory: "59Gi" },
      available: { gpus: 0, cpu: "1", memory: "0Gi" },
      deficit: { gpus: 2 }
    });

    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Deploy full stack/i }));
    await waitFor(() => {
      expect(screen.getByText(/Insufficient resources/i)).toBeInTheDocument();
    });
  });

  it("toasts deploy failure", async () => {
    hostMocks.startNemotronStackAction.mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "helm failed"
    });

    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Deploy full stack/i }));
    await waitFor(() => screen.getByPlaceholderText("yes"));
    fireEvent.change(screen.getByPlaceholderText("yes"), { target: { value: "yes" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm start/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Stack deploy failed", description: "helm failed" })
      );
    });
  });

  it("stops running stack", async () => {
    const runningStatus = {
      ...fakeNemotronStackStatus,
      stacks: [
        {
          ...fakeNemotronStackStatus.stacks[0],
          healthy: true,
          components: [{ model: "nemotron-3-nano-omni-30b", state: "running" as const }]
        }
      ]
    };

    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={runningStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Stop stack/i }));

    await waitFor(() => {
      expect(hostMocks.stopNemotronStackAction).toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Stack stopped" }));
    });
  });

  it("copies endpoint URL when stack is healthy", async () => {
    const runningStatus = {
      ...fakeNemotronStackStatus,
      stacks: [{ ...fakeNemotronStackStatus.stacks[0], healthy: true, components: [] }]
    };

    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={runningStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Copy URL/i })[0]!);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("http://nemotron-3-nano-omni-30b.ai-inference.svc.cluster.local:8000/v1");
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Copied endpoint" }));
    });
  });

  it("toasts refresh failure from polling", async () => {
    vi.useFakeTimers();
    hostMocks.getNemotronStackStatusAction.mockRejectedValue(new Error("api down"));
    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    await vi.advanceTimersByTimeAsync(10000);

    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Stack status failed", variant: "error" }));
    vi.useRealTimers();
  });

  it("retries deploy after capacity gate frees resources", async () => {
    hostMocks.checkCapacityAction
      .mockResolvedValueOnce({
        ok: false,
        verdict: "insufficient_gpu",
        action: "stack:nemotron-agentic-spark-1",
        heavy: true,
        required: { gpus: 2, cpu: "16", memory: "59Gi" },
        available: { gpus: 0, cpu: "1", memory: "0Gi" },
        deficit: { gpus: 2 }
      })
      .mockResolvedValueOnce({
        ok: true,
        verdict: "ok",
        action: "stack:nemotron-agentic-spark-1",
        heavy: true,
        required: { gpus: 1, cpu: "16", memory: "59Gi" },
        available: { gpus: 2, cpu: "17.7", memory: "0Gi" },
        deficit: {}
      });
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

    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Deploy full stack/i }));
    await waitFor(() => screen.getByText(/Stop Coder workspaces/i));
    fireEvent.click(screen.getAllByRole("button", { name: /Apply/i })[0]!);
    await waitFor(() => screen.getByPlaceholderText("yes"));
    fireEvent.change(screen.getByPlaceholderText("yes"), { target: { value: "yes" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm start/i }));

    await waitFor(() => {
      expect(hostMocks.startNemotronStackAction).toHaveBeenCalledWith("nemotron-agentic-spark-1", "yes");
    });
  });

  it("toasts stop failure", async () => {
    hostMocks.stopNemotronStackAction.mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "helm uninstall failed"
    });
    const runningStatus = {
      ...fakeNemotronStackStatus,
      stacks: [
        {
          ...fakeNemotronStackStatus.stacks[0],
          healthy: false,
          components: [{ model: "nemotron-3-nano-omni-30b", state: "running" as const }]
        }
      ]
    };

    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={runningStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Stop stack/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Stop failed", description: "helm uninstall failed" })
      );
    });
  });

  it("deploys non-heavy stack without confirmation dialog", async () => {
    const lightCatalog = {
      ...fakeNemotronCatalog,
      stacks: {
        ...fakeNemotronCatalog.stacks,
        "nemotron-agentic-spark-1": {
          ...fakeNemotronCatalog.stacks["nemotron-agentic-spark-1"],
          heavy: false
        }
      }
    };

    render(
      <NemotronStackPanel
        initialCatalog={lightCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Deploy full stack/i }));

    await waitFor(() => {
      expect(hostMocks.startNemotronStackAction).toHaveBeenCalledWith("nemotron-agentic-spark-1", "yes");
    });
  });

  it("selects stack preset on multi-node cluster", () => {
    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 3 }}
      />
    );
    const presetBtn = screen.getByRole("button", { name: /3× Spark/i });
    fireEvent.click(presetBtn);
    expect(presetBtn).toBeInTheDocument();
  });

  it("switches spark-2 profile", () => {
    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 2 }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Super \+ Nano/i }));
    expect(screen.getByRole("button", { name: /Super \+ Nano/i })).toBeInTheDocument();
  });

  it("shows deploy busy spinner while stack action is in flight", async () => {
    let resolveStart!: (v: unknown) => void;
    hostMocks.startNemotronStackAction.mockReturnValue(
      new Promise((r) => {
        resolveStart = r;
      })
    );

    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Deploy full stack/i }));
    await waitFor(() => screen.getByPlaceholderText("yes"));
    fireEvent.change(screen.getByPlaceholderText("yes"), { target: { value: "yes" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm start/i }));

    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).toBeTruthy();
    });
    resolveStart({ exitCode: 0, stdout: "ok", stderr: "" });
  });

  it("omits endpoint rows when model has no openai service", () => {
    const catalogWithoutSvc = {
      ...fakeNemotronCatalog,
      models: {
        ...fakeNemotronCatalog.models,
        "nemotron-3-nano-omni-30b": {
          ...fakeNemotronCatalog.models["nemotron-3-nano-omni-30b"],
          openai_svc: undefined
        }
      }
    };
    const runningStatus = {
      ...fakeNemotronStackStatus,
      stacks: [{ ...fakeNemotronStackStatus.stacks[0], healthy: true, components: [] }]
    };

    render(
      <NemotronStackPanel
        initialCatalog={catalogWithoutSvc}
        initialStackStatus={runningStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );
    expect(screen.getAllByRole("button", { name: /Copy URL/i }).length).toBeLessThan(
      fakeNemotronCatalog.stacks["nemotron-agentic-spark-1"].stack_with?.length ?? 0
    );
  });

  it("renders 3-node and 4-node preset pickers", () => {
    const { rerender } = render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 3 }}
      />
    );
    expect(screen.getByText(/3× Spark/)).toBeInTheDocument();

    rerender(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 4 }}
      />
    );
    expect(screen.getAllByText(/4× Spark/).length).toBeGreaterThan(0);
  });

  it("shows quality notes and unknown pillar labels", () => {
    const catalogWithNotes = {
      ...fakeNemotronCatalog,
      stacks: {
        ...fakeNemotronCatalog.stacks,
        "nemotron-agentic-spark-1": {
          ...fakeNemotronCatalog.stacks["nemotron-agentic-spark-1"],
          quality_notes: "Expect longer cold start on single-node labs.",
          pillars: ["orchestrator", "custom-pillar"]
        }
      }
    };
    render(
      <NemotronStackPanel
        initialCatalog={catalogWithNotes}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );
    expect(screen.getByText(/cold start/i)).toBeInTheDocument();
    expect(screen.getByText("custom-pillar")).toBeInTheDocument();
  });

  it("shows stop when components are running but stack is unhealthy", () => {
    const runningStatus = {
      ...fakeNemotronStackStatus,
      stacks: [
        {
          ...fakeNemotronStackStatus.stacks[0],
          healthy: false,
          components: [{ model: "nemotron-3-nano-omni-30b", state: "running" as const }]
        }
      ]
    };
    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={runningStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );
    expect(screen.getByRole("button", { name: /Stop stack/i })).toBeInTheDocument();
  });

  it("lists non-running component badges", () => {
    const mixedStatus = {
      ...fakeNemotronStackStatus,
      stacks: [
        {
          ...fakeNemotronStackStatus.stacks[0],
          healthy: false,
          components: [
            { model: "nemotron-3-nano-omni-30b", state: "stopped" as const },
            { model: "nemotron-3-super-120b", state: "running" as const }
          ]
        }
      ]
    };
    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={mixedStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );
    expect(screen.getByText(/stopped/)).toBeInTheDocument();
  });

  it("retries non-heavy deploy after capacity gate frees resources", async () => {
    const lightCatalog = {
      ...fakeNemotronCatalog,
      stacks: {
        ...fakeNemotronCatalog.stacks,
        "nemotron-agentic-spark-1": {
          ...fakeNemotronCatalog.stacks["nemotron-agentic-spark-1"],
          heavy: false
        }
      }
    };

    hostMocks.checkCapacityAction
      .mockResolvedValueOnce({
        ok: false,
        verdict: "insufficient_gpu",
        action: "stack:nemotron-agentic-spark-1",
        heavy: false,
        required: { gpus: 2, cpu: "16", memory: "59Gi" },
        available: { gpus: 0, cpu: "1", memory: "0Gi" },
        deficit: { gpus: 2 }
      })
      .mockResolvedValueOnce({
        ok: true,
        verdict: "ok",
        action: "stack:nemotron-agentic-spark-1",
        heavy: false,
        required: { gpus: 1, cpu: "16", memory: "59Gi" },
        available: { gpus: 2, cpu: "17.7", memory: "0Gi" },
        deficit: {}
      });
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

    render(
      <NemotronStackPanel
        initialCatalog={lightCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Deploy full stack/i }));
    await waitFor(() => screen.getByText(/Stop Coder workspaces/i));
    fireEvent.click(screen.getAllByRole("button", { name: /Apply/i })[0]!);

    await waitFor(() => {
      expect(hostMocks.startNemotronStackAction).toHaveBeenCalledWith("nemotron-agentic-spark-1", "yes");
    });
    expect(screen.queryByText(/Heavy workload confirmation/i)).not.toBeInTheDocument();
  });

  it("uses stdout when deploy fails without stderr", async () => {
    hostMocks.startNemotronStackAction.mockResolvedValue({
      exitCode: 1,
      stdout: "deploy stdout",
      stderr: ""
    });

    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Deploy full stack/i }));
    await waitFor(() => screen.getByPlaceholderText("yes"));
    fireEvent.change(screen.getByPlaceholderText("yes"), { target: { value: "yes" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm start/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Stack deploy failed", description: "deploy stdout" })
      );
    });
  });

  it("uses stdout when stop fails without stderr", async () => {
    hostMocks.stopNemotronStackAction.mockResolvedValue({
      exitCode: 1,
      stdout: "stop stdout",
      stderr: ""
    });
    const runningStatus = {
      ...fakeNemotronStackStatus,
      stacks: [
        {
          ...fakeNemotronStackStatus.stacks[0],
          healthy: true,
          components: [{ model: "nemotron-3-nano-omni-30b", state: "running" as const }]
        }
      ]
    };

    render(
      <NemotronStackPanel
        initialCatalog={fakeNemotronCatalog}
        initialStackStatus={runningStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Stop stack/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Stop failed", description: "stop stdout" })
      );
    });
  });

  it("keeps gate open when recheck still fails after freeing resources", async () => {
    hostMocks.checkCapacityAction
      .mockResolvedValueOnce({
        ok: false,
        verdict: "insufficient_gpu",
        action: "stack:nemotron-agentic-spark-1",
        heavy: false,
        required: { gpus: 2, cpu: "16", memory: "59Gi" },
        available: { gpus: 0, cpu: "1", memory: "0Gi" },
        deficit: { gpus: 2 }
      })
      .mockResolvedValueOnce({
        ok: false,
        verdict: "still_insufficient",
        action: "stack:nemotron-agentic-spark-1",
        heavy: false,
        required: { gpus: 2, cpu: "16", memory: "59Gi" },
        available: { gpus: 0, cpu: "1", memory: "0Gi" },
        deficit: { gpus: 2 }
      });
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

    const lightCatalog = {
      ...fakeNemotronCatalog,
      stacks: {
        ...fakeNemotronCatalog.stacks,
        "nemotron-agentic-spark-1": {
          ...fakeNemotronCatalog.stacks["nemotron-agentic-spark-1"],
          heavy: false
        }
      }
    };

    render(
      <NemotronStackPanel
        initialCatalog={lightCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Deploy full stack/i }));
    await waitFor(() => screen.getByText(/Stop Coder workspaces/i));
    fireEvent.click(screen.getAllByRole("button", { name: /Apply/i })[0]!);

    await waitFor(() => {
      expect(hostMocks.checkCapacityAction).toHaveBeenCalledTimes(2);
    });
    expect(hostMocks.startNemotronStackAction).not.toHaveBeenCalled();
    expect(screen.getByText(/Insufficient resources/i)).toBeInTheDocument();
  });

  it("renders stacks with default node bounds and missing catalog labels", () => {
    const sparseCatalog = {
      models: fakeNemotronCatalog.models,
      pillars: fakeNemotronCatalog.pillars,
      stacks: {
        "nemotron-agentic-spark-1": {
          label: undefined as unknown as string,
          description: "Sparse preset",
          heavy: false,
          stack_with: undefined,
          pillars: undefined
        }
      }
    };

    render(
      <NemotronStackPanel
        initialCatalog={sparseCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    expect(screen.getByRole("button", { name: "nemotron-agentic-spark-1" })).toBeInTheDocument();
    expect(screen.getByText(/0 services/)).toBeInTheDocument();
  });

  it("copies endpoint using model id when display name and port are absent", async () => {
    const catalogBareModel = {
      ...fakeNemotronCatalog,
      models: {
        "bare-model": {
          family: "llm",
          runtime: "vllm",
          openai_svc: "bare-svc"
        } as (typeof fakeNemotronCatalog.models)[string]
      },
      stacks: {
        "nemotron-agentic-spark-1": {
          ...fakeNemotronCatalog.stacks["nemotron-agentic-spark-1"],
          stack_with: ["bare-model"]
        }
      }
    };
    const runningStatus = {
      ...fakeNemotronStackStatus,
      stacks: [{ ...fakeNemotronStackStatus.stacks[0], healthy: true, components: [] }]
    };

    render(
      <NemotronStackPanel
        initialCatalog={catalogBareModel}
        initialStackStatus={runningStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy URL/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("http://bare-svc.ai-inference.svc.cluster.local:8000/v1");
      expect(screen.getByText("bare-model")).toBeInTheDocument();
    });
  });

  it("shows spark-2 profile id when catalog label is missing", () => {
    const sparse2Catalog = {
      models: fakeNemotronCatalog.models,
      pillars: fakeNemotronCatalog.pillars,
      stacks: {
        "nemotron-agentic-spark-2-agent": {
          label: undefined as unknown as string,
          description: "Agent profile",
          heavy: false,
          stack_with: ["nemotron-3-nano-omni-30b"]
        },
        "nemotron-agentic-spark-2-reasoning": {
          label: undefined as unknown as string,
          description: "Reasoning profile",
          heavy: false,
          stack_with: ["nemotron-3-super-120b"]
        }
      }
    };

    render(
      <NemotronStackPanel
        initialCatalog={sparse2Catalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 2 }}
      />
    );

    expect(screen.getByRole("button", { name: "nemotron-agentic-spark-2-agent" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "nemotron-agentic-spark-2-reasoning" })).toBeInTheDocument();
  });

  it("renders healthy stack with undefined stack_with as empty endpoints", () => {
    const noStackWithCatalog = {
      ...fakeNemotronCatalog,
      stacks: {
        "nemotron-agentic-spark-1": {
          ...fakeNemotronCatalog.stacks["nemotron-agentic-spark-1"],
          stack_with: undefined
        }
      }
    };
    const runningStatus = {
      ...fakeNemotronStackStatus,
      stacks: [{ ...fakeNemotronStackStatus.stacks[0], healthy: true, components: [] }]
    };

    render(
      <NemotronStackPanel
        initialCatalog={noStackWithCatalog}
        initialStackStatus={runningStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    expect(screen.queryByRole("button", { name: /Copy URL/i })).not.toBeInTheDocument();
    expect(screen.getByText(/OpenAI-compatible endpoints/i)).toBeInTheDocument();
  });

  it("toasts deploy success with stack id when preset label is missing", async () => {
    const noLabelCatalog = {
      ...fakeNemotronCatalog,
      stacks: {
        "nemotron-agentic-spark-1": {
          ...fakeNemotronCatalog.stacks["nemotron-agentic-spark-1"],
          label: undefined as unknown as string,
          heavy: false
        }
      }
    };

    render(
      <NemotronStackPanel
        initialCatalog={noLabelCatalog}
        initialStackStatus={fakeNemotronStackStatus}
        clusterCapacity={{ ...fakeClusterCapacity, node_count: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Deploy full stack/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Stack deploying",
          description: "nemotron-agentic-spark-1"
        })
      );
    });
  });
});
