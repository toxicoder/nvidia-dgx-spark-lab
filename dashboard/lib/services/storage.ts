import fs from "fs/promises";
import path from "path";
import { withMock } from "../host";
import { fakeEmptyDuplicates, fakeTree, fakeVisualTree } from "../mocks/fixtures";
import { isPathAllowed } from "../path-security";
import type { DuplicateFindResult, TreeNode } from "../types";

/** Re-export path whitelist guard used by {@link PathSchema}. */
export { isPathAllowed } from "../path-security";

/**
 * Storage service for treemap visualization and safe file operations.
 * All paths are scoped to LAB_WHITELIST_BASES for security.
 */

function mockStorageTree(): TreeNode {
  return process.env.VISUAL_TEST === "1" ? fakeVisualTree : fakeTree;
}

/**
 * Build a size-annotated directory tree for treemap visualization.
 * @param targetPath - Root path (must pass whitelist check).
 * @param maxDepth - Maximum recursion depth (default 3).
 * @returns {@link TreeNode} hierarchy sorted by size descending.
 * @throws When path is outside lab whitelist bases.
 */
export async function getStorageTree(targetPath = "/mnt/models", maxDepth = 3): Promise<TreeNode> {
  return withMock(mockStorageTree(), async () => {
    if (!isPathAllowed(targetPath)) throw new Error("Path not allowed");

    async function walk(dir: string, depth: number): Promise<TreeNode> {
      if (depth > maxDepth) {
        return { name: path.basename(dir), path: dir, size: 0, isDir: true };
      }
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        let total = 0;
        const children: TreeNode[] = [];
        for (const entry of entries.slice(0, 30)) {
          const full = path.join(dir, entry.name);
          const stat = await fs.stat(full);
          const isDir = entry.isDirectory();
          const ext = !isDir ? (entry.name.split(".").pop() || "").toLowerCase() : null;
          const node: TreeNode = {
            name: entry.name,
            path: full,
            size: stat.size,
            isDir,
            ext,
            type: isDir ? "dir" : "file"
          };
          if (isDir) {
            const sub = await walk(full, depth + 1);
            node.size = sub.size || 0;
            node.children = sub.children;
          }
          total += node.size;
          children.push(node);
        }
        children.sort((a, b) => (b.size || 0) - (a.size || 0));
        return {
          name: path.basename(dir),
          path: dir,
          size: total,
          isDir: true,
          children
        };
      } catch {
        return {
          name: path.basename(dir),
          path: dir,
          size: 0,
          isDir: true
        };
      }
    }
    return walk(targetPath, 0);
  });
}

/**
 * Move a whitelisted path to lab trash (safe delete, not permanent rm).
 * @param target - Absolute path to move.
 * @returns Trash directory where the item was relocated.
 * @throws When path is outside lab whitelist bases.
 */
export async function deletePath(target: string): Promise<{ movedToTrash: string }> {
  if (process.env.USE_MOCKS === "1") {
    if (!isPathAllowed(target)) throw new Error("Path not allowed");
    return { movedToTrash: `/tmp/lab-trash/deleted-mock-${Date.now()}` };
  }
  if (!isPathAllowed(target)) throw new Error("Path not allowed");
  const trash = `/tmp/lab-trash/deleted-${Date.now()}`;
  await fs.mkdir(trash, { recursive: true });
  await fs.rename(target, path.join(trash, path.basename(target)));
  return { movedToTrash: trash };
}

/**
 * Scan for duplicate files grouped by exact byte size.
 * @param targetPath - Root path to scan (default `/mnt/models`).
 * @param minSize - Minimum file size in bytes (default 10 MiB).
 * @param options - Optional `{ empty: true }` for visual-test empty fixture.
 * @returns Groups of files sharing the same size.
 * @throws When path is outside lab whitelist bases.
 */
export async function findDuplicates(
  targetPath = "/mnt/models",
  minSize = 10 * 1024 * 1024,
  options?: { empty?: boolean }
): Promise<DuplicateFindResult> {
  const mockResult =
    options?.empty && process.env.VISUAL_TEST === "1"
      ? fakeEmptyDuplicates
      : {
          groups: [
            {
              size: 4200000000,
              files: ["/mnt/models/mistral-7b.gguf", "/mnt/models/mistral-7b-dupe.gguf"]
            },
            {
              size: 100000000,
              files: ["/mnt/models/small1.bin", "/mnt/models/small1-dupe.bin"]
            }
          ]
        };

  return withMock(mockResult, async () => {
    if (!isPathAllowed(targetPath)) throw new Error("Path not allowed");
    const sizeMap: Record<number, string[]> = {};
    async function scan(dir: string) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await scan(full);
          } else {
            const stat = await fs.stat(full);
            if (stat.size >= minSize) {
              if (!sizeMap[stat.size]) sizeMap[stat.size] = [];
              sizeMap[stat.size].push(full);
            }
          }
        }
      } catch {
        /* skip unreadable dirs */
      }
    }
    await scan(targetPath);
    const groups = Object.entries(sizeMap)
      .filter(([, files]) => files.length > 1)
      .map(([size, files]) => ({ size: parseInt(size, 10), files }))
      .sort((a, b) => b.size - a.size);
    return { groups };
  });
}
