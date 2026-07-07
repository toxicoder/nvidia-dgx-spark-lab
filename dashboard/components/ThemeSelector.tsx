/**
 * Theme picker dropdown — grouped light/dark MD3 palettes for the dashboard shell.
 */
"use client";

import { Palette } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ThemeSelectorProps {
  className?: string;
  compact?: boolean;
}

/** Select control bound to ThemeProvider with optional compact layout. */
export function ThemeSelector({ className, compact = false }: ThemeSelectorProps) {
  const { themeId, setThemeId, themes } = useTheme();

  const darkThemes = themes.filter((t) => t.mode === "dark");
  const lightThemes = themes.filter((t) => t.mode === "light");

  const current = themes.find((t) => t.id === themeId);

  return (
    <Select value={themeId} onValueChange={setThemeId}>
      <SelectTrigger
        data-testid="theme-selector"
        aria-label="Select color theme"
        className={cn(
          "gap-1.5 py-0 [&>span]:line-clamp-none",
          compact ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-xs",
          className
        )}
      >
        <Palette className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        {current ? (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-[var(--md-sys-color-outline-variant)]"
            style={{ background: current.swatch }}
            aria-hidden
          />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-left">
          <SelectValue placeholder="Theme" />
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Dark</SelectLabel>
          {darkThemes.map((t) => (
            <SelectItem key={t.id} value={t.id} textValue={t.label}>
              <span className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full ring-1 ring-[var(--md-sys-color-outline-variant)]"
                  style={{ background: t.swatch }}
                  aria-hidden
                />
                <span>{t.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Light</SelectLabel>
          {lightThemes.map((t) => (
            <SelectItem key={t.id} value={t.id} textValue={t.label}>
              <span className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full ring-1 ring-[var(--md-sys-color-outline-variant)]"
                  style={{ background: t.swatch }}
                  aria-hidden
                />
                <span>{t.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
