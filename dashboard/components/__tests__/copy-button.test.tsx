import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

import { CopyButton } from "../ui/copy-button";

const clipboardMocks = vi.hoisted(() => ({
  copyText: vi.fn(async () => true),
  clearCopiedText: vi.fn(async () => true)
}));

vi.mock("@/lib/clipboard", () => clipboardMocks);

describe("CopyButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("awaits the write before claiming success", async () => {
    let release = (): void => undefined;
    clipboardMocks.copyText.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          release = () => resolve(true);
        })
    );
    render(<CopyButton value="http://node:3000" label="Copy endpoint" />);

    fireEvent.click(screen.getByRole("button", { name: /copy endpoint/i }));
    expect(clipboardMocks.copyText).toHaveBeenCalledWith("http://node:3000");
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();

    act(() => release());
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("never claims success when the write fails", async () => {
    clipboardMocks.copyText.mockResolvedValueOnce(false);
    const onCopy = vi.fn();
    render(<CopyButton value="secret" label="Copy token" onCopy={onCopy} />);

    fireEvent.click(screen.getByRole("button", { name: /copy token/i }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
    expect(onCopy).toHaveBeenCalledWith(false);
  });

  it("reports success to the caller so a panel can toast the truth", async () => {
    const onCopy = vi.fn();
    render(<CopyButton value="v" onCopy={onCopy} />);
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onCopy).toHaveBeenCalledWith(true);
  });

  it("clears the transient Copied state on a timer", async () => {
    render(<CopyButton value="v" />);
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("Copied")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
  });

  it("cancels the pending reset on unmount", async () => {
    const { unmount } = render(<CopyButton value="v" />);
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    await act(async () => {
      await Promise.resolve();
    });
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
  });

  it("names itself through the tooltip content, not only an icon", async () => {
    render(<CopyButton value="v" label="Copy Grafana URL" />);
    const trigger = screen.getByRole("button", { name: /copy grafana url/i });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /copy grafana url/i }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("defaults the accessible name to Copy", () => {
    render(<CopyButton value="v" />);
    expect(screen.getByRole("button", { name: /^copy$/i })).toBeInTheDocument();
  });
});
