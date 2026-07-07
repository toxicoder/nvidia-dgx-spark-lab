import { describe, it, expect, vi, beforeEach } from "vitest";

const sonnerToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  default: vi.fn()
}));

vi.mock("sonner", () => ({
  toast: Object.assign(sonnerToast.default, {
    success: sonnerToast.success,
    error: sonnerToast.error,
    warning: sonnerToast.warning
  })
}));

import { toast } from "../toast";

describe("toast helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls sonner success with title and description", () => {
    toast({ title: "Done", description: "Saved", variant: "success" });
    expect(sonnerToast.success).toHaveBeenCalledWith("Done", { description: "Saved" });
  });

  it("calls sonner error with message only", () => {
    toast({ title: "Failed", variant: "error" });
    expect(sonnerToast.error).toHaveBeenCalledWith("Failed", undefined);
  });

  it("calls sonner warning", () => {
    toast({ description: "Careful", variant: "warning" });
    expect(sonnerToast.warning).toHaveBeenCalledWith("Careful", undefined);
  });

  it("calls default sonner toast", () => {
    toast({ title: "Hello" });
    expect(sonnerToast.default).toHaveBeenCalledWith("Hello", undefined);
  });

  it("uses description as message when title is absent", () => {
    toast({ description: "Only description" });
    expect(sonnerToast.default).toHaveBeenCalledWith("Only description", undefined);
  });

  it("passes description option when title and description are both set", () => {
    toast({ title: "Headline", description: "Details", variant: "error" });
    expect(sonnerToast.error).toHaveBeenCalledWith("Headline", { description: "Details" });
    toast({ title: "Warn", description: "Careful", variant: "warning" });
    expect(sonnerToast.warning).toHaveBeenCalledWith("Warn", { description: "Careful" });
  });

  it("uses empty message when title and description are absent", () => {
    toast({});
    expect(sonnerToast.default).toHaveBeenCalledWith("", undefined);
  });
});
