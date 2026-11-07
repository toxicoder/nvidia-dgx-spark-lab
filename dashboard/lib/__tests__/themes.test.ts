import { describe, it, expect } from "vitest";
import {
  getThemeById,
  isValidThemeId,
  isLightThemeId,
  DASHBOARD_THEMES,
  DASHBOARD_THEME_IDS,
  LIGHT_THEME_IDS,
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY
} from "../themes";
import { itemAt } from "./test-assert";

describe("themes", () => {
  it("getThemeById returns known theme", () => {
    const theme = getThemeById(DEFAULT_THEME_ID);
    expect(theme?.id).toBe("spark-lime");
  });

  it("getThemeById returns undefined for unknown", () => {
    expect(getThemeById("nonexistent")).toBeUndefined();
  });

  it("isValidThemeId checks membership", () => {
    expect(isValidThemeId(itemAt(DASHBOARD_THEMES, 0).id)).toBe(true);
    expect(isValidThemeId("bogus")).toBe(false);
  });

  it("isLightThemeId follows the catalog mode, not a hand-copied list", () => {
    for (const theme of DASHBOARD_THEMES) {
      expect(isLightThemeId(theme.id), `${theme.id} is mode ${theme.mode}`).toBe(theme.mode === "light");
    }
    expect(isLightThemeId("bogus")).toBe(false);
    expect([...LIGHT_THEME_IDS]).toEqual(DASHBOARD_THEMES.filter((t) => t.mode === "light").map((t) => t.id));
  });

  it("derives the id list from the catalog in catalog order", () => {
    expect([...DASHBOARD_THEME_IDS]).toEqual(DASHBOARD_THEMES.map((theme) => theme.id));
    expect(new Set(DASHBOARD_THEME_IDS).size, "duplicate theme id in the catalog").toBe(DASHBOARD_THEME_IDS.length);
  });

  it("describes every theme well enough to render the selector", () => {
    expect(DASHBOARD_THEMES.length, "theme catalog must not be empty").toBeGreaterThan(1);
    expect(THEME_STORAGE_KEY).toBe("dgx-dashboard-theme");
    expect(DASHBOARD_THEME_IDS).toContain(DEFAULT_THEME_ID);
    for (const theme of DASHBOARD_THEMES) {
      expect(theme.label.length, `${theme.id} label`).toBeGreaterThan(0);
      expect(theme.description.length, `${theme.id} description`).toBeGreaterThan(0);
      expect(theme.swatch, `${theme.id} swatch`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
