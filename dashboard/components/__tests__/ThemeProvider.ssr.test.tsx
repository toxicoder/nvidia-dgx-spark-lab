/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { DEFAULT_THEME_ID } from "@/lib/themes";

describe("ThemeProvider SSR", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("defaults theme when window is undefined", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();
    const { ThemeProvider, useTheme } = await import("../ThemeProvider");

    function Probe() {
      const { themeId } = useTheme();
      return React.createElement("span", { "data-theme-id": themeId });
    }

    const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(Probe)));
    expect(html).toContain(`data-theme-id="${DEFAULT_THEME_ID}"`);
  });
});
