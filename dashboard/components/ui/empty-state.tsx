import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { hintClass, panelRadiusClass } from "@/components/panel-styles";

/** Props for {@link EmptyState}. */
export interface EmptyStateProps {
  /** Leading glyph that says what kind of thing is missing. */
  icon: LucideIcon;
  /** One-line statement of the emptiness, phrased for the operator, not the fixture. */
  title: string;
  /** Optional second line: why it is empty and what fills it. */
  description?: string;
  /** Optional action slot, e.g. a Start button. */
  action?: React.ReactNode;
  /** Extra classes for call-site nudges. */
  className?: string;
}

/**
 * Explicit empty state for a panel that would otherwise render nothing.
 *
 * `InferencePanel` mapped an empty `jobs` array to zero rows, leaving only the Quick
 * start row, which reads as a broken panel rather than an idle one; the Nemotron panel
 * returned a bare `<p>` with no icon and no next action. One block, one voice: icon,
 * title, why, and what to do about it.
 * @param props - Icon, title, optional description and action.
 * @returns The empty-state block.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps): React.JSX.Element {
  return (
    <div
      data-slot="empty-state"
      data-testid="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-2 border border-dashed border-border px-4 py-8 text-center",
        panelRadiusClass,
        className
      )}
    >
      <Icon aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className={cn(hintClass, "max-w-[45ch]")}>{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
