import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { AlertDialog } from "../ui/dialog";

describe("AlertDialog", () => {
  it("is a real alertdialog, not a plain dialog wearing a mask", () => {
    render(<AlertDialog open title="Move 8 selected paths to trash?" onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("keeps the data-testid the goldens and specs key off", () => {
    render(<AlertDialog open title="Stop container?" onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByTestId("ui-dialog")).toBeInTheDocument();
  });

  it("labels itself with the title and describes itself with the description", () => {
    render(
      <AlertDialog
        open
        title="Delete path"
        description="Moved to lab trash."
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAccessibleName("Delete path");
    expect(dialog).toHaveAccessibleDescription("Moved to lab trash.");
  });

  it("confirms, awaits the action, then closes", async () => {
    const onConfirm = vi.fn(async () => undefined);
    const onOpenChange = vi.fn();
    render(<AlertDialog open title="Delete" confirmText="Delete" onOpenChange={onOpenChange} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("button", { name: "Working..." })).toBeDisabled();

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("keeps the cancel button dead while the destructive action runs", async () => {
    let release = (): void => undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = () => resolve();
        })
    );
    render(<AlertDialog open title="Delete" onOpenChange={vi.fn()} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    release();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled());
  });

  it("cancels without running the action", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(<AlertDialog open title="Delete" onOpenChange={onOpenChange} onConfirm={onConfirm} cancelText="Keep" />);

    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders the destructive variant as a destructive button", () => {
    render(<AlertDialog open title="Delete" variant="destructive" onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Confirm" }).className).toContain("bg-destructive");
  });

  it("lets a caller take initial focus off the destructive action", () => {
    const onOpenAutoFocus = vi.fn();
    render(
      <AlertDialog open title="Delete" onOpenChange={vi.fn()} onConfirm={vi.fn()} onOpenAutoFocus={onOpenAutoFocus} />
    );
    expect(onOpenAutoFocus).toHaveBeenCalled();
  });
});
