import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { PanelRefreshButton } from "../ui/panel-refresh-button";

describe("PanelRefreshButton", () => {
  it("is a plain outline button when idle", () => {
    render(<PanelRefreshButton onClick={vi.fn()} busy={false} />);
    const button = screen.getByTestId("panel-refresh-button");
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-busy", "false");
    expect(button.textContent).toContain("Refresh");
    expect(button.querySelector(".animate-spin")).toBeNull();
  });

  it("spins a real spinner, stays disabled, and keeps aria-busy while in flight", () => {
    render(<PanelRefreshButton onClick={vi.fn()} busy />);
    const button = screen.getByTestId("panel-refresh-button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector("svg.animate-spin")).not.toBeNull();
  });

  it("does not reflow when the label swaps", () => {
    const { rerender } = render(<PanelRefreshButton onClick={vi.fn()} busy={false} busyLabel="Refreshing..." />);
    const idleButton = screen.getByTestId("panel-refresh-button");
    expect(idleButton.querySelector("[data-slot='refresh-button-text']")?.textContent).toBe("Refresh");
    expect(idleButton.querySelector("[data-slot='refresh-button-sizer']")?.textContent).toBe("Refreshing...");
    expect(idleButton.querySelector("[data-slot='refresh-button-sizer']")).toHaveAttribute("aria-hidden", "true");

    rerender(<PanelRefreshButton onClick={vi.fn()} busy busyLabel="Refreshing..." />);
    const busyButton = screen.getByTestId("panel-refresh-button");
    expect(busyButton.querySelector("[data-slot='refresh-button-text']")?.textContent).toBe("Refreshing...");
    // The sizer always holds the widest label, so the button width cannot change mid-flight.
    expect(busyButton.querySelector("[data-slot='refresh-button-sizer']")?.textContent).toBe("Refreshing...");
  });

  it("keeps one label when no busy label is given", () => {
    render(<PanelRefreshButton onClick={vi.fn()} busy />);
    expect(screen.getByTestId("panel-refresh-button-text").textContent).toBe("Refresh");
  });

  it("fires onClick and is inert while busy", () => {
    const onClick = vi.fn();
    const { rerender } = render(<PanelRefreshButton onClick={onClick} busy={false} />);
    fireEvent.click(screen.getByTestId("panel-refresh-button"));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<PanelRefreshButton onClick={onClick} busy />);
    fireEvent.click(screen.getByTestId("panel-refresh-button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("accepts a custom label and className", () => {
    render(<PanelRefreshButton onClick={vi.fn()} busy={false} label="Rescan" className="ml-auto" />);
    expect(screen.getByTestId("panel-refresh-button-text").textContent).toBe("Rescan");
    expect(screen.getByTestId("panel-refresh-button").className).toContain("ml-auto");
  });
});
