/**
 * MD3 theme context — persists selection in localStorage and applies tokens to document root.
 */
"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DASHBOARD_THEMES,
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
  getThemeById,
  isValidThemeId,
  type DashboardTheme
} from "@/lib/themes";

interface ThemeContextValue {
  theme: DashboardTheme;
  themeId: string;
  setThemeId: (id: string) => void;
  themes: DashboardTheme[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Read the operator's stored theme choice.
 *
 * Only ever called from an effect, so `localStorage` is guaranteed to exist; the try/catch
 * covers browsers that deny storage in private mode rather than a missing window.
 * @returns The stored id when it is still in the catalog, otherwise the default.
 */
function readStoredThemeId(): string {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && isValidThemeId(stored)) return stored;
  } catch {
    /* localStorage unavailable */
  }
  return DEFAULT_THEME_ID;
}

/** Sets `data-theme` and dark-mode class on `document.documentElement`. */
export function applyThemeToDocument(themeId: string): void {
  const theme = getThemeById(themeId) ?? getThemeById(DEFAULT_THEME_ID)!;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.id);
  root.classList.toggle("dark", theme.mode === "dark");
}

/** Provides theme state and syncs DOM + localStorage when the active theme changes. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The server has no localStorage, so the first client pass must agree with the HTML it
  // was handed. Reading the stored choice during render made the two differ and cost
  // every route a hydration mismatch plus a full client re-render. The pre-paint script
  // in `app/layout.tsx` already put the right theme on screen before this runs.
  const [themeId, setThemeIdState] = useState<string>(DEFAULT_THEME_ID);

  useEffect(() => {
    setThemeIdState(readStoredThemeId());
  }, []);

  useEffect(() => {
    applyThemeToDocument(themeId);
  }, [themeId]);

  const setThemeId = useCallback((id: string) => {
    const next = isValidThemeId(id) ? id : DEFAULT_THEME_ID;
    setThemeIdState(next);
    applyThemeToDocument(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const theme = getThemeById(themeId) ?? getThemeById(DEFAULT_THEME_ID)!;

  const value = useMemo(
    () => ({
      theme,
      themeId,
      setThemeId,
      themes: DASHBOARD_THEMES
    }),
    [theme, themeId, setThemeId]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Returns current theme, catalog, and setter; must be used within ThemeProvider. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
