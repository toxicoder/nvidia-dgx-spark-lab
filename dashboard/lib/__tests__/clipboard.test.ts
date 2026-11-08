import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { copyText, clearCopiedText } from "../clipboard";

/** Minimal clipboard double: records writes, answers reads from a held value. */
interface ClipboardDouble {
  writeText: ReturnType<typeof vi.fn>;
  readText: ReturnType<typeof vi.fn>;
}

function stubClipboard(double: ClipboardDouble | undefined): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    writable: true,
    value: double
  });
}

function double(held = ""): ClipboardDouble {
  return {
    writeText: vi.fn(async () => undefined),
    readText: vi.fn(async () => held)
  };
}

describe("clipboard helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    stubClipboard(undefined);
  });

  it("copyText resolves true when the write succeeds", async () => {
    const clip = double();
    stubClipboard(clip);

    await expect(copyText("https://node:3000")).resolves.toBe(true);
    expect(clip.writeText).toHaveBeenCalledWith("https://node:3000");
  });

  it("copyText resolves false when the write rejects", async () => {
    const clip = double();
    clip.writeText.mockRejectedValueOnce(new Error("Document is not focused"));
    stubClipboard(clip);

    await expect(copyText("secret")).resolves.toBe(false);
  });

  it("copyText resolves false when the clipboard is unavailable", async () => {
    stubClipboard(undefined);
    await expect(copyText("secret")).resolves.toBe(false);
  });

  it("copyText resolves false when writeText is missing", async () => {
    stubClipboard({ writeText: undefined, readText: vi.fn() } as unknown as ClipboardDouble);
    await expect(copyText("secret")).resolves.toBe(false);
  });

  it("clearCopiedText wipes only while the clipboard still holds our value", async () => {
    const clip = double("token-abc");
    stubClipboard(clip);

    await expect(clearCopiedText("token-abc")).resolves.toBe(true);
    expect(clip.readText).toHaveBeenCalled();
    expect(clip.writeText).toHaveBeenCalledWith("");
  });

  it("clearCopiedText leaves a foreign value untouched", async () => {
    const clip = double("a password the operator copied meanwhile");
    stubClipboard(clip);

    await expect(clearCopiedText("token-abc")).resolves.toBe(false);
    expect(clip.writeText).not.toHaveBeenCalled();
  });

  it("clearCopiedText resolves false when the clipboard cannot be read", async () => {
    const clip = double();
    clip.readText.mockRejectedValueOnce(new Error("read denied"));
    stubClipboard(clip);

    await expect(clearCopiedText("token-abc")).resolves.toBe(false);
    expect(clip.writeText).not.toHaveBeenCalled();
  });

  it("clearCopiedText resolves false when the clipboard is unavailable", async () => {
    stubClipboard(undefined);
    await expect(clearCopiedText("token-abc")).resolves.toBe(false);
  });

  it("clearCopiedText resolves false when readText is missing", async () => {
    stubClipboard({ writeText: vi.fn(), readText: undefined } as unknown as ClipboardDouble);
    await expect(clearCopiedText("token-abc")).resolves.toBe(false);
  });

  it("clearCopiedText resolves false when the wipe itself fails", async () => {
    const clip = double("token-abc");
    clip.writeText.mockRejectedValueOnce(new Error("write denied"));
    stubClipboard(clip);

    await expect(clearCopiedText("token-abc")).resolves.toBe(false);
  });
});

describe("copyText without a clipboard host", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports failure rather than throwing when there is no navigator at all", async () => {
    // A non-secure origin has no navigator.clipboard; a server render has no navigator.
    vi.stubGlobal("navigator", undefined);

    await expect(copyText("secret-value")).resolves.toBe(false);
  });
});
