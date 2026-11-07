import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Progress } from "../ui/progress";

describe("Progress", () => {
  it("exposes the progressbar semantics the hand-rolled bar lacked", () => {
    render(<Progress value={72} max={100} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "72");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("data-testid", "ui-progress");
  });

  it("clamps out-of-range values instead of rendering a broken bar", () => {
    render(<Progress value={140} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("renders an indeterminate bar when value is null", () => {
    render(<Progress value={null} />);
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });

  it("accepts a className", () => {
    render(<Progress value={10} className="h-2" />);
    expect(screen.getByRole("progressbar").className).toContain("h-2");
  });
});
