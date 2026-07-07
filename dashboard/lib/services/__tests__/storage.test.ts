import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.LAB_WHITELIST_BASES = "/mnt/models,/tmp";

const readdir = vi.hoisted(() => vi.fn());
const stat = vi.hoisted(() => vi.fn());
const mkdir = vi.hoisted(() => vi.fn());
const rename = vi.hoisted(() => vi.fn());

vi.mock("fs/promises", () => ({
  default: { readdir, stat, mkdir, rename },
  readdir,
  stat,
  mkdir,
  rename
}));

import * as storage from "../storage";

function makeDirent(name: string, isDir: boolean) {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir
  };
}

describe("storage service (mock)", () => {
  beforeEach(() => {
    process.env.USE_MOCKS = "1";
    delete process.env.VISUAL_TEST;
    readdir.mockReset();
    stat.mockReset();
    mkdir.mockReset();
    rename.mockReset();
  });

  it("isPathAllowed respects whitelist", () => {
    process.env.LAB_WHITELIST_BASES = "/mnt/models,/tmp";
    expect(storage.isPathAllowed("/mnt/models/foo")).toBe(true);
    expect(storage.isPathAllowed("/etc/passwd")).toBe(false);
  });

  it("isPathAllowed rejects prefix bypass paths", () => {
    process.env.LAB_WHITELIST_BASES = "/mnt/models,/tmp";
    expect(storage.isPathAllowed("/mnt/models-evil")).toBe(false);
    expect(storage.isPathAllowed("/mnt/models/foo")).toBe(true);
  });

  it("findDuplicates returns groups for large dups", async () => {
    const res = await storage.findDuplicates("/mnt/models", 1);
    expect(res).toHaveProperty("groups");
    expect(res.groups.length).toBeGreaterThan(0);
  });

  it("findDuplicates returns visual empty groups when VISUAL_TEST=1 and empty option", async () => {
    process.env.VISUAL_TEST = "1";
    const res = await storage.findDuplicates("/mnt/models", 1, { empty: true });
    expect(res.groups).toEqual([]);
  });

  it("getStorageTree returns tree structure (uses mock when USE_MOCKS=1)", async () => {
    const tree = await storage.getStorageTree("/tmp", 1);
    expect(tree).toHaveProperty("name");
    expect(tree).toHaveProperty("isDir", true);
  });

  it("getStorageTree uses fakeTree when VISUAL_TEST is unset", async () => {
    const tree = await storage.getStorageTree("/mnt/models", 1);
    expect(tree.path).toBe("/mnt/models");
  });

  it("getStorageTree uses default path arguments under mock mode", async () => {
    const tree = await storage.getStorageTree();
    expect(tree.path).toBe("/mnt/models");
  });

  it("getStorageTree uses visual tree when VISUAL_TEST=1", async () => {
    process.env.VISUAL_TEST = "1";
    const tree = await storage.getStorageTree("/mnt/models", 3);
    expect(tree.path).toBe("/mnt/models");
    expect(tree.children?.length).toBeGreaterThan(0);
  });

  it("findDuplicates uses visual empty fixture when requested", async () => {
    process.env.VISUAL_TEST = "1";
    const res = await storage.findDuplicates("/mnt/models", 1, { empty: true });
    expect(res.groups).toEqual([]);
  });

  it("deletePath respects whitelist (errors on bad path)", async () => {
    await expect(storage.deletePath("/etc/passwd")).rejects.toThrow(/Path not allowed/);
  });

  it("deletePath returns mock trash path", async () => {
    const result = await storage.deletePath("/mnt/models/file.bin");
    expect(result.movedToTrash).toMatch(/deleted-mock-/);
  });
});

describe("storage service (real path)", () => {
  beforeEach(() => {
    process.env.USE_MOCKS = "0";
    process.env.LAB_WHITELIST_BASES = "/mnt/models,/tmp";
    delete process.env.VISUAL_TEST;
    readdir.mockReset();
    stat.mockReset();
    mkdir.mockReset();
    rename.mockReset();
  });

  afterEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("getStorageTree rejects disallowed paths", async () => {
    await expect(storage.getStorageTree("/etc/passwd")).rejects.toThrow(/Path not allowed/);
  });

  it("getStorageTree walks directory nodes without file extensions", async () => {
    readdir.mockImplementation(async (dir: string) => {
      if (dir === "/mnt/models") {
        return [makeDirent("subdir", true)];
      }
      if (dir === "/mnt/models/subdir") {
        return [makeDirent("nested.bin", false)];
      }
      return [];
    });
    stat.mockImplementation(async (full: string) => {
      if (full.endsWith("nested.bin")) return { size: 10 };
      return { size: 10 };
    });

    const tree = await storage.getStorageTree("/mnt/models", 2);
    const subdir = tree.children?.find((c) => c.name === "subdir");
    expect(subdir?.isDir).toBe(true);
    expect(subdir?.ext).toBeNull();
  });

  it("getStorageTree walks files and directories", async () => {
    readdir.mockImplementation(async (dir: string) => {
      if (dir === "/mnt/models") {
        return [makeDirent("subdir", true), makeDirent("model.gguf", false)];
      }
      if (dir === "/mnt/models/subdir") {
        return [makeDirent("nested.bin", false)];
      }
      return [];
    });
    stat.mockImplementation(async (full: string) => {
      if (full.endsWith("model.gguf")) return { size: 500 };
      if (full.endsWith("nested.bin")) return { size: 100 };
      return { size: 0 };
    });

    const tree = await storage.getStorageTree("/mnt/models", 3);
    expect(tree.isDir).toBe(true);
    expect(tree.children).toHaveLength(2);
    const names = tree.children?.map((c) => c.name).sort();
    expect(names).toEqual(["model.gguf", "subdir"]);
    expect(tree.children?.find((c) => c.name === "model.gguf")?.ext).toBe("gguf");
    expect(tree.size).toBe(600);
  });

  it("getStorageTree truncates depth beyond maxDepth", async () => {
    readdir.mockResolvedValue([makeDirent("deep", true)]);
    stat.mockResolvedValue({ size: 0 });

    const tree = await storage.getStorageTree("/mnt/models", 0);
    expect(tree.children?.[0].size).toBe(0);
    expect(tree.children?.[0].children).toBeUndefined();
  });

  it("getStorageTree handles unreadable directories", async () => {
    readdir.mockRejectedValue(new Error("EACCES"));
    const tree = await storage.getStorageTree("/mnt/models", 2);
    expect(tree.size).toBe(0);
    expect(tree.isDir).toBe(true);
  });

  it("getStorageTree handles dotfile extension segment", async () => {
    readdir.mockResolvedValueOnce([makeDirent(".hidden", false)]);
    stat.mockResolvedValueOnce({ size: 3 });

    const tree = await storage.getStorageTree("/mnt/models", 1);
    expect(tree.children?.[0].ext).toBe("hidden");
  });

  it("getStorageTree handles files with empty extension segment", async () => {
    readdir.mockResolvedValueOnce([makeDirent("noext", false)]);
    stat.mockResolvedValueOnce({ size: 7 });

    const tree = await storage.getStorageTree("/mnt/models", 1);
    expect(tree.children?.[0].ext).toBe("noext");
  });

  it("getStorageTree handles files without extension", async () => {
    readdir.mockResolvedValueOnce([makeDirent("README", false)]);
    stat.mockResolvedValueOnce({ size: 42 });

    const tree = await storage.getStorageTree("/mnt/models", 1);
    expect(tree.children?.[0].ext).toBe("readme");
  });

  it("deletePath rejects disallowed paths on real path", async () => {
    await expect(storage.deletePath("/etc/passwd")).rejects.toThrow(/Path not allowed/);
  });

  it("deletePath allows whitelisted paths on real path", async () => {
    mkdir.mockResolvedValue(undefined);
    rename.mockResolvedValue(undefined);
    const result = await storage.deletePath("/mnt/models/real-delete.bin");
    expect(result.movedToTrash).toMatch(/^\/tmp\/lab-trash\/deleted-/);
  });

  it("deletePath moves file to trash on real path", async () => {
    mkdir.mockResolvedValue(undefined);
    rename.mockResolvedValue(undefined);

    const result = await storage.deletePath("/mnt/models/lab-file.bin");
    expect(mkdir).toHaveBeenCalled();
    expect(rename).toHaveBeenCalled();
    expect(result.movedToTrash).toMatch(/^\/tmp\/lab-trash\/deleted-/);
  });

  it("findDuplicates rejects disallowed paths", async () => {
    await expect(storage.findDuplicates("/etc/passwd")).rejects.toThrow(/Path not allowed/);
  });

  it("findDuplicates scans filesystem for duplicate sizes", async () => {
    readdir.mockImplementation(async (dir: string) => {
      if (dir === "/mnt/models") {
        return [makeDirent("a.bin", false), makeDirent("nested", true)];
      }
      if (dir === "/mnt/models/nested") {
        return [makeDirent("b.bin", false)];
      }
      return [];
    });
    stat.mockResolvedValue({ size: 20_000_000 });

    const result = await storage.findDuplicates("/mnt/models", 10 * 1024 * 1024);
    expect(result.groups).toEqual([{ size: 20_000_000, files: ["/mnt/models/a.bin", "/mnt/models/nested/b.bin"] }]);
  });

  it("findDuplicates skips unreadable directories", async () => {
    readdir.mockRejectedValueOnce(new Error("EACCES"));
    const result = await storage.findDuplicates("/mnt/models", 1);
    expect(result.groups).toEqual([]);
  });

  it("getStorageTree uses default arguments on real path", async () => {
    readdir.mockResolvedValue([]);
    const tree = await storage.getStorageTree();
    expect(tree.path).toBe("/mnt/models");
  });

  it("getStorageTree handles trailing-dot filenames", async () => {
    readdir.mockResolvedValueOnce([makeDirent("model.", false)]);
    stat.mockResolvedValueOnce({ size: 11 });

    const tree = await storage.getStorageTree("/mnt/models", 1);
    expect(tree.children?.[0].ext).toBe("");
  });

  it("getStorageTree sorts children with missing and zero sizes", async () => {
    readdir.mockResolvedValueOnce([
      makeDirent("zero", false),
      makeDirent("missing", false),
      makeDirent("large", false)
    ]);
    stat.mockImplementation(async (full: string) => {
      if (full.endsWith("large")) return { size: 100 };
      if (full.endsWith("zero")) return { size: 0 };
      return { size: undefined };
    });

    const tree = await storage.getStorageTree("/mnt/models", 1);
    expect(tree.children?.[0].name).toBe("large");
  });

  it("findDuplicates uses default path on real path", async () => {
    readdir.mockResolvedValue([]);
    const result = await storage.findDuplicates();
    expect(result.groups).toEqual([]);
  });

  it("findDuplicates ignores files below minSize threshold", async () => {
    readdir.mockResolvedValueOnce([makeDirent("tiny.bin", false)]);
    stat.mockResolvedValueOnce({ size: 1024 });

    const result = await storage.findDuplicates("/mnt/models", 10 * 1024 * 1024);
    expect(result.groups).toEqual([]);
  });

  it("findDuplicates sorts groups by size descending", async () => {
    readdir.mockImplementation(async (dir: string) => {
      if (dir === "/mnt/models") {
        return [
          makeDirent("small-a", false),
          makeDirent("small-b", false),
          makeDirent("large-a", false),
          makeDirent("large-b", false)
        ];
      }
      return [];
    });
    stat.mockImplementation(async (full: string) => {
      if (full.includes("large")) return { size: 50_000_000 };
      return { size: 20_000_000 };
    });

    const result = await storage.findDuplicates("/mnt/models", 10 * 1024 * 1024);
    expect(result.groups).toEqual([
      { size: 50_000_000, files: ["/mnt/models/large-a", "/mnt/models/large-b"] },
      { size: 20_000_000, files: ["/mnt/models/small-a", "/mnt/models/small-b"] }
    ]);
  });
});
