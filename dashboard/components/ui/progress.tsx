"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";
import { panelRadiusClass } from "@/components/panel-styles";

/**
 * shadcn-style Progress over `@radix-ui/react-progress`.
 *
 * The only progress bar in the app was the hand-rolled bar in `Treemap`, which had no
 * `role="progressbar"` and no `aria-valuenow`, so an operator using a screen reader got
 * nothing. Radix supplies the value semantics; this file only supplies the tokens.
 */

/** Props for {@link Progress}. */
export type ProgressProps = React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>;

/**
 * Determinate or indeterminate progress bar.
 *
 * Values are clamped to `[0, max]` here rather than trusted: a polled utilisation of
 * 100.4 would otherwise put an out-of-range `aria-valuenow` on the element.
 * @param props - Radix progress props; `value={null}` is indeterminate.
 * @returns The progressbar element.
 */
export const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, max = 100, ...props }, ref) => {
    const clamped = value === undefined || value === null ? null : Math.min(Math.max(value, 0), max);

    return (
      <ProgressPrimitive.Root
        ref={ref}
        data-slot="progress"
        data-testid="ui-progress"
        className={cn("relative h-2 w-full overflow-hidden bg-muted", panelRadiusClass, className)}
        value={clamped}
        max={max}
        {...props}
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="h-full flex-1 bg-primary transition-[width] duration-300"
        />
      </ProgressPrimitive.Root>
    );
  }
);
Progress.displayName = ProgressPrimitive.Root.displayName;
