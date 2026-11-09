/**
 * Guards the self-hosted typeface.
 *
 * The dashboard used to inherit Tailwind's system stack, so one build rendered in DejaVu Sans
 * on a Linux box, Noto Sans inside the pinned test image, and Segoe UI on an operator's laptop.
 * Text metrics follow the font, which made every Playwright baseline environment-dependent.
 * These assertions fail if the pin is dropped, because the symptom only shows up much later,
 * as unexplained pixel diffs in CI.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const APP_DIR = path.join(__dirname, "..", "..", "app");
const LAYOUT = path.join(APP_DIR, "layout.tsx");
const GLOBALS = path.join(APP_DIR, "globals.css");

/** Faces the visual lane measures against; keep in step with `app/layout.tsx`. */
const BUNDLED_FACES = [
  { file: "fonts/NotoSans-latin.woff2", token: "--font-noto-sans" },
  { file: "fonts/NotoSansMono-latin.woff2", token: "--font-noto-sans-mono" }
] as const;

/** woff2 files start with this signature; anything else is not a font a browser will take. */
const WOFF2_SIGNATURE = "wOF2";

/**
 * Find the `localFont` handle that publishes a token.
 *
 * The layout attaches the handle (`notoSans.variable`), while the token only appears inside the
 * `localFont` call, so the two have to be bound together before either assertion means anything.
 *
 * @param source - Contents of `app/layout.tsx`.
 * @param token - The CSS custom property to look up.
 * @returns The const name, or an empty string when nothing publishes it.
 */
function handleForToken(source: string, token: string): string {
  for (const match of source.matchAll(/const\s+(\w+)\s*=\s*localFont\(\{[^}]*variable:\s*"([^"]+)"/g)) {
    if (match[2] === token) return match[1] ?? "";
  }
  return "";
}

describe("self-hosted typeface", () => {
  const layout = fs.readFileSync(LAYOUT, "utf8");
  const globals = fs.readFileSync(GLOBALS, "utf8");

  it("loads faces through next/font/local rather than a system stack", () => {
    expect(layout).toMatch(/from "next\/font\/local"/);
    expect(layout).toMatch(/localFont\(/);
  });

  it.each(BUNDLED_FACES)("ships $file as a real woff2", ({ file }) => {
    const file_path = path.join(APP_DIR, file);
    expect(fs.existsSync(file_path), `${file} is missing`).toBe(true);
    const head = fs.readFileSync(file_path).subarray(0, 4).toString("latin1");
    expect(head, `${file} is not woff2`).toBe(WOFF2_SIGNATURE);
    expect(fs.statSync(file_path).size, `${file} is too small to hold a face`).toBeGreaterThan(4096);
  });

  it.each(BUNDLED_FACES)("exposes $token to Tailwind's theme", ({ token }) => {
    expect(layout).toContain(`variable: "${token}"`);
    expect(globals).toContain(token);
  });

  it("routes font-sans and font-mono through the bundled faces", () => {
    const sans = globals.match(/--font-sans:\s*([^;]+);/);
    const mono = globals.match(/--font-mono:\s*([^;]+);/);
    expect(sans, "--font-sans is not declared in globals.css").not.toBeNull();
    expect(mono, "--font-mono is not declared in globals.css").not.toBeNull();
    expect(sans?.[1]).toContain("var(--font-noto-sans)");
    expect(mono?.[1]).toContain("var(--font-noto-sans-mono)");
  });

  it("applies both families on the document element", () => {
    for (const { token } of BUNDLED_FACES) {
      const handle = handleForToken(layout, token);
      expect(handle, `no localFont handle publishes ${token}`).not.toBe("");
      expect(layout, `${token} never reaches <html>`).toContain(`${handle}.variable`);
    }
  });
});
