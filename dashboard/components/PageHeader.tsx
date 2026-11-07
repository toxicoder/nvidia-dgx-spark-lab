import type React from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** The page's `<h1>` text. */
  title: string;
  /** One-line explanation shown under the heading. */
  description?: string;
  /** Actions aligned to the trailing edge, e.g. a refresh control. */
  actions?: React.ReactNode;
  /** Extra classes on the wrapper. */
  className?: string;
}

/**
 * Page-level heading block used by the overview and every section route.
 *
 * The console's heading outline is `h1` here and `h2` on each panel, which is
 * what makes the section's own heading list navigable. Section modules must not
 * render their own `h1`; this is the only one.
 *
 * @param props - Component props.
 * @param props.title - The page's `<h1>` text.
 * @param props.description - One-line explanation under the heading.
 * @param props.actions - Actions aligned to the trailing edge.
 * @param props.className - Extra classes on the wrapper.
 * @returns The heading block.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps): React.JSX.Element {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
