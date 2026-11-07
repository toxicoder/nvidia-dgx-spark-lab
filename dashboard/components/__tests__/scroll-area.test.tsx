import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ScrollArea, ScrollBar } from "../ui/scroll-area";

describe("ScrollArea", () => {
  it("renders its children inside the viewport", () => {
    render(
      <ScrollArea className="h-24">
        <ul>
          <li>svc-a</li>
          <li>svc-b</li>
        </ul>
      </ScrollArea>
    );

    expect(screen.getByText("svc-a")).toBeInTheDocument();
    expect(screen.getByText("svc-b")).toBeInTheDocument();
    expect(screen.getByTestId("ui-scroll-area").className).toContain("h-24");
    expect(screen.getByTestId("ui-scroll-area-viewport").className).toContain("h-full");
  });

  it("makes the clipped region keyboard-scrollable", () => {
    render(
      <ScrollArea className="h-24">
        <p>long content</p>
      </ScrollArea>
    );
    // The audit defect: a max-h list with overflow-auto and no tabIndex, so a keyboard
    // operator could not reach the rows below the fold.
    expect(screen.getByTestId("ui-scroll-area-viewport")).toHaveAttribute("tabindex", "0");
  });

  it("becomes a labelled landmark region when given a name", () => {
    render(
      <ScrollArea label="Running services" className="h-24">
        <p>services</p>
      </ScrollArea>
    );
    expect(screen.getByRole("region", { name: "Running services" })).toBeInTheDocument();
  });

  it("does not emit an unlabelled region landmark", () => {
    render(
      <ScrollArea className="h-24">
        <p>services</p>
      </ScrollArea>
    );
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.getByTestId("ui-scroll-area-viewport")).not.toHaveAttribute("aria-label");
  });

  it("renders the bar for the chosen orientation", () => {
    render(
      <ScrollArea type="always" className="h-24">
        <p>content</p>
      </ScrollArea>
    );
    const bar = screen.getByTestId("ui-scroll-area").querySelector("[data-orientation='vertical']");
    expect(bar).not.toBeNull();
    expect(bar).toHaveAttribute("aria-hidden", "true");
  });

  it("supports an explicit horizontal bar", () => {
    render(
      <ScrollArea type="always" className="h-24">
        <p>wide content</p>
        <ScrollBar orientation="horizontal" data-testid="hbar" />
      </ScrollArea>
    );
    expect(screen.getByTestId("hbar")).toHaveAttribute("data-orientation", "horizontal");
  });
});
