"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const SheetRoot = SheetPrimitive.Root;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 flex flex-col bg-card shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 border-border",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom rounded-t-[var(--md-sys-shape-corner-large,16px)] max-h-[80vh]",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "top-0 right-0 h-auto max-h-[90vh] w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm"
      }
    },
    defaultVariants: {
      side: "right"
    }
  }
);

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: "right" | "left" | "bottom";
  title?: string;
}

/**
 * The parts of a Radix outside-interaction event this component reasons about. Radix wraps the
 * native pointer/focus event in a `CustomEvent`, so the timestamp lives on `detail.originalEvent`.
 */
type OutsideDismissEvent = {
  preventDefault: () => void;
  detail: { originalEvent: { timeStamp: number } };
};

function Sheet({ open, onOpenChange, children, side = "right", title }: SheetProps) {
  /**
   * When the last open finished, in the same clock as `Event.timeStamp`.
   *
   * Radix keeps a closing sheet mounted for the exit animation and keeps honouring outside
   * dismissals the whole time. A second tap that asks for the sheet inside that window is seen
   * by the dying instance as an outside interaction, and its close lands *after* React has
   * already committed the new open, so nothing looks stale from the props: the drawer silently
   * refuses to reopen for ~300 ms. The pointer that asked for the sheet went down before the
   * sheet finished opening, so a dismissal older than that stamp cannot be the operator's intent.
   */
  const openedAtRef = React.useRef(0);
  React.useLayoutEffect(() => {
    if (open) openedAtRef.current = performance.now();
  }, [open]);

  const ignoreStaleDismiss = (event: OutsideDismissEvent): void => {
    if (!open || event.detail.originalEvent.timeStamp <= openedAtRef.current) event.preventDefault();
  };

  return (
    <SheetRoot open={open} onOpenChange={onOpenChange}>
      <SheetPrimitive.Portal>
        <SheetOverlay />
        <SheetPrimitive.Content
          data-testid="ui-sheet"
          data-side={side}
          className={cn(sheetVariants({ side }))}
          onInteractOutside={ignoreStaleDismiss}
          onFocusOutside={ignoreStaleDismiss}
        >
          <div className="flex items-center justify-between border-b border-border p-4">
            {title ? <SheetPrimitive.Title className="text-lg font-semibold">{title}</SheetPrimitive.Title> : <span />}
            <SheetPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          </div>
          <div className="flex-1 overflow-auto p-4">{children}</div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetRoot>
  );
}

export { Sheet, SheetRoot };
