"use client";

/**
 * The one capacity-gated start flow.
 *
 * InferencePanel and NemotronStackPanel each hand-wrote `checkCapacityAction` ->
 * `setLastCheck` -> gate dialog -> heavy confirm -> start, and the copies had already
 * drifted: one tested `heavy` before the gate verdict, the other after. Worse, neither
 * set a busy flag before the `await`, so during the capacity round trip every start
 * button stayed live and a double click could submit two multi-GPU Jobs on a 2-GPU
 * Spark. The Resource Guard is a non-negotiable invariant, so the ordering and the
 * in-flight guard are pinned here: verdict first, heavy second, start last, and
 * `checking` armed synchronously before any await.
 *
 * The checker is injected rather than imported so this module stays free of server
 * actions and the gate is unit-testable without mocking a module graph.
 */

import * as React from "react";

import type { CapacityCheck } from "@/lib/types";

/** Reads the authoritative gate verdict for one action token. */
export type CapacityChecker = (action: string) => Promise<CapacityCheck>;

/** Options for {@link useCapacityGatedAction}. */
export interface CapacityGatedActionOptions {
  /** Capacity action token, e.g. `model:qwen3-32b` or `stack:nemotron-agentic-spark-1`. */
  action: string;
  /** Whether the workload is heavy enough to need the typed confirmation. */
  heavy: boolean;
  /** Runs the real start once the gate passed and no heavy confirm is needed. */
  onProceed: () => void | Promise<void>;
  /** Opens the capacity gate dialog with the failing check. */
  onBlocked: (check: CapacityCheck) => void;
  /** Opens the heavy-workload confirm; the caller starts on its confirmation. */
  onHeavy: () => void;
  /** Reports a gate that could not be evaluated; the action is never started. */
  onError?: ((error: unknown) => void) | undefined;
}

/** What {@link useCapacityGatedAction} gives the panel back. */
export interface CapacityGatedActionResult {
  /** `true` from the first synchronous tick of a check until it settles. */
  checking: boolean;
  /** The verdict behind the open dialog, or `null` when no gate is showing. */
  lastCheck: CapacityCheck | null;
  /** Start button handler: gate, then heavy confirm, then proceed. */
  begin: () => Promise<void>;
  /** Re-runs the gate after the operator freed resources; keeps the dialog open on failure. */
  recheck: () => Promise<void>;
  /** Drops the remembered verdict, e.g. when the dialog closes. */
  reset: () => void;
}

/**
 * A verdict we can trust: an object carrying a boolean `ok` and a string `action`.
 * @param candidate - Whatever the capacity checker resolved to.
 * @returns `true` when the value is shaped like a {@link CapacityCheck}.
 */
function isCapacityCheck(candidate: unknown): candidate is CapacityCheck {
  if (typeof candidate !== "object" || candidate === null) return false;
  const shape = candidate as Partial<CapacityCheck>;
  return typeof shape.ok === "boolean" && typeof shape.action === "string";
}

/**
 * Build the gated start/recheck pair for one workload.
 * @param checkCapacity - Authoritative capacity reader, injected by the caller.
 * @param options - Action token, heavy tier, and the four outcome callbacks.
 * @returns `checking`, the last verdict, and the `begin`/`recheck`/`reset` handlers.
 */
export function useCapacityGatedAction(
  checkCapacity: CapacityChecker,
  options: CapacityGatedActionOptions
): CapacityGatedActionResult {
  const { action, heavy, onProceed, onBlocked, onHeavy, onError } = options;

  const [checking, setChecking] = React.useState(false);
  const [lastCheck, setLastCheck] = React.useState<CapacityCheck | null>(null);
  const inFlightRef = React.useRef(false);

  const evaluate = React.useCallback(async (): Promise<void> => {
    // Arm the guard before the await so the caller's button is disabled for the whole
    // round trip, and reject re-entry outright: two clicks must not mean two Jobs.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setChecking(true);
    try {
      const check = await checkCapacity(action);
      if (!isCapacityCheck(check)) {
        // Malformed verdict: fail closed, never start on a guess.
        setLastCheck(null);
        onError?.(new Error(`Capacity check returned an unusable result for ${action}`));
        return;
      }
      setLastCheck(check);
      if (check.ok !== true) {
        onBlocked(check);
        return;
      }
      if (heavy) {
        onHeavy();
        return;
      }
      await onProceed();
    } catch (e) {
      // Fail closed: an unreachable Resource Guard is not a pass.
      setLastCheck(null);
      onError?.(e);
    } finally {
      inFlightRef.current = false;
      setChecking(false);
    }
  }, [action, heavy, checkCapacity, onProceed, onBlocked, onHeavy, onError]);

  return {
    checking,
    lastCheck,
    begin: evaluate,
    recheck: evaluate,
    reset: React.useCallback(() => {
      setLastCheck(null);
    }, [])
  };
}
