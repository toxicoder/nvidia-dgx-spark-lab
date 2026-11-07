"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";
import { panelRadiusClass } from "@/components/panel-styles";

/**
 * shadcn-style Tooltip over `@radix-ui/react-tooltip`.
 *
 * There was no tooltip primitive at all, so chart affordances leaned on the Recharts
 * tooltip that `globals.css` has to restyle with `!important` rules, and icon-only
 * buttons carried their meaning in a `title` attribute no screen reader reliably reads.
 */

/** Props for {@link TooltipProvider}. */
export type TooltipProviderProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>;

/**
 * Provider every `Tooltip` needs; supplies the shared open/close timers.
 * @param props - Radix provider props, with a delay that suits a control-plane UI.
 * @returns The provider.
 */
export function TooltipProvider({
  delayDuration = 200,
  skipDelayDuration = 300,
  ...props
}: TooltipProviderProps): React.JSX.Element {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration} {...props} />;
}

/** Root of one tooltip. */
export const Tooltip = TooltipPrimitive.Root;

/** The control the bubble describes. */
export const TooltipTrigger = TooltipPrimitive.Trigger;

/** Props for {@link TooltipContent}. */
export type TooltipContentProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>;

/**
 * The bubble itself, styled with the popover tokens.
 * @param props - Radix content props; `className` extends the shared styling.
 * @returns The tooltip bubble.
 */
export const TooltipContent = React.forwardRef<React.ElementRef<typeof TooltipPrimitive.Content>, TooltipContentProps>(
  ({ className, sideOffset = 4, ...props }, ref) => (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        data-slot="tooltip-content"
        className={cn(
          "z-50 overflow-hidden border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground",
          panelRadiusClass,
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
);
TooltipContent.displayName = TooltipPrimitive.Content.displayName;
