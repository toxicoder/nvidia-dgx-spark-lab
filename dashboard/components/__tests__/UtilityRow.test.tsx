import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UtilityRow } from "../UtilityRow";

const hostMocks = vi.hoisted(() => ({
  runUtilityAction: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "{}", stderr: "" }),
  getUtilityStatusAction: vi.fn().mockResolvedValue({ status: "ok" })
}));

vi.mock("@/actions/host-actions", () => hostMocks);

const toastMock = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock })
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({
    open,
    onOpenChange,
    children,
    title
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
    title?: string;
  }) => (
    <div data-testid="sheet-mock">
      <button type="button" onClick={() => onOpenChange?.(true)}>
        open-sheet
      </button>
      {open ? (
        <div>
          <span>{title}</span>
          {children}
        </div>
      ) : null}
    </div>
  )
}));

describe("UtilityRow", () => {
  const utility = { name: "spark-clock", path: "/opt/lab/utilities/spark-clock" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders utility name and path", () => {
    render(<UtilityRow utility={utility} />);
    expect(screen.getByText("spark-clock")).toBeInTheDocument();
    expect(screen.getByText(utility.path)).toBeInTheDocument();
  });

  it("shows last run badge when provided", () => {
    render(
      <UtilityRow
        utility={utility}
        lastRun={{
          id: 1,
          name: "spark-clock",
          status: "success",
          started_at: 1700000000,
          output: "{}",
          exit_code: 0
        }}
      />
    );
    expect(screen.getByText(/last: success/i)).toBeInTheDocument();
  });

  it("runs utility and shows output sheet", async () => {
    render(<UtilityRow utility={utility} />);

    fireEvent.click(screen.getByRole("button", { name: /Run/i }));

    await waitFor(() => {
      expect(hostMocks.runUtilityAction).toHaveBeenCalledWith("spark-clock");
      expect(screen.getByText(/Result: spark-clock/i)).toBeInTheDocument();
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Run completed", variant: "success" }));
    });
  });

  it("loads status and shows output sheet", async () => {
    render(<UtilityRow utility={utility} />);

    fireEvent.click(screen.getByRole("button", { name: /Status/i }));

    await waitFor(() => {
      expect(hostMocks.getUtilityStatusAction).toHaveBeenCalledWith("spark-clock");
      expect(screen.getByText("ok")).toBeInTheDocument();
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Status loaded", variant: "success" }));
    });
  });

  it("toasts error when status load fails", async () => {
    hostMocks.getUtilityStatusAction.mockRejectedValue(new Error("status boom"));

    render(<UtilityRow utility={utility} />);
    fireEvent.click(screen.getByRole("button", { name: /Status/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Error", variant: "error" }));
    });
  });

  it("shows skeleton when sheet opens before a result is loaded", () => {
    render(<UtilityRow utility={utility} />);
    fireEvent.click(screen.getByRole("button", { name: /open-sheet/i }));
    expect(screen.getByTestId("ui-skeleton")).toBeInTheDocument();
  });

  it("toasts error when run fails", async () => {
    hostMocks.runUtilityAction.mockRejectedValue(new Error("boom"));

    render(<UtilityRow utility={utility} />);
    fireEvent.click(screen.getByRole("button", { name: /Run/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Error", variant: "error" }));
    });
  });
});
