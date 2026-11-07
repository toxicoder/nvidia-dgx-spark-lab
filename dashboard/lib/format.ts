/** Shared display formatters for dashboard panels. */

import type { K8sQuantity } from "@/lib/types";

/**
 * Kubernetes quantity suffix -> the label to show it with. Binary suffixes keep their
 * own tier (`512Mi` stays MiB) so a small request never reads as `0.0 GiB`; only the
 * spelling and the fraction digits are normalised.
 */
const QUANTITY_SUFFIXES: Readonly<Record<string, string>> = {
  Ki: "KiB",
  Mi: "MiB",
  Gi: "GiB",
  Ti: "TiB",
  Pi: "PiB",
  K: "kB",
  M: "MB",
  G: "GB",
  T: "TB",
  P: "PB"
};

/** Byte thresholds, largest first, so the first match is the right tier. */
const SIZE_TIERS: readonly (readonly [label: string, factor: number])[] = [
  ["TB", 1024 ** 4],
  ["GB", 1024 ** 3],
  ["MB", 1024 ** 2],
  ["KB", 1024]
];

/** A k8s quantity is a decimal number with an optional unit suffix. */
const QUANTITY_PATTERN = /^([0-9]*\.?[0-9]+)([A-Za-z]*)$/;

/**
 * Format byte counts for human-readable panel display.
 *
 * `/mnt/models` on a DGX Spark is the directory that goes multi-terabyte, so the scale
 * runs up to TB; without that tier a 4 TB model directory read `4096.00 GB`.
 * @param bytes - Byte count as reported by the host.
 * @param decimals - Fraction digits for the MB, GB and TB tiers.
 * @returns A human-readable size such as `4.00 TB`, `500.0 MB` or `512 B`.
 */
export function humanSize(bytes: number, decimals = 2): string {
  for (const [label, factor] of SIZE_TIERS) {
    if (bytes >= factor) return `${(bytes / factor).toFixed(decimals)} ${label}`;
  }
  return bytes >= 1 ? `${bytes} B` : "0 B";
}

/**
 * Format a Unix timestamp as a fixed UTC string.
 *
 * Deliberately not `toLocaleString()`: that rendered one instant two ways depending on
 * the browser locale and the operator timezone, so the same run could read differently
 * in the run history than in a tooltip on the same page.
 * @param unixSec - Seconds since the epoch; absent or zero renders as an em dash.
 * @returns `YYYY-MM-DD HH:MM:SS UTC`, or `—` when there is no timestamp.
 */
export function formatTimestamp(unixSec?: number | null): string {
  if (!unixSec) return "—";
  const iso = new Date(unixSec * 1000).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;
}

/**
 * Render a Kubernetes quantity with one consistent convention.
 *
 * Capacity arrives as bare strings — `"60.8Gi"`, `"17.7"`, `"28"` — and the capacity
 * cards templated them three different ways in one row, including mixed precision
 * (`17.7 cores / of 28 cores`). Normalising spacing, suffix and fraction digits makes
 * the GPU, CPU and memory cards read as one family.
 * @param quantity - The raw k8s quantity; `m` means milli, `Gi` binary gibibytes.
 * @param decimals - Fraction digits; fixed so a column of values lines up.
 * @returns A stable display string, `—` for nothing, or the input when unparsable.
 */
export function formatK8sQuantity(quantity: K8sQuantity | null | undefined, decimals = 1): string {
  const raw = quantity?.trim();
  if (!raw) return "—";

  const match = QUANTITY_PATTERN.exec(raw);
  if (!match) return raw;

  const [, number = "0", suffix = ""] = match;
  const amount = Number(number);
  if (suffix === "m") return (amount / 1000).toFixed(decimals);
  if (suffix === "") return amount.toFixed(decimals);

  const label = QUANTITY_SUFFIXES[suffix];
  return label === undefined ? raw : `${amount.toFixed(decimals)} ${label}`;
}

/**
 * Truncate long utility output for SQLite persistence and UI previews.
 * @param s - The text to cap.
 * @param max - Maximum characters kept before the ellipsis.
 * @returns `s`, or its first `max` characters followed by an ellipsis.
 */
export function truncateOutput(s: string, max = 4096): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
