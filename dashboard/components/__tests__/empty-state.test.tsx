import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Boxes } from "lucide-react";

import { EmptyState } from "../ui/empty-state";

describe("EmptyState", () => {
  it("renders the icon, title and description", () => {
    render(<EmptyState icon={Boxes} title="No workloads in ai-inference" description="Start one below." />);
    expect(screen.getByText("No workloads in ai-inference")).toBeInTheDocument();
    expect(screen.getByText("Start one below.")).toBeInTheDocument();
    expect(screen.getByTestId("empty-state").querySelector("svg")).not.toBeNull();
  });

  it("renders without a description", () => {
    render(<EmptyState icon={Boxes} title="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders an optional action slot", () => {
    const onStart = vi.fn();
    render(
      <EmptyState
        icon={Boxes}
        title="No workloads"
        action={
          <button type="button" onClick={onStart}>
            Start a model
          </button>
        }
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Start a model" }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("accepts a className", () => {
    render(<EmptyState icon={Boxes} title="Nothing" className="p-8" />);
    expect(screen.getByTestId("empty-state").className).toContain("p-8");
  });
});
