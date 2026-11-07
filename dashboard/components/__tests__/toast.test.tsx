import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const sonnerMocks = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn()
  })
}));

vi.mock("sonner", () => sonnerMocks);

import { useToast, toast } from "../ui/toast";

describe("useToast", () => {
  it("hands back the real Sonner-backed toast", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBe(toast);

    result.current.toast({ title: "Saved", variant: "success" });
    expect(sonnerMocks.toast.success).toHaveBeenCalledWith("Saved", undefined);
  });

  it("no longer pretends to own a toast list", () => {
    const { result } = renderHook(() => useToast());
    expect(Object.keys(result.current)).toEqual(["toast"]);
    expect(result.current).not.toHaveProperty("toasts");
    expect(result.current).not.toHaveProperty("dismiss");
  });
});
