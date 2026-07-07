import { describe, it, expect } from "vitest";
import { computeStorageKpis } from "@/lib/storage-stats";
import { fakeTree } from "@/lib/mocks/fixtures";

describe("computeStorageKpis", () => {
  it("computes totals from tree children", () => {
    const kpis = computeStorageKpis(fakeTree);
    expect(kpis.itemCount).toBe(fakeTree.children?.length ?? 0);
    expect(kpis.largestName).toBe("llama-3-70b");
    expect(kpis.largestPct).toBeGreaterThan(0);
    expect(kpis.totalStorage).toMatch(/GB/);
  });

  it("handles empty tree gracefully", () => {
    const kpis = computeStorageKpis({ name: "root", path: "/", size: 0, isDir: true, children: [] });
    expect(kpis.itemCount).toBe(0);
    expect(kpis.largestName).toBe("—");
    expect(kpis.largestPct).toBe(0);
  });

  it("uses tree.size when children are empty", () => {
    const kpis = computeStorageKpis({ name: "solo", path: "/solo", size: 1024, isDir: true, children: [] });
    expect(kpis.totalBytes).toBe(1024);
  });

  it("handles null tree input", () => {
    const kpis = computeStorageKpis(null);
    expect(kpis.itemCount).toBe(0);
    expect(kpis.totalBytes).toBe(0);
  });

  it("uses tree.size when children sum to zero", () => {
    const kpis = computeStorageKpis({
      name: "root",
      path: "/r",
      size: 500,
      isDir: true,
      children: [{ name: "empty", path: "/r/empty", size: 0, isDir: false }]
    });
    expect(kpis.totalBytes).toBe(500);
  });

  it("handles tree nodes without children array", () => {
    const kpis = computeStorageKpis({ name: "solo", path: "/solo", size: 2048, isDir: true });
    expect(kpis.itemCount).toBe(0);
    expect(kpis.totalBytes).toBe(2048);
  });

  it("sorts children when sizes are zero or missing", () => {
    const kpis = computeStorageKpis({
      name: "root",
      path: "/r",
      size: 0,
      isDir: true,
      children: [
        { name: "zero", path: "/r/zero", size: 0, isDir: false },
        { name: "missing", path: "/r/missing", size: 0, isDir: false },
        { name: "winner", path: "/r/winner", size: 50, isDir: false }
      ]
    });
    expect(kpis.largestName).toBe("winner");
    expect(kpis.totalBytes).toBe(50);
  });

  it("handles children with missing sizes", () => {
    const kpis = computeStorageKpis({
      name: "root",
      path: "/r",
      size: 0,
      isDir: true,
      children: [
        { name: "a", path: "/r/a", size: 0, isDir: false },
        { name: "b", path: "/r/b", size: 100, isDir: false }
      ]
    });
    expect(kpis.totalBytes).toBe(100);
    expect(kpis.largestName).toBe("b");
  });
});
