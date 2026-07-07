import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StoragePanel } from "../StoragePanel";
import * as actions from "@/actions/host-actions";

vi.mock("@/actions/host-actions", () => ({
  deletePathAction: vi.fn(),
  findDuplicatesAction: vi.fn(),
  getStorageTreeAction: vi.fn()
}));

const toastMock = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock })
}));

const alertDialogMocks = vi.hoisted(() => ({
  onConfirm: null as (() => void) | null,
  onOpenChange: null as ((open: boolean) => void) | null
}));

vi.mock("@/components/ui/dialog", async () => {
  const React = await import("react");
  const actual = await vi.importActual<typeof import("@/components/ui/dialog")>("@/components/ui/dialog");
  return {
    ...actual,
    AlertDialog: ({
      open,
      onConfirm,
      onOpenChange,
      title,
      confirmText
    }: {
      open: boolean;
      onConfirm: () => void;
      onOpenChange: (open: boolean) => void;
      title: string;
      confirmText?: string;
    }) => {
      alertDialogMocks.onConfirm = onConfirm;
      alertDialogMocks.onOpenChange = onOpenChange;
      if (!open) return null;
      return (
        <div>
          <h2>{title}</h2>
          <button type="button" onClick={onConfirm}>
            {confirmText ?? "Delete"}
          </button>
          <button type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
        </div>
      );
    }
  };
});

const fakeTree = {
  name: "models",
  path: "/mnt/models",
  size: 100,
  isDir: true,
  children: [{ name: "file.txt", path: "/mnt/models/file.txt", size: 50, isDir: false }]
};

describe("StoragePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(actions.getStorageTreeAction).mockResolvedValue(fakeTree);
    vi.mocked(actions.deletePathAction).mockResolvedValue({ movedToTrash: "/tmp/trash" });
    vi.mocked(actions.findDuplicatesAction).mockResolvedValue({ groups: [] });
  });

  it("renders treemap and handles refresh (mocked)", async () => {
    render(<StoragePanel initialTree={fakeTree} />);

    expect(screen.getByText(/Disk usage/i)).toBeInTheDocument();
    expect(screen.getByTestId("storage-path-breadcrumb")).toBeInTheDocument();
    expect(screen.getAllByText("file.txt").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => {
      expect(actions.getStorageTreeAction).toHaveBeenCalledWith({ path: "/mnt/models" });
    });
  });

  it("renders delete controls and calls find duplicates", async () => {
    render(<StoragePanel initialTree={fakeTree} />);

    expect(screen.getByText("Find Duplicates")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Find Duplicates"));
    await waitFor(() => {
      expect(actions.findDuplicatesAction).toHaveBeenCalled();
      expect(screen.getByText("No duplicates found.")).toBeInTheDocument();
    });
  });

  it("shows duplicate groups in sheet", async () => {
    render(
      <StoragePanel
        initialTree={fakeTree}
        visualDupesFixture={{
          groups: [
            { size: 1024, files: ["/a", "/b"] },
            { size: 2048, files: ["/c"] }
          ]
        }}
        visualShowDupesSheet
      />
    );

    expect(screen.getByText(/2 files/)).toBeInTheDocument();
    expect(screen.getByText(/\/a, \/b/)).toBeInTheDocument();
  });

  it("shows overflow message when more than 10 duplicate groups", () => {
    const groups = Array.from({ length: 12 }, (_, i) => ({
      size: 1000 + i,
      files: [`/f${i}`]
    }));
    render(<StoragePanel initialTree={fakeTree} visualDupesFixture={{ groups }} visualShowDupesSheet />);
    expect(screen.getByText(/\.\.\. and more/)).toBeInTheDocument();
  });

  it("confirms and performs delete", async () => {
    render(<StoragePanel initialTree={fakeTree} />);

    const row = screen.getByText("file.txt").closest("tr")!;
    fireEvent.click(row.querySelector("button")!);

    expect(screen.getByText(/Delete path\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/i }));

    await waitFor(() => {
      expect(actions.deletePathAction).toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Deleted", variant: "success" }));
    });
  });

  it("toasts error when delete fails", async () => {
    vi.mocked(actions.deletePathAction).mockRejectedValue(new Error("permission denied"));
    render(<StoragePanel initialTree={fakeTree} />);

    const row = screen.getByText("file.txt").closest("tr")!;
    fireEvent.click(row.querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Delete failed", variant: "error" }));
    });
  });

  it("cancels pending delete dialog", () => {
    render(<StoragePanel initialTree={fakeTree} />);
    const row = screen.getByText("file.txt").closest("tr")!;
    fireEvent.click(row.querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(screen.queryByText(/Delete path\?/)).not.toBeInTheDocument();
  });

  it("uses default models path in breadcrumb when tree path empty", async () => {
    render(<StoragePanel initialTree={{ name: "root", path: "", size: 0, isDir: true, children: [] }} />);
    expect(screen.getByTestId("storage-path-breadcrumb")).toHaveTextContent("models");
  });

  it("no-ops performDelete when pending delete was cleared", async () => {
    render(<StoragePanel initialTree={fakeTree} />);
    const row = screen.getByText("file.txt").closest("tr")!;
    fireEvent.click(row.querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    await waitFor(() => expect(screen.queryByText(/Delete path\?/)).not.toBeInTheDocument());
    alertDialogMocks.onConfirm?.();
    expect(actions.deletePathAction).not.toHaveBeenCalled();
  });
});
