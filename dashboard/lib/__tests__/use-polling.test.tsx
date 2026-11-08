import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { usePolling } from "../hooks/use-polling";

const TICK = 10_000;

function setDocumentHidden(value: boolean): void {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => value });
  document.dispatchEvent(new Event("visibilitychange"));
}

async function tick(ms = TICK): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe("usePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setDocumentHidden(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  });

  it("keeps the 10s default cadence and holds initialData until the first tick", async () => {
    const fetcher = vi.fn(async () => "second");
    const { result } = renderHook(() => usePolling(fetcher, { initialData: "first" }));

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.data).toBe("first");
    expect(result.current.lastUpdatedAt).toBeNull();
    expect(result.current.stale).toBe(false);

    await tick();
    expect(result.current.data).toBe("second");
    expect(fetcher).toHaveBeenCalledTimes(1);

    await tick();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("honours a custom intervalMs", async () => {
    const fetcher = vi.fn(async () => 1);
    renderHook(() => usePolling(fetcher, { intervalMs: 5_000 }));

    await tick(TICK);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("pauses while the tab is hidden and resumes immediately on visibility", async () => {
    const fetcher = vi.fn(async () => 1);
    renderHook(() => usePolling(fetcher));

    await act(async () => {
      setDocumentHidden(true);
    });
    await tick(TICK * 4);
    expect(fetcher).not.toHaveBeenCalled();

    await act(async () => {
      setDocumentHidden(false);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    await tick();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not start the timer when mounted while hidden", async () => {
    const fetcher = vi.fn(async () => 1);
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    renderHook(() => usePolling(fetcher));

    await tick(TICK * 3);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("surfaces a failing poll once, not once per tick", async () => {
    const onError = vi.fn();
    const fetcher = vi.fn(async (): Promise<string> => {
      throw new Error("utility down");
    });
    const { result } = renderHook(() => usePolling(fetcher, { initialData: "stale-value", onError }));

    await tick();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe("utility down");
    expect(result.current.stale).toBe(true);
    expect(result.current.data).toBe("stale-value");

    await tick(TICK * 3);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("re-arms the error after a good poll so the next outage is reported again", async () => {
    const onError = vi.fn();
    let failing = true;
    const fetcher = vi.fn(async (): Promise<string> => {
      if (failing) throw new Error("down");
      return "up";
    });
    const { result } = renderHook(() => usePolling(fetcher, { onError }));

    await tick();
    expect(onError).toHaveBeenCalledTimes(1);

    failing = false;
    await tick();
    expect(result.current.error).toBeNull();
    expect(result.current.stale).toBe(false);

    failing = true;
    await tick();
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("works without an onError callback", async () => {
    const fetcher = vi.fn(async (): Promise<string> => {
      throw "boom";
    });
    const { result } = renderHook(() => usePolling(fetcher));

    await tick();
    expect(result.current.error).toBe("boom");
  });

  it("exposes refresh() with busy state around the request", async () => {
    let release = (): void => undefined;
    const fetcher = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = () => resolve("from-refresh");
        })
    );
    const { result } = renderHook(() => usePolling(fetcher, { initialData: "seed" }));

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.refresh();
    });
    expect(result.current.busy).toBe(true);

    // A concurrent refresh must not fire a second request.
    act(() => {
      void result.current.refresh();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    act(() => release());
    await act(async () => {
      await pending;
    });

    expect(result.current.busy).toBe(false);
    expect(result.current.data).toBe("from-refresh");
    expect(result.current.lastUpdatedAt).toBeTypeOf("number");
  });

  it("stops polling when disabled", async () => {
    const fetcher = vi.fn(async () => 1);
    const { rerender } = renderHook(({ enabled }) => usePolling(fetcher, { enabled }), {
      initialProps: { enabled: true }
    });

    await tick();
    expect(fetcher).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    await tick(TICK * 3);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("marks data stale once it ages past the stale window", async () => {
    const fetcher = vi.fn(async () => "value");
    const { result, rerender } = renderHook(({ enabled }) => usePolling(fetcher, { enabled, staleAfterMs: 20_000 }), {
      initialProps: { enabled: true }
    });

    await tick();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.stale).toBe(false);

    rerender({ enabled: false });
    await tick(20_001);
    expect(result.current.stale).toBe(true);
  });

  it("flips stale when the window shrinks under an already-aged payload", async () => {
    const fetcher = vi.fn(async () => "value");
    const { result, rerender } = renderHook(
      ({ staleAfterMs }) => usePolling(fetcher, { enabled: false, staleAfterMs }),
      { initialProps: { staleAfterMs: 60_000 } }
    );

    act(() => {
      void result.current.refresh();
    });
    expect(result.current.stale).toBe(false);

    await tick(2_000);
    rerender({ staleAfterMs: 1_000 });
    expect(result.current.stale).toBe(true);
  });
});

describe("usePolling restart guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setDocumentHidden(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not stack a second interval when the tab reports visible twice", async () => {
    const fetcher = vi.fn<() => Promise<string>>().mockResolvedValue("ok");

    renderHook(() => usePolling(fetcher));

    // Mount already started one interval. A redundant visible event must not add another,
    // which would otherwise double the poll rate against the host every time it happened.
    act(() => setDocumentHidden(false));
    act(() => setDocumentHidden(false));

    const callsAfterMount = fetcher.mock.calls.length;
    await tick(TICK);

    expect(fetcher.mock.calls.length - callsAfterMount).toBe(1);
  });
});
