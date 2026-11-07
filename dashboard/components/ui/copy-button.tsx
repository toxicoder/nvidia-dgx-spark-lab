"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** How long the "Copied" confirmation stays up. */
const COPIED_RESET_MS = 2_000;

/** Props for {@link CopyButton}. */
export interface CopyButtonProps {
  /** The exact text to put on the clipboard. */
  value: string;
  /** Accessible name, and the tooltip text while idle. */
  label?: string;
  /** Called with the real outcome so the panel can toast the truth (or nothing). */
  onCopy?: (ok: boolean) => void;
  /** Extra classes for call-site nudges. */
  className?: string;
}

/**
 * Copy-to-clipboard button that only claims success it verified.
 *
 * Three panels each had their own copy button with three behaviours; the Nemotron one
 * did `void navigator.clipboard.writeText(url)` and toasted "Copied endpoint" without
 * awaiting, so on a non-secure origin or a denied permission the operator was told the
 * copy worked and the paste silently failed. This one awaits, checks the outcome, and
 * shows the transient state only when the write actually landed.
 * @param props - Value to copy, accessible label, outcome callback, classes.
 * @returns The button, wrapped in its own tooltip.
 */
export function CopyButton({ value, label = "Copy", onCopy, className }: CopyButtonProps): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(id);
  }, [copied]);

  const handleCopy = async (): Promise<void> => {
    const ok = await copyText(value);
    if (ok) setCopied(true);
    onCopy?.(ok);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn("h-8 gap-1 px-2", className)}
            onClick={() => void handleCopy()}
          >
            {copied ? (
              <>
                <Check aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="sr-only">{label}</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied" : label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
