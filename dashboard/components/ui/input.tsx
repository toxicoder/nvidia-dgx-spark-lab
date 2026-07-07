import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Robust shadcn-style Input, extended with MD3 inspiration.
 * Uses MD3 shape (rounded), tokens for focus ring, border, etc.
 * Fully accessible, responsive.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        data-testid="ui-input"
        className={cn(
          "flex h-10 w-full rounded-[var(--md-sys-shape-corner-medium)] border border-input bg-background px-3 py-2 text-sm",
          "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
