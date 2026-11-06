import { toast as sonnerToast } from "sonner";

export type ToastVariant = "default" | "success" | "error" | "warning";

export interface ToastInput {
  title?: string;
  /** `| undefined` so a caller can pass a value that may be absent; it is destructured. */
  description?: string | undefined;
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
