import { describe, it, expect } from "vitest";
import { humanSize, formatTimestamp, formatK8sQuantity, truncateOutput } from "../format";

describe("format helpers", () => {
  it("humanSize formats byte scales", () => {
    expect(humanSize(512)).toBe("512 B");
    expect(humanSize(2048)).toContain("KB");
    expect(humanSize(1024 * 1024 * 500)).toContain("MB");
    expect(humanSize(1024 * 1024 * 1024)).toContain("GB");
  });

  it("humanSize has a TB tier so a multi-terabyte model dir is not 4096 GB", () => {
    expect(humanSize(4 * 1024 ** 4)).toBe("4.00 TB");
    expect(humanSize(4 * 1024 ** 4, 1)).toBe("4.0 TB");
    expect(humanSize(1024 ** 4)).toBe("1.00 TB");
  });

  it("humanSize renders zero and sub-byte counts as a plain byte count", () => {
    expect(humanSize(0)).toBe("0 B");
    expect(humanSize(1)).toBe("1 B");
    expect(humanSize(1023)).toBe("1023 B");
  });

  it("formatTimestamp handles empty input", () => {
    expect(formatTimestamp(null)).toBe("—");
    expect(formatTimestamp(0)).toBe("—");
    expect(formatTimestamp(undefined)).toBe("—");
  });

  it("formatTimestamp is locale- and timezone-independent", () => {
    // 2026-11-06T12:34:56Z, asserted as a literal so no host locale can move it.
    expect(formatTimestamp(Date.parse("2026-11-06T12:34:56.000Z") / 1000)).toBe("2026-11-06 12:34:56 UTC");
  });

  it("formatTimestamp is stable across repeated calls", () => {
    const first = formatTimestamp(1_700_000_000);
    expect(formatTimestamp(1_700_000_000)).toBe(first);
    expect(first).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/);
  });

  it("formatK8sQuantity normalises memory suffixes", () => {
    expect(formatK8sQuantity("60.8Gi")).toBe("60.8 GiB");
    expect(formatK8sQuantity("512Mi")).toBe("512.0 MiB");
    expect(formatK8sQuantity("2Ti", 0)).toBe("2 TiB");
    expect(formatK8sQuantity("4G")).toBe("4.0 GB");
  });

  it("formatK8sQuantity fixes the decimal precision of bare counts", () => {
    expect(formatK8sQuantity("17.7")).toBe("17.7");
    expect(formatK8sQuantity("28")).toBe("28.0");
    expect(formatK8sQuantity("28", 0)).toBe("28");
  });

  it("formatK8sQuantity converts milli to a plain count", () => {
    expect(formatK8sQuantity("500m")).toBe("0.5");
    expect(formatK8sQuantity("250m", 2)).toBe("0.25");
  });

  it("formatK8sQuantity degrades without hiding anything", () => {
    expect(formatK8sQuantity(null)).toBe("—");
    expect(formatK8sQuantity(undefined)).toBe("—");
    expect(formatK8sQuantity("   ")).toBe("—");
    expect(formatK8sQuantity("not-a-quantity")).toBe("not-a-quantity");
    expect(formatK8sQuantity("8Xi")).toBe("8Xi");
  });

  it("truncateOutput caps length", () => {
    const long = "x".repeat(5000);
    expect(truncateOutput(long, 100).length).toBeLessThanOrEqual(101);
    expect(truncateOutput("short")).toBe("short");
  });
});
