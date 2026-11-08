import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { CapacityCheck } from "@/lib/types";
import { useCapacityGatedAction } from "../hooks/use-capacity-gated-action";

function check(overrides: Partial<CapacityCheck> = {}): CapacityCheck {
  return {
    ok: true,
    verdict: "ok",
    action: "model:kimi",
    heavy: false,
    required: { gpus: 1, cpu: "4", memory: "16Gi" },
    available: { gpus: 2, cpu: "17.7", memory: "60.8Gi" },
    deficit: {},
    ...overrides
  };
}

interface Options {
  action: string;
  heavy: boolean;
  onProceed: () => void | Promise<void>;
  onBlocked: (check: CapacityCheck) => void;
  onHeavy: () => void;
  onError: (error: unknown) => void;
}

function makeOptions(): Options {
  return {
    action: "model:kimi",
    heavy: false,
    onProceed: vi.fn<() => Promise<void>>(),
    onBlocked: vi.fn<(check: CapacityCheck) => void>(),
    onHeavy: vi.fn<() => void>(),
    onError: vi.fn<(error: unknown) => void>()
  };
}

function setup(options: Partial<Options>, checkCapacity: (action: string) => Promise<CapacityCheck>) {
  const merged = { ...makeOptions(), ...options };
  return renderHook(() => useCapacityGatedAction(checkCapacity, merged));
}

describe("useCapacityGatedAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("arms `checking` synchronously, before the capacity round trip resolves", async () => {
    let release = (): void => undefined;
    const checkCapacity = vi.fn(
      () =>
        new Promise<CapacityCheck>((resolve) => {
          release = () => resolve(check());
        })
    );
    const { result } = setup({}, checkCapacity);

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.begin();
    });

    // The P0: the button must already be disabled while the await is in flight.
    expect(result.current.checking).toBe(true);
    expect(checkCapacity).toHaveBeenCalledTimes(1);

    act(() => release());
    await act(async () => {
      await pending;
    });
    expect(result.current.checking).toBe(false);
  });

  it("collapses a double click into a single capacity check", async () => {
    let release = (): void => undefined;
    const checkCapacity = vi.fn(
      () =>
        new Promise<CapacityCheck>((resolve) => {
          release = () => resolve(check());
        })
    );
    const { result } = setup({}, checkCapacity);

    act(() => {
      void result.current.begin();
      void result.current.begin();
    });
    expect(checkCapacity).toHaveBeenCalledTimes(1);

    act(() => release());
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(checkCapacity).toHaveBeenCalledTimes(1);
  });

  it("proceeds when capacity passes and the action is not heavy", async () => {
    const options = makeOptions();
    const checkCapacity = vi.fn(async () => check());
    const { result } = setup(options, checkCapacity);

    await act(async () => {
      await result.current.begin();
    });

    expect(checkCapacity).toHaveBeenCalledWith("model:kimi");
    expect(options.onProceed).toHaveBeenCalledTimes(1);
    expect(options.onHeavy).not.toHaveBeenCalled();
    expect(options.onBlocked).not.toHaveBeenCalled();
    expect(result.current.lastCheck).toEqual(check());
    expect(result.current.checking).toBe(false);
  });

  it("routes a heavy action to the heavy confirm only after the gate verdict", async () => {
    const options = makeOptions();
    const checkCapacity = vi.fn(async () => check({ heavy: true }));
    const { result } = setup({ ...options, heavy: true }, checkCapacity);

    await act(async () => {
      await result.current.begin();
    });

    expect(options.onHeavy).toHaveBeenCalledTimes(1);
    expect(options.onProceed).not.toHaveBeenCalled();
    expect(options.onBlocked).not.toHaveBeenCalled();
  });

  it("blocks and hands the gate result back for the dialog", async () => {
    const options = makeOptions();
    const blocked = check({ ok: false, verdict: "insufficient_gpu", deficit: { gpus: 1 } });
    const checkCapacity = vi.fn(async () => blocked);
    const { result } = setup(options, checkCapacity);

    await act(async () => {
      await result.current.begin();
    });

    expect(options.onBlocked).toHaveBeenCalledWith(blocked);
    expect(result.current.lastCheck).toEqual(blocked);
    expect(options.onProceed).not.toHaveBeenCalled();
  });

  it("fails closed when the capacity utility throws", async () => {
    const options = makeOptions();
    const checkCapacity = vi.fn(async () => {
      throw new Error("capacity utility missing");
    });
    const { result } = setup(options, checkCapacity);

    await act(async () => {
      await result.current.begin();
    });

    expect(options.onError).toHaveBeenCalledTimes(1);
    expect(options.onProceed).not.toHaveBeenCalled();
    expect(options.onHeavy).not.toHaveBeenCalled();
    expect(options.onBlocked).not.toHaveBeenCalled();
    expect(result.current.lastCheck).toBeNull();
    expect(result.current.checking).toBe(false);
  });

  it("fails closed on a non-Error throw and on a malformed verdict", async () => {
    const options = makeOptions();
    const { result } = setup(
      options,
      vi.fn(async () => "not-a-check" as unknown as CapacityCheck)
    );

    await act(async () => {
      await result.current.begin();
    });

    expect(options.onError).toHaveBeenCalledTimes(1);
    expect(options.onProceed).not.toHaveBeenCalled();
    expect(result.current.lastCheck).toBeNull();
  });

  it("fails closed when ok is not a real boolean", async () => {
    const options = makeOptions();
    const dodgy = { ...check(), ok: "yes" } as unknown as CapacityCheck;
    const { result } = setup(
      options,
      vi.fn(async () => dodgy)
    );

    await act(async () => {
      await result.current.begin();
    });

    expect(options.onError).toHaveBeenCalledTimes(1);
    expect(options.onBlocked).not.toHaveBeenCalled();
    expect(options.onProceed).not.toHaveBeenCalled();
    expect(result.current.lastCheck).toBeNull();
  });

  it("recheck proceeds once resources are freed", async () => {
    const options = makeOptions();
    const checkCapacity = vi
      .fn()
      .mockResolvedValueOnce(check({ ok: false }))
      .mockResolvedValueOnce(check({ ok: true }));
    const { result } = setup(options, checkCapacity);

    await act(async () => {
      await result.current.begin();
    });
    expect(options.onBlocked).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.recheck();
    });

    expect(options.onProceed).toHaveBeenCalledTimes(1);
    expect(options.onBlocked).toHaveBeenCalledTimes(1);
    expect(result.current.lastCheck?.ok).toBe(true);
  });

  it("recheck escalates to heavy confirm for a heavy action", async () => {
    const options = makeOptions();
    const { result } = setup(
      { ...options, heavy: true },
      vi.fn(async () => check({ heavy: true }))
    );

    await act(async () => {
      await result.current.recheck();
    });

    expect(options.onHeavy).toHaveBeenCalledTimes(1);
    expect(options.onProceed).not.toHaveBeenCalled();
  });

  it("recheck keeps the dialog open when the recheck still fails", async () => {
    const options = makeOptions();
    const stillBlocked = check({ ok: false });
    const { result } = setup(
      options,
      vi.fn(async () => stillBlocked)
    );

    await act(async () => {
      await result.current.recheck();
    });

    expect(options.onBlocked).toHaveBeenCalledWith(stillBlocked);
    expect(options.onProceed).not.toHaveBeenCalled();
  });

  it("recheck is re-entry guarded and survives a throw", async () => {
    const options = makeOptions();
    let release = (): void => undefined;
    const checkCapacity = vi.fn(
      () =>
        new Promise<CapacityCheck>((resolve) => {
          release = () => resolve(check());
        })
    );
    const { result } = setup(options, checkCapacity);

    act(() => {
      void result.current.recheck();
      void result.current.recheck();
    });
    expect(checkCapacity).toHaveBeenCalledTimes(1);

    act(() => release());
    await waitFor(() => expect(result.current.checking).toBe(false));

    const throwing = vi.fn(async () => {
      throw new Error("nope");
    });
    const failed = setup(options, throwing);
    await act(async () => {
      await failed.result.current.recheck();
    });
    expect(options.onError).toHaveBeenCalled();
    expect(failed.result.current.checking).toBe(false);
  });

  it("reset clears the remembered gate result", async () => {
    const options = makeOptions();
    const { result } = setup(
      options,
      vi.fn(async () => check({ ok: false }))
    );

    await act(async () => {
      await result.current.begin();
    });
    expect(result.current.lastCheck).not.toBeNull();

    act(() => {
      result.current.reset();
    });
    expect(result.current.lastCheck).toBeNull();
  });
});
