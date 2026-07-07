import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Canonical shadcn/ui Card.
 *
 * *Actually imported from https://github.com/shadcn-ui/ui* (hermetic Bazel
 * @shadcn_ui + :shadcn_hermetic). Source of truth is the fetched archive.
 * MD3 via globals.css.
 */

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-[var(--md-sys-shape-corner-medium,12px)] border bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)]",
      "shadow-[0_1px_2px_0_rgba(0,0,0,0.4),0_4px_6px_-1px_rgba(0,0,0,0.35),0_10px_15px_-3px_rgba(0,0,0,0.3),0_20px_25px_-5px_rgba(0,0,0,0.2)]", // reference-level luxury elevation (shadcn opengraph quality)
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-testid="ui-card-header" className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      data-testid="ui-card-title"
      className={cn("md3-title-large font-semibold text-[var(--md-sys-color-on-surface)]", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-testid="ui-card-content" className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
);
CardFooter.displayName = "CardFooter";

const CardAction = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-testid="ui-card-action" className={cn("flex items-center", className)} {...props} />
  )
);
CardAction.displayName = "CardAction";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, CardAction };
