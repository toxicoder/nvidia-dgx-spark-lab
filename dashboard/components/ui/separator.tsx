"use client";

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "@/lib/utils";

/**
 * shadcn-style Separator over `@radix-ui/react-separator`.
 *
 * `select.tsx` inlined `h-px bg-muted` and `DashboardShell` re-declared borders by hand
 * in three places. One primitive, announced as a separator so it is navigable.
 */

/** Props for {@link Separator}. */
export type SeparatorProps = React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>;

/**
 * A rule between two groups of content.
 *
 * `decorative` defaults to `false` so a plain `<Separator />` is announced; pass
 * `decorative` for a purely visual hairline.
 * @param props - Radix separator props.
 * @returns The separator element.
 */
export const Separator = React.forwardRef<React.ElementRef<typeof SeparatorPrimitive.Root>, SeparatorProps>(
  ({ className, orientation = "horizontal", decorative = false, ...props }, ref) => (
    <SeparatorPrimitive.Root
      ref={ref}
      data-slot="separator"
      data-testid="ui-separator"
      decorative={decorative}
      orientation={orientation}
      className={cn("shrink-0 bg-border", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)}
      {...props}
    />
  )
);
Separator.displayName = SeparatorPrimitive.Root.displayName;
