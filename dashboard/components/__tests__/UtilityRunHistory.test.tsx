import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UtilityRunHistory } from "../UtilityRunHistory";

describe("UtilityRunHistory", () => {
  it("shows empty state when no runs", () => {
    render(<UtilityRunHistory runs={[]} />);
    expect(screen.getByText(/No utility runs recorded yet/i)).toBeInTheDocument();
  });

  it("renders run rows with status and timestamp", () => {
    render(
      <UtilityRunHistory
        runs={[
          {
            id: 1,
            name: "spark-clock",
            status: "success",
            started_at: 1700000000,
            output: "{}",
            exit_code: 0
          },
          {
            id: 2,
            name: "system-update",
            status: null,
            started_at: 1700001000,
            output: null,
            exit_code: null
          }
        ]}
      />
    );

    expect(screen.getByTestId("utility-run-history")).toBeInTheDocument();
    expect(screen.getByText("spark-clock")).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
    expect(screen.getByText("system-update")).toBeInTheDocument();
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });
});
