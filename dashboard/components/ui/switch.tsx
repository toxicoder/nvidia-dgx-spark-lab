"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";
import { panelRadiusClass } from "@/components/panel-styles";

/**
 * Switch, rebuilt on `@radix-ui/react-switch`.
 *
 * The previous version was a hand-rolled `role="switch"` button: it tracked nothing
 * itself, so it could not be uncontrolled, it did not implement the `space`/`enter`
 * key contract Radix gives for free, and its thumb position was derived from a `checked`
 * prop that defaulted to `false` — which silently swallowed `defaultChecked`. Radix
 * supplies the button semantics, the keyboard handling, and `data-state` for styling.
 */

/** Props for {@link Switch}. */
export type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>;

const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, SwitchProps>(
  ({ className, ...props }, ref) => (
    <SwitchPrimitive.Root
      ref={ref}
      data-testid="ui-switch"
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center border-2 border-transparent transition-colors",
        panelRadiusClass,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
          "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
);
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
