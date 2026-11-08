import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { fakeClusterCapacity, fakeContainers, fakeInferenceWorkloadsStatus } from "@/lib/mocks/fixtures";
import type { ClusterCapacity, DockerListResult, InferenceWorkloadsStatus } from "@/lib/types";

// One module instance for the whole file: resetting modules between cases re-instruments
// the page and loses the branch counts collected by the earlier cases.
const host = vi.hoisted(() => ({
  getClusterCapacity: vi.fn<() => Promise<ClusterCapacity>>(),
  listContainers: vi.fn<() => Promise<DockerListResult>>(),
  getInferenceWorkloadsStatus: vi.fn<() => Promise<InferenceWorkloadsStatus>>()
}));

vi.mock("@/lib/host", async () => {
  const actual = await vi.importActual<typeof import("@/lib/host")>("@/lib/host");
  return { ...actual, ...host };
});

/** Read one tile's figure, dropping the unit that renders inside the value node. */
function tileValue(label: string): string | undefined {
  const tile = screen
    .getAllByTestId("metric-tile")
    .find((t) => t.querySelector('[data-testid="metric-tile-label"]')?.textContent?.trim() === label);
  const value = tile?.querySelector('[data-testid="metric-tile-value"]')?.textContent ?? "";
  const unit = tile?.querySelector('[data-testid="metric-tile-unit"]')?.textContent ?? "";
  return (unit === "" ? value : value.replace(unit, "")).trim();
}

/** The tone class the tile resolved to, which is what the branch under test chooses. */
function tileClass(label: string): string {
  const tile = screen
    .getAllByTestId("metric-tile")
    .find((t) => t.querySelector('[data-testid="metric-tile-label"]')?.textContent?.trim() === label);
  return tile?.className ?? "";
}

async function renderKpis(): Promise<void> {
  const { OverviewKpis } = await import("@/app/(dashboard)/page");
  render(await OverviewKpis());
}

/** The tone classes the tile resolved to, as whole tokens (one tone class prefixes another). */
function tileClassTokens(label: string): string[] {
  return tileClass(label).split(/\s+/).filter(Boolean);
}

describe("overview KPI band", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    host.getClusterCapacity.mockResolvedValue(fakeClusterCapacity);
    host.listContainers.mockResolvedValue(fakeContainers);
    host.getInferenceWorkloadsStatus.mockResolvedValue(fakeInferenceWorkloadsStatus);
  });

  it("warns when no GPU is free", async () => {
    host.getClusterCapacity.mockResolvedValue({
      ...fakeClusterCapacity,
      free: { ...fakeClusterCapacity.free, gpus: 0 }
    });

    await renderKpis();

    expect(tileValue("GPUs free")).toBe("0");
    expect(tileClassTokens("GPUs free")).toContain("border-warning");
  });

  it("shouts when utilisation reaches the danger tier", async () => {
    host.getClusterCapacity.mockResolvedValue({
      ...fakeClusterCapacity,
      utilization: { ...fakeClusterCapacity.utilization, gpu_pct: 95 }
    });

    await renderKpis();

    expect(tileValue("GPU utilisation")).toBe("95");
    expect(tileClassTokens("GPU utilisation")).toContain("border-destructive");
  });

  it("warns on the middle utilisation tier without shouting", async () => {
    host.getClusterCapacity.mockResolvedValue({
      ...fakeClusterCapacity,
      utilization: { ...fakeClusterCapacity.utilization, gpu_pct: 82 }
    });

    await renderKpis();

    expect(tileValue("GPU utilisation")).toBe("82");
    // Whole-token match: `border-destructive` is a prefix of the warning class.
    expect(tileClassTokens("GPU utilisation")).toContain("border-warning");
  });

  it("shows a dash rather than a fabricated zero when the container probe fails", async () => {
    host.listContainers.mockRejectedValue(new Error("docker socket unreachable"));

    await renderKpis();

    expect(tileValue("Containers")).toBe("—");
    expect(screen.queryByText(/0 containers running/)).not.toBeInTheDocument();
  });

  it("shows a dash rather than a fabricated zero when the inference probe fails", async () => {
    host.getInferenceWorkloadsStatus.mockRejectedValue(new Error("api down"));

    await renderKpis();

    expect(tileValue("Lanes running")).toBe("—");
  });

  it("counts running lanes and stays quiet at zero", async () => {
    host.getInferenceWorkloadsStatus.mockResolvedValue({
      ...fakeInferenceWorkloadsStatus,
      jobs: fakeInferenceWorkloadsStatus.jobs.map((job) => ({ ...job, state: "absent" as const }))
    });

    await renderKpis();

    expect(tileValue("Lanes running")).toBe("0");
  });

  it("counts containers from a healthy probe", async () => {
    host.listContainers.mockResolvedValue(fakeContainers);

    await renderKpis();

    expect(tileValue("Containers running")).toBe(`${fakeContainers.length}`);
  });
});
