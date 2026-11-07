import * as React from "react";

import { cn } from "@/lib/utils";
import {
  hintClass,
  panelActionsClass,
  panelBodyClass,
  panelClass,
  panelFooterClass,
  panelHeaderClass,
  panelTitleClass
} from "@/components/panel-styles";

/**
 * The panel frame every section composes its panels from.
 *
 * Sixteen call sites hand-assembled the subheader row out of `panelSubheaderClass`
 * plus an icon plus a right-aligned action, and none of them rendered a heading: the
 * document outline went `<h1>` straight to `<h3>`, so a screen-reader user could not
 * navigate the dashboard by heading at all. `PanelTitle` is a real heading and the
 * default level is `h2`, which is what the section contract in
 * `components/sections/README.md` promises the route's `<h1>`.
 */

/** Heading levels a panel title may claim; `h2` is the section-level default. */
export type PanelTitleLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

/** Props for {@link Panel}. */
export type PanelProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Card-shaped frame that groups a header, body and footer.
 * @param props - Standard div attributes; `className` extends the shared frame.
 * @returns The panel frame.
 */
export function Panel({ className, ...props }: PanelProps): React.JSX.Element {
  return <div data-slot="panel" className={cn(panelClass, className)} {...props} />;
}

/** Props for {@link PanelHeader}. */
export type PanelHeaderProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Header row: title and description on the left, actions pushed to the right.
 * @param props - Standard div attributes.
 * @returns The header row.
 */
export function PanelHeader({ className, ...props }: PanelHeaderProps): React.JSX.Element {
  return <div data-slot="panel-header" className={cn(panelHeaderClass, className)} {...props} />;
}

/** Props for {@link PanelTitle}. */
export interface PanelTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Heading tag to render. Defaults to `h2`; pass `h3` under another section title. */
  as?: PanelTitleLevel;
}

/**
 * The panel title, rendered as a real heading so the outline is `h1 -> h2 -> h3`.
 * @param props - Heading attributes plus the optional `as` demotion.
 * @param props.as - Heading level to render; `h2` when omitted.
 * @returns The heading element.
 */
export function PanelTitle({ as: Tag = "h2", className, ...props }: PanelTitleProps): React.JSX.Element {
  return <Tag data-slot="panel-title" className={cn(panelTitleClass, className)} {...props} />;
}

/** Props for {@link PanelDescription}. */
export type PanelDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

/**
 * One-line subhead under the title, capped to a readable measure.
 * @param props - Standard paragraph attributes.
 * @returns The description paragraph.
 */
export function PanelDescription({ className, ...props }: PanelDescriptionProps): React.JSX.Element {
  return <p data-slot="panel-description" className={cn(hintClass, "max-w-[65ch]", className)} {...props} />;
}

/** Props for {@link PanelActions}. */
export type PanelActionsProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Right-aligned action slot for a header (refresh, filters, deep links).
 * @param props - Standard div attributes.
 * @returns The actions container.
 */
export function PanelActions({ className, ...props }: PanelActionsProps): React.JSX.Element {
  return <div data-slot="panel-actions" className={cn(panelActionsClass, className)} {...props} />;
}

/** Props for {@link PanelBody}. */
export type PanelBodyProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Stacked content area of a panel.
 * @param props - Standard div attributes.
 * @returns The body container.
 */
export function PanelBody({ className, ...props }: PanelBodyProps): React.JSX.Element {
  return <div data-slot="panel-body" className={cn(panelBodyClass, className)} {...props} />;
}

/** Props for {@link PanelFooter}. */
export type PanelFooterProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Footer row, separated from the body by a hairline; holds last-updated and totals.
 * @param props - Standard div attributes.
 * @returns The footer container.
 */
export function PanelFooter({ className, ...props }: PanelFooterProps): React.JSX.Element {
  return <div data-slot="panel-footer" className={cn(panelFooterClass, hintClass, className)} {...props} />;
}
