import * as React from "react";

import { cn } from "@/lib/utils";
import { panelClass, surfaceCardClass } from "@/components/panel-styles";
import { Skeleton } from "@/components/ui/skeleton";

/** Props for {@link SectionSkeleton}. */
export interface SectionSkeletonProps {
  /** How many card-shaped blocks to stand in for the section's panels. */
  cards?: number;
  /**
   * Render one short block with no header row, for a slot inside a KPI grid where a
   * full panel frame would be the wrong shape.
   */
  compact?: boolean;
  /** Extra classes for call-site nudges. */
  className?: string;
}

/**
 * Card-shaped loading placeholder for a section or a KPI slot.
 *
 * The Machine State skeleton was a bare `<Skeleton>` injected as a fourth child of a
 * two-column grid, so the grid gained an item and reflowed while the stale cards stayed
 * visible underneath. This mirrors the real section frame — header row, then cards — so
 * the swap costs no layout shift, and it announces itself through a `role="status"`
 * wrapper with an `.sr-only` string while the shimmer itself stays out of the
 * accessibility tree.
 * @param props - Card count, compact flag, and classes.
 * @returns The status-role placeholder.
 */
export function SectionSkeleton({ cards = 3, compact = false, className }: SectionSkeletonProps): React.JSX.Element {
  const blocks = compact ? 1 : cards;
  const blockHeight = compact ? "h-16 w-full" : "h-24 w-full";

  return (
    <div
      role="status"
      data-slot="section-skeleton"
      data-testid="section-skeleton"
      data-compact={compact}
      className={cn(panelClass, compact && "p-3", className)}
    >
      <span className="sr-only">Loading</span>
      <div data-testid="section-skeleton-visual" aria-hidden="true" className="space-y-3">
        {compact ? null : (
          <div data-slot="section-skeleton-header" className="flex items-center justify-between gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-8 w-24" />
          </div>
        )}
        {Array.from({ length: blocks }, (_, index) => (
          <Skeleton key={index} data-slot="section-skeleton-card" className={blockHeight} />
        ))}
      </div>
    </div>
  );
}

/** Props for {@link PageHeaderSkeleton}. */
export interface PageHeaderSkeletonProps {
  /** Extra classes for call-site nudges. */
  className?: string;
}

/**
 * Heading-block placeholder for the page header the route owns.
 *
 * Decorative by design: the `role="status"` announcement belongs to {@link SectionSkeleton}
 * beside it, and a page whose five shimmer blocks each announced "Loading" would drown the
 * operator in repetition.
 * @param props - Classes only.
 * @returns The header placeholder.
 */
export function PageHeaderSkeleton({ className }: PageHeaderSkeletonProps): React.JSX.Element {
  return (
    <div
      data-slot="page-header-skeleton"
      data-testid="page-header-skeleton"
      aria-hidden="true"
      className={cn(surfaceCardClass, "space-y-2", className)}
    >
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  );
}
