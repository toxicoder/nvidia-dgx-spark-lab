import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";

describe("Collapsible", () => {
  it("starts closed and links the trigger to its region", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button type="button">Show all models</button>
        </CollapsibleTrigger>
        <CollapsibleContent>29 models</CollapsibleContent>
      </Collapsible>
    );

    const trigger = screen.getByRole("button", { name: "Show all models" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("29 models")).not.toBeInTheDocument();
  });

  it("opens on click and exposes the content", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button type="button">Toggle</button>
        </CollapsibleTrigger>
        <CollapsibleContent data-testid="region">Hidden detail</CollapsibleContent>
      </Collapsible>
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle" }));
    expect(screen.getByRole("button", { name: "Toggle" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("region").textContent).toBe("Hidden detail");
  });

  it("supports a controlled open state", () => {
    render(
      <Collapsible open>
        <CollapsibleTrigger asChild>
          <button type="button">Toggle</button>
        </CollapsibleTrigger>
        <CollapsibleContent>Always shown</CollapsibleContent>
      </Collapsible>
    );
    expect(screen.getByText("Always shown")).toBeInTheDocument();
  });
});
