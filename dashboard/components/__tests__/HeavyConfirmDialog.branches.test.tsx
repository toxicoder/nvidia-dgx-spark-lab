import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeavyConfirmDialog } from "../HeavyConfirmDialog";

vi.mock("@/components/ui/dialog", () => {
  const React = require("react");
  return {
    Dialog: ({
      children,
      open,
      onOpenChange
    }: {
      children: React.ReactNode;
      open: boolean;
      onOpenChange?: (open: boolean) => void;
    }) => (
      <div>
        <button type="button" data-testid="dialog-open" onClick={() => onOpenChange?.(true)}>
          open
        </button>
        {open ? children : null}
      </div>
    ),
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  };
});

describe("HeavyConfirmDialog branches", () => {
  it("does not clear input when dialog reports open", () => {
    render(<HeavyConfirmDialog open modelLabel="Kimi" onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("yes"), { target: { value: "yes" } });
    fireEvent.click(screen.getByTestId("dialog-open"));
    expect(screen.getByPlaceholderText("yes")).toHaveValue("yes");
  });
});
