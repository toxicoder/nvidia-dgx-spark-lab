import { cn } from "@/lib/utils";

/**
 * Shared styling constants for dashboard panels.
 *
 * Every panel used to hand-write the same four things — subheader row, inner surface
 * card, compact table, metric row — with three different radius, surface and elevation
 * values between them. Each constant here is the single source for one of those
 * patterns, and the radius and elevation come from exactly one place so a themed card
 * cannot drift from a themed inner surface.
 */

/** The one radius source: MD3 medium corner. */
export const panelRadiusClass = "rounded-[var(--md-sys-shape-corner-medium)]";

/** The one elevation source: MD3 level-1 key + ambient shadow. */
export const panelElevationClass = "shadow-[0_1px_2px_0_rgba(0,0,0,0.4),0_1px_3px_1px_rgba(0,0,0,0.15)]";

/** Base for any subhead: the primary-tinted semibold row the panels already used. */
const subheaderBaseClass = "flex items-center gap-2 text-sm font-semibold text-[var(--md-sys-color-primary)]";

/**
 * Legacy subheader class, kept verbatim for the 16 call sites that still import it.
 * New code uses `PanelHeader` + `PanelTitle`, which render a real heading.
 */
export const panelSubheaderClass = cn("mb-3", subheaderBaseClass);

/** Heading styling for `PanelTitle`; same voice as the legacy subheader. */
export const panelTitleClass = subheaderBaseClass;

/** Outer panel frame: the card a section wraps its panels in. */
export const panelClass = cn(
  panelRadiusClass,
  "space-y-3 border border-border bg-card p-4 text-card-foreground",
  panelElevationClass
);

/** Inner surface card (`ResourcesPanel`-style inset), one surface and one radius. */
export const surfaceCardClass = cn(
  panelRadiusClass,
  "border border-border bg-[var(--md-sys-color-surface-container-low)] p-3"
);

/** Dense variant of {@link surfaceCardClass} for rows inside a list. */
export const surfaceCardTightClass = cn(
  panelRadiusClass,
  "border border-border bg-[var(--md-sys-color-surface-container-low)] px-3 py-2"
);

/** Header row: title and description left, actions right, wraps instead of clipping. */
export const panelHeaderClass = "mb-3 flex flex-wrap items-start justify-between gap-2";

/** Body column. */
export const panelBodyClass = "space-y-3";

/** Footer row, separated from the body by a hairline. */
export const panelFooterClass = "mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2";

/** Right-aligned action slot inside a header. */
export const panelActionsClass = "ml-auto flex flex-wrap items-center gap-2";

/** Compact table: fixed layout with tight cells, shared by every panel table. */
export const compactTableClass =
  "table-fixed w-full min-w-0 [&_th]:h-8 [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1.5";

/** Headline number: the loudest thing in a metric tile, always tabular. */
export const metricValueClass = "text-2xl font-semibold leading-tight tabular-nums";

/** Metric label: small, uppercase, quiet, never the thing the operator reads first. */
export const metricLabelClass = "text-xs font-medium uppercase tracking-wide text-muted-foreground";

/** Unit suffix that rides alongside a headline number without competing with it. */
export const metricUnitClass = "ml-1 text-sm font-medium text-muted-foreground tabular-nums";

/**
 * Secondary text. `text-xs` is the floor: the audit found 26 occurrences of
 * 8-11px copy, which fails on an arm's-length wall display.
 */
export const hintClass = "text-xs text-muted-foreground";
