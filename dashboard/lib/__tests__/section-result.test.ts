import { describe, it, expect } from "vitest";

import { attempt, firstError, sectionFailureMessage } from "@/lib/section-result";

describe("attempt", () => {
  it("wraps a resolved value as a success", async () => {
    await expect(attempt(async () => 7)).resolves.toEqual({ ok: true, data: 7 });
  });

  it("wraps a synchronous value as a success", async () => {
    await expect(attempt(() => "gpu")).resolves.toEqual({ ok: true, data: "gpu" });
  });

  it("captures an Error as a failure carrying its message", async () => {
    const result = await attempt(async () => {
      throw new Error("kubectl exited 1");
    });
    expect(result).toEqual({ ok: false, error: "kubectl exited 1" });
  });

  it("captures a thrown string as a failure", async () => {
    const result = await attempt(async () => {
      // A rejected bare string is the case under test, so it stays a literal.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw "mount dead";
    });
    expect(result).toEqual({ ok: false, error: "mount dead" });
  });

  it("captures a thrown non-object without crashing", async () => {
    const result = await attempt(async () => {
      // A host call can reject with anything, so a plain object has to stringify, not crash.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw { weird: true };
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("unknown error");
  });

  it("collapses a multi-line error onto one line", async () => {
    const result = await attempt(async () => {
      throw new Error("line one\n  line two\nline three");
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("line one line two line three");
  });

  it("bounds a huge error so it cannot fill the card", async () => {
    const result = await attempt(async () => {
      throw new Error("x".repeat(5000));
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeLessThanOrEqual(240);
      expect(result.error.endsWith("…")).toBe(true);
    }
  });

  it("replaces an empty error message with something readable", async () => {
    const result = await attempt(async () => {
      throw new Error("   ");
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("unknown error");
  });
});

describe("firstError", () => {
  const ok = { ok: true, data: 1 } as const;

  it("returns undefined when every load succeeded", () => {
    expect(firstError([ok, ok])).toBeUndefined();
  });

  it("returns undefined for an empty list", () => {
    expect(firstError([])).toBeUndefined();
  });

  it("returns the first failure message", () => {
    expect(firstError([ok, { ok: false, error: "docker down" }, { ok: false, error: "ollama down" }])).toBe(
      "docker down"
    );
  });

  it("finds a failure at the front of the list", () => {
    expect(firstError([{ ok: false, error: "kubectl down" }, ok])).toBe("kubectl down");
  });
});

describe("sectionFailureMessage", () => {
  it("names the section and the cause", () => {
    expect(sectionFailureMessage("storage", "EACCES /mnt/models")).toBe("storage could not load: EACCES /mnt/models");
  });

  it("falls back to a generic cause when none is given", () => {
    expect(sectionFailureMessage("tasks")).toBe("tasks could not load: the host did not respond");
  });

  it("falls back when the cause is blank", () => {
    expect(sectionFailureMessage("tasks", "")).toBe("tasks could not load: the host did not respond");
  });
});
