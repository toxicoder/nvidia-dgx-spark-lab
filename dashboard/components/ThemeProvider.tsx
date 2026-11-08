/**
 * MD3 theme context — persists selection in localStorage and applies tokens to document root.
 */
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore
} from "react";
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
 * Used as the client snapshot of {@link ThemeProvider}'s store, so it runs after hydration;
 * the try/catch covers browsers that deny storage in private mode rather than a missing
 * window, which {@link getServerThemeSnapshot} is what keeps off the server.
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

/**
 * Subscribers in this tab.
 *
 * `storage` events only reach *other* tabs, so an in-tab write has to notify its own
 * subscribers or the store would keep handing out the value it read before the write.
 */
const themeSubscribers = new Set<() => void>();

/** Bind the stored theme key to React's store-change channel. */
function subscribeTheme(onStoreChange: () => void): () => void {
  const onStorage = (event: StorageEvent): void => {
    if (event.key === THEME_STORAGE_KEY) onStoreChange();
  };
  themeSubscribers.add(onStoreChange);
  window.addEventListener("storage", onStorage);
  return () => {
    themeSubscribers.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Tell this tab's subscribers that the stored theme moved. */
function notifyThemeChange(): void {
  for (const notify of themeSubscribers) notify();
}

/** Client snapshot: whatever the operator stored, defaulted when absent or unknown. */
function getThemeSnapshot(): string {
  return readStoredThemeId();
}

/**
 * Server and hydration snapshot: the default theme.
 *
 * The server has no localStorage, so server HTML and the first client pass must agree on
 * this value; reading the stored choice during render is what desynchronised the two and
 * cost every route a hydration mismatch. The pre-paint script in `app/layout.tsx` has
 * already put the operator's real choice on screen by the time this is consulted.
 */
function getServerThemeSnapshot(): string {
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
  // The stored choice is external state, so it arrives through the store rather than through
  // a setState in an effect. `getServerThemeSnapshot` keeps server HTML and the first client
  // pass identical, which is what the earlier render-time read used to break.
  const storedId = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  // The operator's click for this session. It is held separately because a browser that
  // denies storage (private mode) still has to follow the click, so the value cannot live in
  // storage alone. It is set from the click handler, never from an effect.
  const [chosenId, setChosenId] = useState<string | null>(null);
  const themeId = chosenId ?? storedId;

  // Applying the tokens to the document is an external system following React state, which is
  // the one thing an effect body is for here.
  useEffect(() => {
    applyThemeToDocument(themeId);
  }, [themeId]);

  const setThemeId = useCallback((id: string) => {
    const next = isValidThemeId(id) ? id : DEFAULT_THEME_ID;
    setChosenId(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyThemeToDocument(next);
    notifyThemeChange();
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
