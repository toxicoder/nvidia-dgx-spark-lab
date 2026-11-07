"use client";

/**
 * Backward-compatible toast exports — backed by Sonner.
 * @see https://ui.shadcn.com/docs/components/sonner
 *
 * `useToast()` used to hand back `{ toast, toasts: [], dismiss: () => {} }`: a fake
 * store where `toasts` was always empty and `dismiss` did nothing, so a caller that
 * tried to keep a failure on screen or dismiss a duplicate silently failed while the
 * type said it worked. The two dead fields are gone; the one honest field is the real
 * Sonner-backed `toast` from `lib/toast`, which is also what `dismiss` would have had to
 * be built on.
 */
export { toast } from "@/lib/toast";
export type { ToastInput as Toast, ToastVariant } from "@/lib/toast";
export { Toaster } from "@/components/ui/sonner";

import { toast as notify } from "@/lib/toast";

/** What {@link useToast} returns. Deliberately only the one thing that works. */
export interface UseToastResult {
  /** The Sonner-backed toast function; identical to the `toast` module export. */
  toast: typeof notify;
}

/**
 * Give a client component the toast function.
 * @returns An object holding only `toast`.
 */
export function useToast(): UseToastResult {
  return { toast: notify };
}
