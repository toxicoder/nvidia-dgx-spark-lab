import { describe, it, expect } from "vitest";
import { humanSize, formatTimestamp, truncateOutput } from "../format";

describe("format helpers", () => {
  it("humanSize formats byte scales", () => {
    expect(humanSize(512)).toBe("512 B");
    expect(humanSize(2048)).toContain("KB");
    expect(humanSize(1024 * 1024 * 500)).toContain("MB");
    expect(humanSize(1024 * 1024 * 1024)).toContain("GB");
  });

  it("formatTimestamp handles empty input", () => {
    expect(formatTimestamp(null)).toBe("—");
    expect(formatTimestamp(0)).toBe("—");
  });

  it("truncateOutput caps length", () => {
    const long = "x".repeat(5000);
    expect(truncateOutput(long, 100).length).toBeLessThanOrEqual(101);
  });
});
