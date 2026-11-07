import { describe, it, expect } from "vitest";
import type React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

function Harness(): React.JSX.Element {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button">Hover me</button>
        </TooltipTrigger>
        <TooltipContent>Helpful hint</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

describe("Tooltip", () => {
  it("shows the tooltip content on focus, so it is reachable by keyboard", () => {
    render(<Harness />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(screen.getByRole("button", { name: "Hover me" }));
    expect(screen.getByRole("tooltip").textContent).toBe("Helpful hint");
  });

  it("hides it again on blur", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Hover me" });
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("styles the bubble with the popover tokens", () => {
    render(<Harness />);
    fireEvent.focus(screen.getByRole("button", { name: "Hover me" }));
    const bubble = document.querySelector("[data-slot='tooltip-content']");
    expect(bubble?.textContent).toContain("Helpful hint");
    expect(bubble?.className).toContain("bg-popover");
    expect(bubble?.className).toContain("text-popover-foreground");
  });
});
