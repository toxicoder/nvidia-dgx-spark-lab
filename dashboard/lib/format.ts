/** Shared display formatters for dashboard panels. */

/** Format byte counts for human-readable panel display. */
export function humanSize(bytes: number, gbDecimals = 2): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(gbDecimals)} GB`;
}

/** Format a Unix timestamp for panel display, or an em dash when absent. */
export function formatTimestamp(unixSec?: number | null): string {
  if (!unixSec) return "—";
  return new Date(unixSec * 1000).toLocaleString();
}

/** Truncate long utility output for SQLite persistence and UI previews. */
export function truncateOutput(s: string, max = 4096): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
