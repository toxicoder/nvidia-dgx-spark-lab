import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DASHBOARD_THEMES } from "@/lib/themes";

vi.mock("../ThemeProvider", async () => {
  const actual = await vi.importActual<typeof import("../ThemeProvider")>("../ThemeProvider");
  return {
    ...actual,
    useTheme: () => ({
      themeId: "missing-theme",
      setThemeId: vi.fn(),
      theme: DASHBOARD_THEMES[0],
      themes: DASHBOARD_THEMES
    })
  };
});

import { ThemeSelector } from "../ThemeSelector";

describe("ThemeSelector unknown theme", () => {
  it("renders without swatch when current theme is unknown", () => {
    render(<ThemeSelector />);
    const trigger = screen.getByTestId("theme-selector");
    expect(trigger.querySelector(".rounded-full.ring-1")).toBeNull();
  });
});
