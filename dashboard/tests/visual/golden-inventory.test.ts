import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { expectedGoldenFilenames, EXPECTED_GOLDEN_COUNT } from "./expected-goldens";

const GOLDENS_DIR = path.join(__dirname, "goldens");

const updatingSnapshots = process.env.UPDATE_SNAPSHOTS === "1";

describe("visual golden inventory", () => {
  it.skipIf(updatingSnapshots)("matches visual spec capture names exactly (no orphans, no missing)", () => {
    const expected = new Set(expectedGoldenFilenames());
    const onDisk = fs
      .readdirSync(GOLDENS_DIR)
      .filter((name) => name.endsWith(".png"))
      .sort();

    const orphans = onDisk.filter((name) => !expected.has(name));
    const missing = [...expected].filter((name) => !onDisk.includes(name));

    expect(orphans, `orphan goldens: ${orphans.join(", ")}`).toEqual([]);
    expect(missing, `missing goldens: ${missing.join(", ")}`).toEqual([]);
    expect(onDisk).toHaveLength(EXPECTED_GOLDEN_COUNT);
  });
});
