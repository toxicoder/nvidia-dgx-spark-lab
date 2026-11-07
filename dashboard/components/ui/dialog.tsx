"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { panelRadiusClass } from "@/components/panel-styles";
import { Button } from "@/components/ui/button";

/**
 * Dialog and AlertDialog, both on Radix.
 *
 * The `AlertDialog` here used to be hand-rolled out of `Dialog`, so destructive
 * confirms emitted `role="dialog"` instead of `role="alertdialog"`: assistive tech did
 * not announce a destructive confirmation, and outside-click or Escape dismissed it
 * like an ordinary dialog. It is now built on `@radix-ui/react-alert-dialog`, which
 * suppresses outside-click on `Cancel`/`Action` and gives the destructive verb a role
 * worth trusting. Every exported name and the `ui-dialog` test id are unchanged.
 */

const overlayClass =
  "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0";

const contentClass = cn(
  "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-card p-6 shadow-lg duration-200",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
  "rounded-[var(--md-sys-shape-corner-large,16px)]"
);

const titleClass = "text-lg font-semibold leading-none tracking-tight md3-title-large";

const descriptionClass = "text-sm text-muted-foreground";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

/** Props for {@link DialogOverlay}. */
export type DialogOverlayProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>;

const DialogOverlay = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Overlay>, DialogOverlayProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay ref={ref} className={cn(overlayClass, className)} {...props} />
  )
);
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/** Props for {@link DialogContent}. */
export type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>;

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, ...props }, ref) => (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-testid="ui-dialog"
        data-slot="dialog-content"
        className={cn(contentClass, className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

/** Props for {@link DialogHeader}. */
export type DialogHeaderProps = React.HTMLAttributes<HTMLDivElement>;

const DialogHeader = ({ className, ...props }: DialogHeaderProps): React.JSX.Element => (
  <div
    data-slot="dialog-header"
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

/** Props for {@link DialogFooter}. */
export type DialogFooterProps = React.HTMLAttributes<HTMLDivElement>;

const DialogFooter = ({ className, ...props }: DialogFooterProps): React.JSX.Element => (
  <div
    data-slot="dialog-footer"
    className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

/** Props for {@link DialogTitle}. */
export type DialogTitleProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>;

const DialogTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, DialogTitleProps>(
  ({ className, ...props }, ref) => <DialogPrimitive.Title ref={ref} className={cn(titleClass, className)} {...props} />
);
DialogTitle.displayName = DialogPrimitive.Title.displayName;

/** Props for {@link DialogDescription}. */
export type DialogDescriptionProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  DialogDescriptionProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn(descriptionClass, className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

/** Props for {@link AlertDialog}. */
export interface AlertDialogProps {
  /** Controlled open state. */
  open: boolean;
  /** Receives the requested open state; the dialog never closes itself mid-action. */
  onOpenChange: (open: boolean) => void;
  /** Title, also the accessible name of the `alertdialog`. */
  title: string;
  /** Optional description, also the accessible description. */
  description?: string;
  /** Label for the confirm button while idle. */
  confirmText?: string;
  /** Label for the cancel button. */
  cancelText?: string;
  /** The destructive action; the dialog closes only once it settles. */
  onConfirm: () => void | Promise<void>;
  /** Visual weight of the confirm button. */
  variant?: "default" | "destructive";
  /**
   * Override Radix's initial focus. `CapacityGateDialog` needs this: the first focusable
   * descendant of a confirm dialog must never be the action that stops a workload.
   */
  onOpenAutoFocus?: (event: Event) => void;
}

/**
 * Confirmed destructive action, on Radix AlertDialog.
 *
 * The confirm button owns the in-flight label and the disabled pair, so the caller no
 * longer needs its own `isDeleting` state to say nothing, and Escape or an outside click
 * cannot dismiss the dialog while the action is running.
 * @param props - Title, description, labels, the action, and optional focus override.
 * @returns The alert dialog, or nothing while closed.
 */
const AlertDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  variant = "default",
  onOpenAutoFocus
}: AlertDialogProps): React.JSX.Element | null => {
  const [isConfirming, setIsConfirming] = React.useState(false);

  const handleConfirm = async (): Promise<void> => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsConfirming(false);
    }
  };

  const blockWhileConfirming = (event: Event): void => {
    if (isConfirming) event.preventDefault();
  };

  const focusProps: { onOpenAutoFocus?: (event: Event) => void } = onOpenAutoFocus ? { onOpenAutoFocus } : {};

  // Radix omits onInteractOutside/onPointerDownOutside from AlertDialogContent: an alert
  // dialog already ignores outside interaction, so the in-flight guard only needs the
  // two paths that can still dismiss it (Escape and focus moving out).
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className={overlayClass} />
        <AlertDialogPrimitive.Content
          data-testid="ui-dialog"
          data-slot="alert-dialog-content"
          className={cn(contentClass, "sm:max-w-md", panelRadiusClass)}
          onEscapeKeyDown={blockWhileConfirming}
          onFocusOutside={blockWhileConfirming}
          {...focusProps}
        >
          <AlertDialogPrimitive.Title className={titleClass}>{title}</AlertDialogPrimitive.Title>
          {description ? (
            <AlertDialogPrimitive.Description className={descriptionClass}>
              {description}
            </AlertDialogPrimitive.Description>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel asChild disabled={isConfirming}>
              <Button variant="outline">{cancelText}</Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action
              asChild
              disabled={isConfirming}
              onClick={(event) => {
                // Close on our terms: after the action settles, not on click.
                event.preventDefault();
                void handleConfirm();
              }}
            >
              <Button variant={variant === "destructive" ? "destructive" : "default"}>
                {isConfirming ? "Working..." : confirmText}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
};
AlertDialog.displayName = "AlertDialog";

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  AlertDialog
};
