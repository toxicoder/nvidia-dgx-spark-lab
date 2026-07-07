import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ThemeProvider, applyThemeToDocument, useTheme } from "../ThemeProvider";

function BrokenConsumer() {
  useTheme();
  return null;
}
import * as themes from "@/lib/themes";
import { DEFAULT_THEME_ID, THEME_STORAGE_KEY } from "@/lib/themes";

function ThemeProbe() {
  const { themeId, theme, setThemeId } = useTheme();
  return (
    <div>
      <span data-testid="theme-id">{themeId}</span>
      <span data-testid="theme-label">{theme.label}</span>
      <button type="button" onClick={() => setThemeId("daylight")}>
        Set daylight
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.add("dark");
  });

  it("defaults to spark-lime when no preference is stored", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme-id")).toHaveTextContent(DEFAULT_THEME_ID);
    expect(screen.getByTestId("theme-label")).toHaveTextContent("Spark Lime");
  });

  it("restores theme from localStorage", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "ocean-teal");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme-id")).toHaveTextContent("ocean-teal");
    expect(document.documentElement.getAttribute("data-theme")).toBe("ocean-teal");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("persists theme changes and toggles light mode class", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /set daylight/i }));
    });

    expect(screen.getByTestId("theme-id")).toHaveTextContent("daylight");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("daylight");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("falls back when localStorage is unavailable", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme-id")).toHaveTextContent(DEFAULT_THEME_ID);
    getItem.mockRestore();
  });

  it("ignores invalid stored theme ids", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "not-a-real-theme");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme-id")).toHaveTextContent(DEFAULT_THEME_ID);
  });

  it("throws when useTheme is used outside provider", () => {
    expect(() => render(<BrokenConsumer />)).toThrow(/ThemeProvider/);
  });

  it("setThemeId falls back for invalid ids and survives localStorage write errors", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /set daylight/i }));
    });
    expect(screen.getByTestId("theme-id")).toHaveTextContent("daylight");
    setItem.mockRestore();
  });

  it("applyThemeToDocument sets html attributes", () => {
    applyThemeToDocument("paper-sand");
    expect(document.documentElement.getAttribute("data-theme")).toBe("paper-sand");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    applyThemeToDocument("violet-dusk");
    expect(document.documentElement.getAttribute("data-theme")).toBe("violet-dusk");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("applyThemeToDocument falls back for unknown theme ids", () => {
    applyThemeToDocument("not-a-real-theme");
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_ID);
  });

  it("uses theme object fallback when stored id is invalid at runtime", () => {
    function InvalidRuntimeProbe() {
      const { theme, setThemeId } = useTheme();
      return (
        <div>
          <span data-testid="theme-label">{theme.label}</span>
          <button type="button" onClick={() => setThemeId("not-a-real-theme")}>
            Set invalid
          </button>
        </div>
      );
    }
    render(
      <ThemeProvider>
        <InvalidRuntimeProbe />
      </ThemeProvider>
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /set invalid/i }));
    });
    expect(screen.getByTestId("theme-label")).toHaveTextContent("Spark Lime");
  });

  it("falls back theme object when getThemeById returns null for stored id", () => {
    const getThemeByIdSpy = vi.spyOn(themes, "getThemeById").mockImplementation((id: string) => {
      if (id === "ocean-teal") return undefined;
      return themes.DASHBOARD_THEMES.find((t) => t.id === id);
    });
    localStorage.setItem(THEME_STORAGE_KEY, "ocean-teal");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme-label")).toHaveTextContent("Spark Lime");
    getThemeByIdSpy.mockRestore();
  });

  it("setThemeId ignores invalid theme ids", () => {
    function InvalidProbe() {
      const { themeId, setThemeId } = useTheme();
      return (
        <div>
          <span data-testid="theme-id">{themeId}</span>
          <button type="button" onClick={() => setThemeId("not-a-real-theme")}>
            Set invalid
          </button>
        </div>
      );
    }
    render(
      <ThemeProvider>
        <InvalidProbe />
      </ThemeProvider>
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /set invalid/i }));
    });
    expect(screen.getByTestId("theme-id")).toHaveTextContent(DEFAULT_THEME_ID);
  });
});
