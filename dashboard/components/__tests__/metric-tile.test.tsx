import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { MetricTile } from "../ui/metric-tile";

describe("MetricTile", () => {
  it("makes the headline number the loudest thing in the tile", () => {
    render(<MetricTile label="GPUs" value={2} unit="GPUs" />);
    const value = screen.getByTestId("metric-tile-value");
    expect(value.textContent).toContain("2");
    expect(value.className).toContain("text-2xl");
    expect(screen.getByTestId("metric-tile-label").className).toContain("text-xs");
  });

  it("always uses tabular figures so polled digits do not jitter", () => {
    render(<MetricTile label="GPU utilisation" value="84" unit="%" />);
    expect(screen.getByTestId("metric-tile-value").className).toContain("tabular-nums");
  });

  it("renders the unit as a subordinate suffix, not part of the number", () => {
    render(<MetricTile label="Memory" value="60.8" unit="GiB" />);
    expect(screen.getByTestId("metric-tile-value").textContent).toContain("60.8");
    expect(screen.getByTestId("metric-tile-unit").textContent).toBe("GiB");
    expect(screen.getByTestId("metric-tile-unit").className).toContain("text-sm");
  });

  it("omits the unit node when there is none", () => {
    render(<MetricTile label="Nodes" value={1} />);
    expect(screen.queryByTestId("metric-tile-unit")).not.toBeInTheDocument();
  });

  it("renders an optional hint", () => {
    render(<MetricTile label="CPU" value="17.7" hint="of 28 allocatable" />);
    expect(screen.getByText("of 28 allocatable")).toBeInTheDocument();
  });

  it("escalates loudness with tone", () => {
    const { rerender } = render(<MetricTile label="GPU" value={0} tone="danger" />);
    expect(screen.getByTestId("metric-tile").getAttribute("data-tone")).toBe("danger");

    rerender(<MetricTile label="GPU" value={0} tone="warning" />);
    expect(screen.getByTestId("metric-tile").getAttribute("data-tone")).toBe("warning");

    rerender(<MetricTile label="GPU" value={0} tone="ok" />);
    expect(screen.getByTestId("metric-tile").getAttribute("data-tone")).toBe("ok");

    rerender(<MetricTile label="GPU" value={0} />);
    expect(screen.getByTestId("metric-tile").getAttribute("data-tone")).toBe("neutral");
  });

  it("accepts a className", () => {
    render(<MetricTile label="GPU" value={1} className="mt-3" />);
    expect(screen.getByTestId("metric-tile").className).toContain("mt-3");
  });
});
