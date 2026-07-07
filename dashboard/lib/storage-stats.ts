import { humanSize } from "@/lib/format";
import type { StorageKpis, TreeNode } from "@/lib/types";

/** Compute KPI values from a storage tree root node. */
export function computeStorageKpis(tree: TreeNode | null | undefined): StorageKpis {
  const children = tree?.children || [];
  const computedTotal = children.reduce((s, c) => s + (c.size || 0), 0) || tree?.size || 0;
  const sorted = [...children].sort((a, b) => (b.size || 0) - (a.size || 0));
  const largest = sorted[0];
  const largestSize = largest?.size || 0;
  const largestPct = computedTotal > 0 ? Math.round((largestSize / computedTotal) * 100) : 0;

  return {
    totalBytes: computedTotal,
    totalStorage: humanSize(computedTotal, 1),
    itemCount: children.length,
    largestName: largest?.name || "—",
    largestBytes: largestSize,
    largestModel: humanSize(largestSize, 1),
    largestPct
  };
}
