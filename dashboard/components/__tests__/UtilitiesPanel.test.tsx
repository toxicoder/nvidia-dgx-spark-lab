import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { UtilitiesPanel } from "../UtilitiesPanel";
import { fakeUtilities } from "@/lib/mocks/fixtures";
import * as host from "@/lib/host";

vi.mock("@/lib/host", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/host")>();
  return {
    ...actual,
    listUtilities: vi.fn(actual.listUtilities)
  };
});

describe("UtilitiesPanel (server component + forms)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(host.listUtilities).mockReturnValue(fakeUtilities);
  });

  it("renders list of utilities with Run and Status buttons using mocks", async () => {
    const ui = await UtilitiesPanel();
    render(<>{ui}</>);

    expect(screen.getByText(/UTILITY SCRIPTS/i)).toBeInTheDocument();
    expect(screen.getByText("spark-clock")).toBeInTheDocument();
    expect(screen.getAllByText(/system-update/i).length).toBeGreaterThan(0);

    const runBtns = screen.getAllByRole("button", { name: /Run/i });
    const statusBtns = screen.getAllByRole("button", { name: /Status/i });
    expect(runBtns.length).toBeGreaterThanOrEqual(1);
    expect(statusBtns.length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when no utilities are discovered", async () => {
    vi.mocked(host.listUtilities).mockReturnValue([]);

    const ui = await UtilitiesPanel();
    render(<>{ui}</>);

    expect(screen.getByText(/No utilities discovered/i)).toBeInTheDocument();
  });
});
