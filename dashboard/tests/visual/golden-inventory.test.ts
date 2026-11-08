import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { expectedGoldenFilenames, EXPECTED_GOLDEN_COUNT } from "./expected-goldens";

const GOLDENS_DIR = path.join(__dirname, "goldens");

const updatingSnapshots = process.env.UPDATE_SNAPSHOTS === "1";

/** PNG signature; anything else is a truncated or placeholder file. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Below this a file cannot hold a real capture, only a stub. */
const MIN_BYTES = 256;

/**
 * Compressed bytes per pixel a genuine capture must average.
 *
 * A flat single-colour screenshot of the same area compresses to roughly 0.004-0.007
 * bytes/px (0.012 at the very smallest sizes), while every real golden here sits at
 * 0.024 or above. The floor therefore rejects a blank or unrendered page — the exact
 * failure the old name-only check let through — without touching legitimate captures.
 * Small element crops compress too unevenly for the ratio to mean anything, so those
 * fall back to {@link MIN_BYTES}.
 */
const MIN_BYTES_PER_PIXEL = 0.015;

/** Area below which the ratio is not a trustworthy blankness signal. */
const RATIO_FLOOR_MIN_AREA = 20_000;

/** Widest capture the suite takes; the desktop viewport. */
const MAX_WIDTH = 1280;

/** Tallest element capture observed (the full sidebar at 5287) with room to spare. */
const MAX_HEIGHT = 8000;

interface GoldenHeader {
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Read a golden's size and the IHDR dimensions, without a PNG dependency.
 * @param file - Absolute path to the golden.
 * @returns Byte length plus declared width and height.
 * @throws When the file is shorter than an IHDR chunk or is not a PNG.
 */
function readGolden(file: string): GoldenHeader {
  const buf = fs.readFileSync(file);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${path.basename(file)} is not a PNG`);
  }
  return { bytes: buf.length, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("visual golden inventory", () => {
  const onDisk = fs
    .readdirSync(GOLDENS_DIR)
    .filter((name) => name.endsWith(".png"))
    .sort();

  it.skipIf(updatingSnapshots)("matches visual spec capture names exactly (no orphans, no missing)", () => {
    const expected = new Set(expectedGoldenFilenames());

    const orphans = onDisk.filter((name) => !expected.has(name));
    const missing = [...expected].filter((name) => !onDisk.includes(name));

    expect(orphans, `orphan goldens: ${orphans.join(", ")}`).toEqual([]);
    expect(missing, `missing goldens: ${missing.join(", ")}`).toEqual([]);
    expect(onDisk).toHaveLength(EXPECTED_GOLDEN_COUNT);
  });

  it("has goldens on disk to check at all", () => {
    // A gate over an empty directory is not a gate.
    expect(onDisk.length, `no PNGs found in ${GOLDENS_DIR}`).toBeGreaterThan(0);
  });

  it.skipIf(updatingSnapshots)("stores every golden as a PNG with real pixel content", () => {
    const problems: string[] = [];

    for (const name of onDisk) {
      try {
        const { bytes, width, height } = readGolden(path.join(GOLDENS_DIR, name));
        if (width <= 0 || height <= 0) problems.push(`${name}: zero-sized`);
        if (width > MAX_WIDTH) problems.push(`${name}: width ${width} exceeds ${MAX_WIDTH}`);
        if (height > MAX_HEIGHT) problems.push(`${name}: height ${height} exceeds ${MAX_HEIGHT}`);
        if (bytes < MIN_BYTES) problems.push(`${name}: only ${bytes} bytes`);
        if (width * height >= RATIO_FLOOR_MIN_AREA && bytes / (width * height) < MIN_BYTES_PER_PIXEL) {
          problems.push(`${name}: ${(bytes / (width * height)).toFixed(4)} bytes/px looks blank`);
        }
      } catch (error) {
        problems.push(`${name}: ${(error as Error).message}`);
      }
    }

    expect(problems, `unusable goldens:\n${problems.join("\n")}`).toEqual([]);
  });
});
