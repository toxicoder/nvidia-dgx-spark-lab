import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeavyConfirmDialog } from "../HeavyConfirmDialog";

describe("HeavyConfirmDialog", () => {
  it("requires typing yes before confirm", () => {
    const onConfirm = vi.fn();
    render(<HeavyConfirmDialog open modelLabel="Kimi" onOpenChange={vi.fn()} onConfirm={onConfirm} />);
    const confirm = screen.getByRole("button", { name: /confirm start/i });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("yes"), { target: { value: "yes" } });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalled();
  });

  it("clears input and calls onOpenChange when cancelled", () => {
    const onOpenChange = vi.fn();
    render(<HeavyConfirmDialog open modelLabel="Kimi" onOpenChange={onOpenChange} onConfirm={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("yes"), { target: { value: "yes" } });
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
