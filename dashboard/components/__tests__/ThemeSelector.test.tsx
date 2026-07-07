import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "../ThemeProvider";
import { ThemeSelector } from "../ThemeSelector";

describe("ThemeSelector", () => {
  it("renders compact selector with current theme swatch", () => {
    render(
      <ThemeProvider>
        <ThemeSelector compact className="test-class" />
      </ThemeProvider>
    );
    const trigger = screen.getByTestId("theme-selector");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveClass("test-class");
    expect(trigger).toHaveAttribute("aria-label", "Select color theme");
  });

  it("renders non-compact selector", () => {
    render(
      <ThemeProvider>
        <ThemeSelector />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme-selector")).toBeInTheDocument();
  });
});
