import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("@/lib/db/repositories/preferences", () => ({
  getPreference: vi.fn().mockResolvedValue("spark-lime"),
  setPreference: vi.fn().mockResolvedValue(undefined)
}));

import { getPreferenceAction, setPreferenceAction } from "../preferences-actions";
import { getPreference, setPreference } from "@/lib/db/repositories/preferences";
import { requireSession } from "@/lib/require-session";

describe("preferences-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getPreferenceAction requires session and returns value", async () => {
    const value = await getPreferenceAction("theme");
    expect(requireSession).toHaveBeenCalled();
    expect(getPreference).toHaveBeenCalledWith("theme");
    expect(value).toBe("spark-lime");
  });

  it("setPreferenceAction persists preference", async () => {
    await setPreferenceAction("theme", "ocean-teal");
    expect(setPreference).toHaveBeenCalledWith("theme", "ocean-teal");
  });
});
