/**
 * Type-scale gate for shipped dashboard surfaces.
 *
 * The audit found 25 arbitrary `text-[10px]` declarations spread over 14 files.
 * Ten-pixel text is below the floor most operators can read on a wall-mounted
 * console, and an arbitrary value bypasses the `@theme` type steps, so it never
 * responds to the scale the way `text-xs` does. The same defect kept reappearing
 * because nothing checked: a reviewer's note is a reminder, this file is a gate.
 *
 * Font size must come from the Tailwind scale (`text-xs`, `text-sm`, …). An
 * arbitrary `text-[<n>px]` in app or component source fails the build. If a
 * surface genuinely needs a size the scale lacks, add a `@theme` step instead of
 * reaching for a bracket value.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const DASHBOARD_DIR = path.resolve(__dirname, "..", "..");

/** Directories whose shipped source must stay on the type scale. */
const SCANNED_DIRS: readonly string[] = [path.join(DASHBOARD_DIR, "app"), path.join(DASHBOARD_DIR, "components")];

/** Bracket font sizes, e.g. `text-[10px]`. The scale is the only sanctioned source. */
const ARBITRARY_FONT_SIZE_RE = /\btext-\[\d*\.?\d+px\]/;

/** Test trees may set any size they like; they never ship. */
const TEST_PATH_RE = /[\\/]__tests__[\\/]/;

/**
 * Collect every shipped `.tsx` under a directory.
 * @param dir - Directory to walk.
 * @returns Absolute paths of the shipped React sources.
 */
function collectSources(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectSources(full));
    } else if (entry.isFile() && entry.name.endsWith(".tsx") && !TEST_PATH_RE.test(full)) {
      found.push(full);
    }
  }
  return found;
}

interface Offence {
  readonly file: string;
  readonly line: number;
  readonly match: string;
}

/**
 * Strip comments so prose about a banned class does not fail the build.
 *
 * Only block comments and whole-line `//` comments are removed: an unanchored
 * `//` strip would eat the slash in a URL that sits in a class string.
 * @param text - One source line.
 * @param inBlock - Whether the previous line left an open block comment.
 * @returns The code-only view of the line, plus the new block-comment state.
 */
function stripComments(text: string, inBlock: boolean): [string, boolean] {
  let code = "";
  let open = inBlock;
  let rest = text;
  while (rest.length > 0) {
    if (open) {
      const end = rest.indexOf("*/");
      if (end === -1) return [code, true];
      rest = rest.slice(end + 2);
      open = false;
      continue;
    }
    const block = rest.indexOf("/*");
    const line = rest.indexOf("//");
    if (line !== -1 && (block === -1 || line < block)) {
      // A `//` that opens the line is a comment; one inside a token is not trusted,
      // so only whole-line comments are treated as prose.
      if (rest.slice(0, line).trim() === "") return [code, false];
    }
    if (block === -1) {
      code += rest;
      break;
    }
    code += rest.slice(0, block);
    rest = rest.slice(block + 2);
    open = true;
  }
  return [code, open];
}

/**
 * Find every bracket font size in the shipped sources.
 * @returns One entry per offending match, with the dashboard-relative path.
 */
function findOffences(): Offence[] {
  const offences: Offence[] = [];
  for (const dir of SCANNED_DIRS) {
    for (const file of collectSources(dir)) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      let inBlock = false;
      lines.forEach((text, index) => {
        const [code, next] = stripComments(text, inBlock);
        inBlock = next;
        for (const match of code.matchAll(new RegExp(ARBITRARY_FONT_SIZE_RE, "g"))) {
          offences.push({ file: path.relative(DASHBOARD_DIR, file), line: index + 1, match: match[0] });
        }
      });
    }
  }
  return offences;
}

describe("type scale", () => {
  it("scans a non-empty set of shipped sources", () => {
    // A gate that inspected nothing must not pass.
    const scanned = SCANNED_DIRS.flatMap(collectSources);
    expect(scanned.length, "no shipped sources found to scan").toBeGreaterThan(20);
  });

  it("keeps every font size on the Tailwind scale", () => {
    const offences = findOffences();
    expect(
      offences.map((o) => `${o.file}:${o.line} ${o.match}`),
      "arbitrary bracket font sizes; use text-xs/text-sm or add a @theme step"
    ).toEqual([]);
  });
});
