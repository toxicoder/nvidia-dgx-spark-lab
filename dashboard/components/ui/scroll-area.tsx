"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

/**
 * shadcn-style ScrollArea over `@radix-ui/react-scroll-area`.
 *
 * `table.tsx` and `sheet.tsx` used bare `overflow-auto`, and the Machine State services
 * list scrolled with no visible affordance and no `tabIndex`, so a keyboard operator
 * could not reach the clipped rows at all. Radix supplies the styled bar; the part it
 * does *not* supply is keyboard access, so the viewport is focusable here and gets a
 * landmark role when the caller names it.
 */

/** Props for {@link ScrollArea}. */
export interface ScrollAreaProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  /**
   * Accessible name for the scrollable region. Supplying it also makes the viewport a
   * labelled `region` landmark, so a screen reader can jump straight to the list.
   */
  label?: string;
  /**
   * Axis the bar tracks. Radix puts this on `Scrollbar` rather than `Root`, so it is
   * declared here to keep one knob at the call site and is forwarded to the bar only.
   */
  orientation?: "vertical" | "horizontal";
}

/**
 * Clipped container with a styled bar and a keyboard-focusable viewport.
 * @param props - Radix scroll-area props plus the optional region label.
 * @returns The scroll area.
 */
export const ScrollArea = React.forwardRef<React.ElementRef<typeof ScrollAreaPrimitive.Root>, ScrollAreaProps>(
  ({ className, children, orientation = "vertical", label, ...props }, ref) => {
    const labelled = label !== undefined && label !== "";

    return (
      <ScrollAreaPrimitive.Root
        ref={ref}
        data-slot="scroll-area"
        data-testid="ui-scroll-area"
        className={cn("relative overflow-hidden", className)}
        {...props}
      >
        <ScrollAreaPrimitive.Viewport
          data-slot="scroll-area-viewport"
          data-testid="ui-scroll-area-viewport"
          tabIndex={0}
          role={labelled ? "region" : undefined}
          aria-label={labelled ? label : undefined}
          className="h-full w-full rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {children}
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar orientation={orientation === "horizontal" ? "horizontal" : "vertical"} />
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
    );
  }
);
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

/** Props for {@link ScrollBar}. */
export type ScrollBarProps = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar>;

/**
 * The visual bar. Radix renders it unlabelled because the viewport, not the bar, is the
 * thing an operator scrolls; it is hidden from the accessibility tree so it does not
 * read as an unlabelled control.
 * @param props - Radix scrollbar props.
 * @returns The scrollbar.
 */
export function ScrollBar({ className, orientation = "vertical", ...props }: ScrollBarProps): React.JSX.Element {
  return (
    <ScrollAreaPrimitive.Scrollbar
      aria-hidden="true"
      orientation={orientation}
      className={cn(
        "flex touch-none select-none transition-colors",
        orientation === "vertical" && "h-full w-2 border-l border-l-transparent p-px",
        orientation === "horizontal" && "h-2 flex-col border-t border-t-transparent p-px",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border" />
    </ScrollAreaPrimitive.Scrollbar>
  );
}
