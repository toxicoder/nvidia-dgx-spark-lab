/**
 * Result wrapper that lets a section degrade instead of taking its route down.
 *
 * Every section module reads host state directly (docker, kubectl, a walk of
 * `/mnt/models`). Any one of those can hang or throw, and before the sections
 * were split out a single failure replaced the whole console. A section that
 * `await`s through {@link attempt} renders an `ErrorState` in its own frame
 * while its neighbours still show real data.
 */

import type { DashboardSectionSlug } from "@/lib/types";

/** Outcome of one section's data load. */
export type SectionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Run a host read, capturing a failure as a value instead of throwing it.
 *
 * The error text is kept because the operator needs to see *what* failed — a
 * bare "unavailable" tells them nothing about whether to restart kubelet or
 * remount `/mnt/models`. It is truncated so a kubectl dump cannot fill the card.
 *
 * @param run - The host read to attempt.
 * @returns `{ ok: true, data }`, or `{ ok: false, error }` with a short message.
 */
export async function attempt<T>(run: () => Promise<T> | T): Promise<SectionResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (cause) {
    return { ok: false, error: describeError(cause) };
  }
}

/**
 * The message to show when a section could not load.
 *
 * @param slug - Section that failed, used for the default headline.
 * @param error - Message from {@link attempt}, or `undefined` for an unknown cause.
 * @returns A short human sentence naming the section and the cause.
 */
export function sectionFailureMessage(slug: DashboardSectionSlug, error?: string): string {
  const cause = error && error.length > 0 ? error : "the host did not respond";
  return `${slug} could not load: ${cause}`;
}

/**
 * First failure message among a group of section loads.
 *
 * A section often needs several reads for one panel (the Nemotron stack wants a
 * catalog, a stack status, and capacity). Reporting only the first thing that
 * broke is both simpler for the operator and the only answer that survives
 * TypeScript's narrowing of the discriminated union.
 *
 * @param results - The results that feed one panel.
 * @returns The first failure message, or `undefined` when all succeeded.
 */
export function firstError(results: readonly SectionResult<unknown>[]): string | undefined {
  for (const result of results) {
    if (!result.ok) return result.error;
  }
  return undefined;
}

/** Longest error fragment worth putting on screen; a full dump belongs in the console. */
const MAX_ERROR_CHARS = 240;

/**
 * Normalise anything thrown into a single-line string.
 *
 * @param cause - Whatever was thrown; `Error` is the common case.
 * @returns A single-line, length-bounded description of the cause.
 */
function describeError(cause: unknown): string {
  const raw =
    cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "unknown error (check the server log)";
  const oneLine = raw.replace(/\s+/g, " ").trim();
  if (oneLine.length === 0) return "unknown error (check the server log)";
  return oneLine.length > MAX_ERROR_CHARS ? `${oneLine.slice(0, MAX_ERROR_CHARS - 1)}…` : oneLine;
}
