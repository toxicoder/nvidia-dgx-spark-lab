import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { fakeSecrets } from "@/lib/mocks/fixtures";

vi.mock("@/components/ui/dialog", () => {
  const React = require("react");
  return {
    Dialog: ({
      children,
      open,
      onOpenChange
    }: {
      children: React.ReactNode;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) => (
      <div data-testid="mock-dialog" data-open={String(open)}>
        {open ? (
          <>
            <button type="button" data-testid="dialog-dismiss" onClick={() => onOpenChange?.(false)}>
              Dismiss
            </button>
            <button type="button" data-testid="dialog-open" onClick={() => onOpenChange?.(true)}>
              Open
            </button>
            {children}
          </>
        ) : null}
      </div>
    ),
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  };
});

vi.mock("@/actions/secrets-actions", () => ({
  createSecretAction: vi.fn(),
  updateSecretValueAction: vi.fn(),
  deleteSecretAction: vi.fn(),
  revealSecretAction: vi.fn(),
  syncSecretToK8sAction: vi.fn()
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: vi.fn() })
}));

import { SecretsPanel } from "../SecretsPanel";

describe("SecretsPanel reveal dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears reveal state when onOpenChange receives false", () => {
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Reveal value"));
    expect(screen.getByPlaceholderText("REVEAL")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("dialog-open"));
    expect(screen.getByPlaceholderText("REVEAL")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("dialog-dismiss"));
    expect(screen.queryByPlaceholderText("REVEAL")).not.toBeInTheDocument();
  });
});
