import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { Switch } from "../ui/switch";

describe("Switch", () => {
  it("renders a real switch with the test id the panels rely on", () => {
    render(<Switch checked={false} onCheckedChange={vi.fn()} />);
    const sw = screen.getByTestId("ui-switch");
    expect(sw).toHaveAttribute("role", "switch");
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("reports the new value when toggled", () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("reflects the controlled checked state", () => {
    const { rerender } = render(<Switch checked onCheckedChange={vi.fn()} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");

    rerender(<Switch checked={false} onCheckedChange={vi.fn()} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("is inert and marked disabled while a transition runs", () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} disabled onCheckedChange={onCheckedChange} />);
    const sw = screen.getByRole("switch");
    expect(sw).toBeDisabled();
    expect(sw).toHaveAttribute("data-state", "unchecked");
    fireEvent.click(sw);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("passes an accessible name through to the control", () => {
    render(<Switch checked={false} onCheckedChange={vi.fn()} aria-label="Toggle Coder" />);
    expect(screen.getByRole("switch", { name: "Toggle Coder" })).toBeInTheDocument();
  });

  it("supports the uncontrolled defaultChecked form", () => {
    render(<Switch defaultChecked />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("accepts a className", () => {
    render(<Switch checked={false} onCheckedChange={vi.fn()} className="ml-2" />);
    expect(screen.getByTestId("ui-switch").className).toContain("ml-2");
  });
});
