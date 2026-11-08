import * as React from "react";

import { cn } from "@/lib/utils";
import {
  hintClass,
  metricLabelClass,
  metricUnitClass,
  metricValueClass,
  surfaceCardClass
} from "@/components/panel-styles";

/** Tones a metric can take; loudness tracks risk, not health. */
export const METRIC_TILE_TONES = ["neutral", "ok", "warning", "danger"] as const;

/** One member of {@link METRIC_TILE_TONES}. */
export type MetricTileTone = (typeof METRIC_TILE_TONES)[number];

/** Props for {@link MetricTile}. */
export interface MetricTileProps {
  /** Small uppercase label above the number. */
  label: string;
  /** The headline value. Numbers render with tabular figures. */
  value: string | number;
  /** Unit rendered beside the number, e.g. `GPUs`, `%`, `GiB`. */
  unit?: string;
  /** Supporting line beneath, e.g. `available of 28 allocatable`. */
  hint?: React.ReactNode;
  /** Visual weight; `neutral` by default, `danger` when the operator must act. */
  tone?: MetricTileTone;
  /** Extra classes for call-site nudges. */
  className?: string;
}

/** Number colour per tone. */
const TONE_VALUE_CLASSES: Readonly<Record<MetricTileTone, string>> = {
  neutral: "text-foreground",
  ok: "text-primary",
  warning: "text-warning",
  danger: "text-destructive"
};

/** Card tint per tone. Warning and danger use distinct hues so the two call to actions differ. */
const TONE_CARD_CLASSES: Readonly<Record<MetricTileTone, string>> = {
  neutral: "",
  ok: "",
  warning: "border-warning",
  danger: "border-destructive"
};

/**
 * Label-over-number metric tile with a fixed hierarchy.
 *
 * The capacity card once made `available` the headline, left the utilisation percent in
 * a 10px badge and the total in 10px muted text — the number that should drive the
 * "do not start another model" decision was the quietest thing on the card. Here the
 * value is always the loudest element and the digits are always tabular, so a polled
 * number does not jitter horizontally and force a re-read.
 * @param props - Label, value, optional unit/hint/tone, and classes.
 * @returns The tile.
 */
export function MetricTile({
  label,
  value,
  unit,
  hint,
  tone = "neutral",
  className
}: MetricTileProps): React.JSX.Element {
  return (
    <div
      data-slot="metric-tile"
      data-testid="metric-tile"
      data-tone={tone}
      className={cn(surfaceCardClass, TONE_CARD_CLASSES[tone], className)}
    >
      <div data-testid="metric-tile-label" className={metricLabelClass}>
        {label}
      </div>
      <div data-testid="metric-tile-value" className={cn(metricValueClass, TONE_VALUE_CLASSES[tone])}>
        {value}
        {unit ? (
          <span data-testid="metric-tile-unit" className={metricUnitClass}>
            {unit}
          </span>
        ) : null}
      </div>
      {hint ? <div className={hintClass}>{hint}</div> : null}
    </div>
  );
}
