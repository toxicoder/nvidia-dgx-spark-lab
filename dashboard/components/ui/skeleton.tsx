import { cn } from "@/lib/utils";

/**
 * MD3-inspired Skeleton (loading placeholder).
 * Used in journeys for data loading states (e.g. refresh, initial).
 * Surface variant + pulse.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-testid="ui-skeleton"
      className={cn(
        "animate-pulse rounded-[var(--md-sys-shape-corner-small,4px)] bg-[var(--md-sys-color-surface-variant)]",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
