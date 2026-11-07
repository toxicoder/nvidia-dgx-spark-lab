"use client";

import * as React from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Props for {@link PanelRefreshButton}. */
export interface PanelRefreshButtonProps {
  /** Re-read the panel's host state. */
  onClick: () => void;
  /** `true` while the read is in flight; disables the button and starts the spinner. */
  busy: boolean;
  /** Idle label. */
  label?: string;
  /** Optional label for the in-flight state; width is reserved for whichever is wider. */
  busyLabel?: string;
  /** Extra classes for call-site nudges. */
  className?: string;
}

/**
 * The shared Refresh button: fixed width, real spinner, honest busy semantics.
 *
 * Four panels had four versions. Machine State swapped a 7-character label for a
 * 3-character one, so the header row reflowed on every press and the only progress cue
 * was "..."; the others differed in icon size and label. The label is now constant
 * unless a `busyLabel` is asked for, in which case an invisible sizer reserves the
 * wider of the two so the button cannot change width mid-flight, and `aria-busy` tells
 * assistive tech what the disabled state already implies.
 * @param props - Click handler, busy flag, labels, classes.
 * @returns The outline button.
 */
export function PanelRefreshButton({
  onClick,
  busy,
  label = "Refresh",
  busyLabel,
  className
}: PanelRefreshButtonProps): React.JSX.Element {
  const sizer = !busyLabel || label.length >= busyLabel.length ? label : busyLabel;

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      data-testid="panel-refresh-button"
      data-slot="panel-refresh-button"
      aria-busy={busy}
      disabled={busy}
      onClick={onClick}
      className={className}
    >
      {busy ? (
        <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
      )}
      <span className="relative inline-grid justify-items-start">
        <span aria-hidden="true" data-slot="refresh-button-sizer" className="invisible col-start-1 row-start-1">
          {sizer}
        </span>
        <span
          data-slot="refresh-button-text"
          data-testid="panel-refresh-button-text"
          className="col-start-1 row-start-1"
        >
          {busy && busyLabel ? busyLabel : label}
        </span>
      </span>
    </Button>
  );
}
