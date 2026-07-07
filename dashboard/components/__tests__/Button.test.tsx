import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "../ui/button";

/**
 * Fully rendered tests for the shadcn Button (MD3-inspired variants).
 * Covers default/filled, tonal, outlined, text, sizes, and asChild.
 */

describe("Button (shadcn + MD3 variants)", () => {
  it("renders default/filled button with text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: /Click me/i })).toBeInTheDocument();
  });

  it("supports tonal (MD3) and outlined variants", () => {
    render(
      <>
        <Button variant="tonal">Tonal</Button>
        <Button variant="outline">Outlined</Button>
      </>
    );
    expect(screen.getByRole("button", { name: "Tonal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Outlined" })).toBeInTheDocument();
  });

  it("supports text/ghost and sizes", () => {
    render(
      <>
        <Button variant="text" size="sm">
          Text Sm
        </Button>
        <Button variant="ghost" size="lg">
          Ghost Lg
        </Button>
      </>
    );
    expect(screen.getByText("Text Sm")).toBeInTheDocument();
    expect(screen.getByText("Ghost Lg")).toBeInTheDocument();
  });

  it("renders asChild using Slot (no extra wrapper)", () => {
    render(
      <Button asChild>
        <a href="#test">Link as button</a>
      </Button>
    );
    const link = screen.getByRole("link", { name: /Link as button/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("#test");
  });
});
