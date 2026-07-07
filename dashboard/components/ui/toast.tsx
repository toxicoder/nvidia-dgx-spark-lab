"use client";

/**
 * Backward-compatible toast exports — backed by Sonner.
 * @see https://ui.shadcn.com/docs/components/sonner
 */
export { toast } from "@/lib/toast";
export type { ToastInput as Toast, ToastVariant } from "@/lib/toast";
export { Toaster } from "@/components/ui/sonner";

import { toast as notify } from "@/lib/toast";

export function useToast() {
  return { toast: notify, toasts: [], dismiss: () => {} };
}
