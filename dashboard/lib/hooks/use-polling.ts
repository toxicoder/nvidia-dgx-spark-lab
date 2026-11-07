"use client";

/**
 * The one polling hook for dashboard panels.
 *
 * Five panels each re-implemented `useState` + `useCallback` + `setInterval` and
 * every copy had the same two defects: a host utility that goes down re-toasts the
 * same failure every tick forever, and the panel keeps asserting "running" / "2 GPUs
 * available" from a payload of unknown age with no stale marker anywhere. This hook
 * reports a failure once per outage, exposes `lastUpdatedAt` plus a `stale` flag, and
 * stops polling while the tab is hidden so a backgrounded dashboard costs nothing.
 */

import * as React from "react";

/** How long a payload may sit before it is presented as stale. */
const DEFAULT_STALE_MULTIPLIER = 3;

/** Options for {@link usePolling}. */
export interface UsePollingOptions<T> {
  /** Poll cadence. Defaults to 10s, the panels' original rate. */
  intervalMs?: number;
  /** Server-rendered first value; the hook does not fetch on mount by default. */
  initialData?: T | undefined;
  /** Set `false` to park the timer, e.g. a panel that only polls mid-transition. */
  enabled?: boolean;
  /**
   * Called once when polling starts failing, not once per tick. Fires again after a
   * successful poll, so a second outage is reported rather than silently absorbed.
   */
  onError?: ((error: unknown) => void) | undefined;
  /** Payload age past which `stale` flips. Defaults to three intervals. */
  staleAfterMs?: number;
}

/** What {@link usePolling} gives a panel back. */
export interface UsePollingResult<T> {
  /** Last value the fetcher returned, or `initialData` before that. */
  data: T | undefined;
  /** `true` while a fetch is in flight. */
  busy: boolean;
  /** Message from the most recent failure, `null` while healthy. */
  error: string | null;
  /** Wall-clock ms of the last success, `null` until the first one lands. */
  lastUpdatedAt: number | null;
  /** `true` when the payload is older than `staleAfterMs` or polling is failing. */
  stale: boolean;
  /** Imperative refresh for a Refresh button; concurrent calls collapse into one. */
  refresh: () => Promise<void>;
}

/**
 * Poll `fetcher` on a fixed cadence, pausing while the document is hidden.
 * @param fetcher - Reads the panel's host state; may reject.
 * @param options - Cadence, gating, initial data, and failure reporting.
 * @returns The live payload plus busy/error/staleness state and a manual refresh.
 */
export function usePolling<T>(fetcher: () => Promise<T>, options: UsePollingOptions<T> = {}): UsePollingResult<T> {
  const { intervalMs = 10_000, initialData, enabled = true, onError, staleAfterMs } = options;

  const [data, setData] = React.useState<T | undefined>(initialData);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<number | null>(null);
  const [stale, setStale] = React.useState(false);

  const inFlightRef = React.useRef(false);
  const reportedRef = React.useRef(false);

  const run = React.useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const next = await fetcher();
      setData(next);
      setLastUpdatedAt(Date.now());
      setError(null);
      setStale(false);
      reportedRef.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStale(true);
      if (!reportedRef.current) {
        reportedRef.current = true;
        onError?.(e);
      }
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }, [fetcher, onError]);

  React.useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = (): void => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };
    const start = (): void => {
      if (timer !== null) return;
      timer = setInterval(() => void run(), intervalMs);
    };
    const onVisibilityChange = (): void => {
      if (document.hidden) stop();
      else {
        start();
        void run();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    if (!document.hidden) start();
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stop();
    };
  }, [enabled, intervalMs, run]);

  React.useEffect(() => {
    if (lastUpdatedAt === null) return;
    const budget = staleAfterMs ?? intervalMs * DEFAULT_STALE_MULTIPLIER;
    const remaining = budget - (Date.now() - lastUpdatedAt);
    if (remaining <= 0) {
      setStale(true);
      return;
    }
    const id = setTimeout(() => setStale(true), remaining);
    return () => clearTimeout(id);
  }, [lastUpdatedAt, staleAfterMs, intervalMs]);

  return { data, busy, error, lastUpdatedAt, stale, refresh: run };
}
