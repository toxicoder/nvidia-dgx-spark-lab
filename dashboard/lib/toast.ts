import { toast as sonnerToast } from "sonner";

export type ToastVariant = "default" | "success" | "error" | "warning";

export interface ToastInput {
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

/** Sonner-backed toast API (replaces custom store). */
export function toast({ title, description, variant = "default" }: ToastInput) {
  const message = title || description || "";
  const opts = title && description ? { description } : undefined;

  switch (variant) {
    case "success":
      return sonnerToast.success(message, opts);
    case "error":
      return sonnerToast.error(message, opts);
    case "warning":
      return sonnerToast.warning(message, opts);
    default:
      return sonnerToast(message, opts);
  }
}
