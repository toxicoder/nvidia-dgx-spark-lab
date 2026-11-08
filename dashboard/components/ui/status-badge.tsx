import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { panelRadiusClass } from "@/components/panel-styles";

/**
 * The single status mapper.
 *
 * Four panels each wrote their own `stateBadge` / `statusVariant` function, the state
 * coverage drifted between them, and the result was a P0: `InferencePanel` rendered an
 * `error` Job and an `absent` Job as the same grey "stopped" badge, so a GPU job that
 * crashed looked exactly like one the operator had stopped on purpose. The map is
 * supplied by the caller as `Record<State, Descriptor>`, so a state added to a closed
 * set in `lib/types` is a compile error here rather than a silent fallthrough.
 *
 * Loudness tracks risk — `danger` and `warning` shout, `ok`/`info`/`neutral`/`muted`
 * recede — and every badge carries an icon plus its text, because colour alone is not
 * a signal an operator with a colour vision deficiency can read.
 */

/** The variant vocabulary this component supports. */
export const STATUS_BADGE_VARIANTS = ["neutral", "info", "ok", "warning", "danger", "muted"] as const;

/** One member of {@link STATUS_BADGE_VARIANTS}. */
export type StatusBadgeVariant = (typeof STATUS_BADGE_VARIANTS)[number];

/** How one state of a closed set should look and read. */
export interface StatusBadgeDescriptor {
  /** Text shown next to the icon; never omit it — colour is not the carrier. */
  label: string;
  /** Visual weight tier from {@link STATUS_BADGE_VARIANTS}. */
  variant: StatusBadgeVariant;
  /** Optional leading glyph; strongly advised for anything the operator scans. */
  icon?: LucideIcon | undefined;
}

/**
 * Exhaustive per-state descriptor map. `Record<State, …>` makes a missing state a
 * compile error, which is the whole point of taking the map from the caller.
 */
export type StatusBadgeMap<State extends string> = Readonly<Record<State, StatusBadgeDescriptor>>;

/** Props for {@link StatusBadge}. */
export interface StatusBadgeProps<State extends string> {
  /** The state to render; must be a key of `map`. */
  state: State;
  /** The caller's exhaustive map for that state union. */
  map: StatusBadgeMap<State>;
  /** Extra classes for call-site nudges. */
  className?: string;
}

/** One class pair per variant. */
const VARIANT_CLASSES: Readonly<Record<StatusBadgeVariant, string>> = {
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-transparent bg-secondary text-secondary-foreground",
  ok: "border-primary/40 bg-primary/15 text-primary",
  warning: "border-warning/50 bg-warning/15 text-warning",
  danger: "border-transparent bg-destructive text-destructive-foreground",
  muted: "border-border bg-transparent text-muted-foreground"
};

/**
 * Render one state of a closed set as icon + text, with risk-matched loudness.
 * @param props - The state, the caller's exhaustive map, and optional classes.
 * @param props.state - State key to look up.
 * @param props.map - Exhaustive descriptor map for the whole state union.
 * @param props.className - Classes appended to the badge.
 * @returns The badge element.
 * @throws When the state is missing from the map; unreachable while the map is typed
 * exhaustively, but a boundary payload that smuggles a new value must not render blank.
 */
export function StatusBadge<State extends string>({
  state,
  map,
  className
}: StatusBadgeProps<State>): React.JSX.Element {
  const descriptor = map[state];
  if (!descriptor) {
    throw new Error(`StatusBadge: state "${state}" is missing from the status map`);
  }

  const Icon = descriptor.icon;

  return (
    <span
      data-slot="status-badge"
      data-testid="status-badge"
      data-state={state}
      data-variant={descriptor.variant}
      className={cn(
        "inline-flex items-center gap-1 border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        panelRadiusClass,
        VARIANT_CLASSES[descriptor.variant],
        className
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="h-3 w-3 shrink-0" /> : null}
      {descriptor.label}
    </span>
  );
}
