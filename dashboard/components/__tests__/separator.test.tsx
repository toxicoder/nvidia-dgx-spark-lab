import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Separator } from "../ui/separator";

describe("Separator", () => {
  it("renders a semantic horizontal separator", () => {
    render(<Separator />);
    const rule = screen.getByRole("separator");
    expect(rule).toHaveAttribute("data-testid", "ui-separator");
    expect(rule.className).toContain("bg-border");
    expect(rule.className).toContain("h-px");
  });

  it("renders a vertical separator for inline rows", () => {
    render(<Separator orientation="vertical" />);
    const rule = screen.getByRole("separator");
    expect(rule).toHaveAttribute("aria-orientation", "vertical");
    expect(rule.className).toContain("w-px");
  });

  it("is decorative by default and semantic on request", () => {
    render(<Separator decorative />);
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("accepts a className", () => {
    render(<Separator className="my-4" />);
    expect(screen.getByRole("separator").className).toContain("my-4");
  });
});
