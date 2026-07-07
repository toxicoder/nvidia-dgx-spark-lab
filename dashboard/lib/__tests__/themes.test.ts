import { describe, it, expect } from "vitest";
import { getThemeById, isValidThemeId, DASHBOARD_THEMES, DEFAULT_THEME_ID } from "../themes";

describe("themes", () => {
  it("getThemeById returns known theme", () => {
    const theme = getThemeById(DEFAULT_THEME_ID);
    expect(theme?.id).toBe("spark-lime");
  });

  it("getThemeById returns undefined for unknown", () => {
    expect(getThemeById("nonexistent")).toBeUndefined();
  });

  it("isValidThemeId checks membership", () => {
    expect(isValidThemeId(DASHBOARD_THEMES[0].id)).toBe(true);
    expect(isValidThemeId("bogus")).toBe(false);
  });
});
