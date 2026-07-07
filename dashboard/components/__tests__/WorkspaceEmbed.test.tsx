import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { WorkspaceEmbed } from "../WorkspaceEmbed";

describe("WorkspaceEmbed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders iframe with external link", () => {
    render(<WorkspaceEmbed url="http://localhost:32080" title="Coder" />);
    expect(screen.getByTestId("workspace-embed")).toBeInTheDocument();
    expect(screen.getByTitle("Coder")).toHaveAttribute("src", "http://localhost:32080");
    expect(screen.getByRole("link", { name: /New tab/i })).toHaveAttribute("href", "http://localhost:32080");
  });

  it("shows fallback when iframe load times out", () => {
    render(<WorkspaceEmbed url="http://localhost:32080" title="Coder" />);
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByTestId("workspace-embed-fallback")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Coder/i })).toBeInTheDocument();
  });

  it("restarts load timeout when url changes", () => {
    const { rerender } = render(<WorkspaceEmbed url="http://localhost:32080" title="Coder" />);
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByTestId("workspace-embed-fallback")).toBeInTheDocument();

    rerender(<WorkspaceEmbed url="http://localhost:32081" title="Kasm" />);
    expect(screen.getByRole("link", { name: /Open Kasm/i })).toHaveAttribute("href", "http://localhost:32081");
  });

  it("clears timeout when iframe loads", () => {
    render(<WorkspaceEmbed url="http://localhost:32080" title="Coder" />);
    fireEvent.load(screen.getByTitle("Coder"));
    vi.advanceTimersByTime(8000);
    expect(screen.queryByTestId("workspace-embed-fallback")).not.toBeInTheDocument();
  });

  it("clears pending timeout on unmount", () => {
    const clearSpy = vi.spyOn(global, "clearTimeout");
    const { unmount } = render(<WorkspaceEmbed url="http://localhost:32080" title="Coder" />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("does not block when iframe loads before timeout", () => {
    render(<WorkspaceEmbed url="http://localhost:32080" title="Coder" />);
    act(() => {
      fireEvent.load(screen.getByTitle("Coder"));
      vi.advanceTimersByTime(8000);
    });
    expect(screen.queryByTestId("workspace-embed-fallback")).not.toBeInTheDocument();
  });

  it("skips clearTimeout on cleanup after timeout already fired", () => {
    const clearSpy = vi.spyOn(global, "clearTimeout");
    const { unmount } = render(<WorkspaceEmbed url="http://localhost:32080" title="Coder" />);
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    const callsAfterTimeout = clearSpy.mock.calls.length;
    unmount();
    expect(clearSpy.mock.calls.length).toBe(callsAfterTimeout);
    clearSpy.mockRestore();
  });

  it("ignores duplicate load events before timeout", () => {
    render(<WorkspaceEmbed url="http://localhost:32080" title="Coder" />);
    const iframe = screen.getByTitle("Coder");
    fireEvent.load(iframe);
    fireEvent.load(iframe);
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.queryByTestId("workspace-embed-fallback")).not.toBeInTheDocument();
  });
});
