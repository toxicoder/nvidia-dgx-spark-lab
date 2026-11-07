/**
 * Design-token drift and WCAG AA gate for the dashboard themes.
 *
 * The dashboard used to keep two parallel token systems (shadcn HSL triples in
 * `app/globals.css` and MD3 hex values re-declared per theme in
 * `app/themes.css`). Nothing checked that they agreed, that every theme defined
 * every property a component asked for, or that a light theme was actually
 * readable — so `daylight` shipped a primary button at 3.1:1, four components
 * rendered a border with no background (`--md-sys-color-surface-container-low`
 * was referenced by nothing and defined by nobody), and a Card, a Dialog and a
 * Toast painted three different greys for the same "surface" role.
 *
 * This gate parses both stylesheets with a small dependency-free scanner,
 * resolves each theme's `var()` alias chain the way a browser would, and holds
 * every text and boundary pair at WCAG 2.1 (4.5:1 body text, 3:1 large text and
 * non-text UI). It also asserts the catalog in `lib/themes.ts` and the theme
 * blocks in `app/themes.css` name exactly the same themes, which is what keeps
 * the bootstrap script derivable from the catalog instead of hand-copied.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

import { DASHBOARD_THEMES, DEFAULT_THEME_ID } from "@/lib/themes";

const DASHBOARD_DIR = path.resolve(__dirname, "..", "..");

/** Stylesheets that together define the token surface. Must stay non-empty. */
const TOKEN_STYLESHEETS: readonly string[] = [
  path.join(DASHBOARD_DIR, "app", "globals.css"),
  path.join(DASHBOARD_DIR, "app", "themes.css")
];

/** Directories whose sources may consume tokens. */
const TOKEN_CONSUMER_DIRS: readonly string[] = [
  path.join(DASHBOARD_DIR, "components"),
  path.join(DASHBOARD_DIR, "app")
];

/** MD3 custom properties live in the `--md-sys-*` namespace. */
const MD3_REFERENCE_RE = /var\(\s*(--md-sys-[a-z0-9-]+)\s*[,)]/g;

/** Primitive tokens are private to the token layer. */
const PRIMITIVE_REFERENCE_RE = /var\(\s*(--tok-[a-z0-9-]+)\s*[,)]/g;

/** `var(--name)` / `var(--name, fallback)` with the name and fallback captured. */
const VAR_USE_RE = /var\(\s*(--[A-Za-z0-9-]+)\s*(?:,\s*([^()]*))?\)/g;

interface Declaration {
  readonly property: string;
  readonly value: string;
}

interface Rule {
  readonly selectors: readonly string[];
  readonly declarations: readonly Declaration[];
  readonly stylesheet: string;
  /** Enclosing `@media` / `@supports` selectors; empty for unconditional rules. */
  readonly conditions: readonly string[];
}

interface ContrastPair {
  readonly label: string;
  readonly foreground: string;
  readonly background: string;
  readonly minimum: number;
}

/** Body-text and label pairs: WCAG 1.4.3 asks for 4.5:1 at normal sizes. */
const TEXT_PAIRS: readonly ContrastPair[] = [
  {
    label: "page text",
    foreground: "--md-sys-color-on-background",
    background: "--md-sys-color-background",
    minimum: 4.5
  },
  { label: "page text (shadcn twin)", foreground: "--foreground", background: "--background", minimum: 4.5 },
  { label: "card text", foreground: "--md-sys-color-on-surface", background: "--md-sys-color-surface", minimum: 4.5 },
  { label: "card text (shadcn twin)", foreground: "--card-foreground", background: "--card", minimum: 4.5 },
  { label: "popover text", foreground: "--popover-foreground", background: "--popover", minimum: 4.5 },
  {
    label: "label on card",
    foreground: "--md-sys-color-on-surface-variant",
    background: "--md-sys-color-surface",
    minimum: 4.5
  },
  { label: "muted text on card", foreground: "--muted-foreground", background: "--card", minimum: 4.5 },
  { label: "muted text on muted", foreground: "--muted-foreground", background: "--muted", minimum: 4.5 },
  {
    label: "muted text on surface variant",
    foreground: "--md-sys-color-on-surface-variant",
    background: "--md-sys-color-surface-variant",
    minimum: 4.5
  },
  {
    label: "muted text on container",
    foreground: "--md-sys-color-on-surface-variant",
    background: "--md-sys-color-surface-container-low",
    minimum: 4.5
  },
  { label: "primary button label", foreground: "--primary-foreground", background: "--primary", minimum: 4.5 },
  {
    label: "primary button label (md3 twin)",
    foreground: "--md-sys-color-on-primary",
    background: "--md-sys-color-primary",
    minimum: 4.5
  },
  {
    label: "primary container label",
    foreground: "--md-sys-color-on-primary-container",
    background: "--md-sys-color-primary-container",
    minimum: 4.5
  },
  { label: "secondary button label", foreground: "--secondary-foreground", background: "--secondary", minimum: 4.5 },
  {
    label: "secondary container label",
    foreground: "--md-sys-color-on-secondary-container",
    background: "--md-sys-color-secondary-container",
    minimum: 4.5
  },
  { label: "accent chip label", foreground: "--accent-foreground", background: "--accent", minimum: 4.5 },
  {
    label: "tertiary container label",
    foreground: "--md-sys-color-on-tertiary-container",
    background: "--md-sys-color-tertiary-container",
    minimum: 4.5
  },
  {
    label: "destructive button label",
    foreground: "--destructive-foreground",
    background: "--destructive",
    minimum: 4.5
  },
  { label: "error label", foreground: "--md-sys-color-on-error", background: "--md-sys-color-error", minimum: 4.5 },
  {
    label: "error container label",
    foreground: "--md-sys-color-on-error-container",
    background: "--md-sys-color-error-container",
    minimum: 4.5
  },
  {
    label: "secondary label",
    foreground: "--md-sys-color-on-secondary",
    background: "--md-sys-color-secondary",
    minimum: 4.5
  },
  {
    label: "tertiary label",
    foreground: "--md-sys-color-on-tertiary",
    background: "--md-sys-color-tertiary",
    minimum: 4.5
  },
  {
    label: "primary used as link text",
    foreground: "--md-sys-color-primary",
    background: "--md-sys-color-surface",
    minimum: 4.5
  },
  {
    label: "inverted surface text",
    foreground: "--md-sys-color-on-inverse-surface",
    background: "--md-sys-color-inverse-surface",
    minimum: 4.5
  },
  {
    label: "inverse primary on inverted surface",
    foreground: "--md-sys-color-inverse-primary",
    background: "--md-sys-color-inverse-surface",
    minimum: 4.5
  }
];

/** Boundaries and focus indicators: WCAG 1.4.11 asks for 3:1 for non-text UI. */
const UI_PAIRS: readonly ContrastPair[] = [
  { label: "card border", foreground: "--border", background: "--card", minimum: 3 },
  { label: "page border", foreground: "--border", background: "--background", minimum: 3 },
  { label: "field outline", foreground: "--input", background: "--card", minimum: 3 },
  { label: "switch thumb on track", foreground: "--background", background: "--input", minimum: 3 },
  { label: "focus ring", foreground: "--ring", background: "--card", minimum: 3 },
  {
    label: "hairline on surface",
    foreground: "--md-sys-color-outline-variant",
    background: "--md-sys-color-surface",
    minimum: 3
  },
  {
    label: "outline on surface",
    foreground: "--md-sys-color-outline",
    background: "--md-sys-color-surface",
    minimum: 3
  }
];

/** Roles the two naming systems must render identically, or they drift again. */
const TWIN_ROLES: readonly { readonly shadcn: string; readonly md3: string }[] = [
  { shadcn: "--background", md3: "--md-sys-color-background" },
  { shadcn: "--foreground", md3: "--md-sys-color-on-background" },
  { shadcn: "--card", md3: "--md-sys-color-surface" },
  { shadcn: "--popover", md3: "--md-sys-color-surface" },
  { shadcn: "--card-foreground", md3: "--md-sys-color-on-surface" },
  { shadcn: "--muted", md3: "--md-sys-color-surface-variant" },
  { shadcn: "--muted-foreground", md3: "--md-sys-color-on-surface-variant" },
  { shadcn: "--primary", md3: "--md-sys-color-primary" },
  { shadcn: "--primary-foreground", md3: "--md-sys-color-on-primary" },
  { shadcn: "--secondary", md3: "--md-sys-color-secondary-container" },
  { shadcn: "--secondary-foreground", md3: "--md-sys-color-on-secondary-container" },
  { shadcn: "--border", md3: "--md-sys-color-outline-variant" },
  { shadcn: "--input", md3: "--md-sys-color-outline" }
];

/** Replace `/* … *\/` comments with spaces so character offsets keep meaning. */
function stripComments(css: string): string {
  let out = "";
  let index = 0;
  while (index < css.length) {
    const open = css.indexOf("/*", index);
    if (open < 0) {
      out += css.slice(index);
      break;
    }
    const close = css.indexOf("*/", open + 2);
    const end = close < 0 ? css.length : close + 2;
    out += css.slice(index, open) + " ".repeat(end - open);
    index = end;
  }
  return out;
}

/**
 * Scan a stylesheet into rules, flattening nested `@layer` / `@media` wrappers.
 * At-rule blocks contribute no declarations of their own, only their children.
 */
function parseRules(css: string, stylesheet: string): Rule[] {
  const source = stripComments(css);
  const rules: Rule[] = [];
  const stack: { selectors: readonly string[]; declarations: Declaration[] }[] = [];
  let buffer = "";

  const openBlock = (): void => {
    const selectors = buffer
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length > 0);
    stack.push({ selectors, declarations: [] });
    buffer = "";
  };

  const closeBlock = (): void => {
    const closed = stack.pop();
    buffer = "";
    if (closed === undefined) return;
    const isAtRule = closed.selectors.some((selector) => selector.startsWith("@"));
    if (closed.declarations.length === 0 || isAtRule) return;
    const conditions = stack.flatMap((frame) => frame.selectors.filter((selector) => selector.startsWith("@")));
    rules.push({ selectors: closed.selectors, declarations: closed.declarations, stylesheet, conditions });
  };

  const takeDeclaration = (): void => {
    const text = buffer.trim();
    buffer = "";
    const owner = stack.at(-1);
    if (owner === undefined || text.length === 0) return;
    const separator = text.indexOf(":");
    if (separator < 0) return;
    owner.declarations.push({
      property: text.slice(0, separator).trim().toLowerCase(),
      value: text.slice(separator + 1).trim()
    });
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? "";
    if (char === "{") openBlock();
    else if (char === "}") closeBlock();
    else if (char === ";") takeDeclaration();
    else buffer += char;
  }
  return rules;
}

function loadRules(): Rule[] {
  return TOKEN_STYLESHEETS.flatMap((stylesheet) =>
    parseRules(fs.readFileSync(stylesheet, "utf8"), path.basename(stylesheet))
  );
}

let cachedRules: readonly Rule[] | undefined;

/** Parse once, on first use, so the "no files / no rules" guard reports the cause. */
function allRules(): readonly Rule[] {
  if (cachedRules === undefined) cachedRules = loadRules();
  return cachedRules;
}

function matchesSelector(rule: Rule, selector: string): boolean {
  return rule.selectors.includes(selector);
}

/** Merge `:root` defaults with a theme's `[data-theme="id"]` overrides. */
function tokensForTheme(themeId: string): Map<string, string> {
  const merged = new Map<string, string>();
  for (const rule of allRules()) {
    // Conditional rules (the print palette lives in one) are a different
    // rendering context and must not feed the screen tokens.
    if (rule.conditions.length > 0) continue;
    if (!matchesSelector(rule, ":root") && !matchesSelector(rule, `[data-theme="${themeId}"]`)) continue;
    for (const declaration of rule.declarations) merged.set(declaration.property, declaration.value);
  }
  return merged;
}

/** Substitute nested `var()` uses; undefined or cyclic references yield undefined. */
function substitute(tokens: ReadonlyMap<string, string>, value: string, seen: readonly string[]): string | undefined {
  let broken = false;
  const expanded = value.replace(VAR_USE_RE, (full, name: string, fallback: string | undefined) => {
    if (seen.includes(name)) {
      broken = true;
      return full;
    }
    const declared = tokens.get(name);
    if (declared === undefined) {
      if (fallback === undefined) {
        broken = true;
        return full;
      }
      return substitute(tokens, fallback, [...seen, name]) ?? full;
    }
    const resolved = substitute(tokens, declared, [...seen, name]);
    if (resolved === undefined) {
      if (fallback === undefined) {
        broken = true;
        return full;
      }
      return substitute(tokens, fallback, [...seen, name]) ?? full;
    }
    return resolved;
  });
  return broken ? undefined : expanded;
}

function resolveToken(tokens: ReadonlyMap<string, string>, property: string): string | undefined {
  const declared = tokens.get(property);
  if (declared === undefined || declared.length === 0) return undefined;
  return substitute(tokens, declared, [property]);
}

function toChannel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: readonly [number, number, number]): number {
  const [red, green, blue] = rgb;
  return 0.2126 * toChannel(red) + 0.7152 * toChannel(green) + 0.0722 * toChannel(blue);
}

function contrastRatio(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** sRGB HSL -> 8-bit RGB, the same formula WCAG's relative luminance assumes. */
function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const s = saturation / 100;
  const l = lightness / 100;
  const amplitude = s * Math.min(l, 1 - l);
  const channel = (offset: number): number => {
    const quadrant = (offset + hue / 30) % 12;
    return l - amplitude * Math.max(-1, Math.min(quadrant - 3, Math.min(9 - quadrant, 1)));
  };
  return [channel(0) * 255, channel(8) * 255, channel(4) * 255];
}

/** Parse the color spellings the token layer is allowed to use. */
function parseColor(value: string): [number, number, number] | undefined {
  const text = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text);
  if (hex?.[1] !== undefined) {
    const digits = hex[1];
    if (digits.length === 3) {
      return [
        parseInt(digits[0] ?? "0", 16) * 17,
        parseInt(digits[1] ?? "0", 16) * 17,
        parseInt(digits[2] ?? "0", 16) * 17
      ];
    }
    return [parseInt(digits.slice(0, 2), 16), parseInt(digits.slice(2, 4), 16), parseInt(digits.slice(4, 6), 16)];
  }
  const numbers = /(-?[\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%/.exec(text);
  if (numbers?.[1] !== undefined && numbers[2] !== undefined && numbers[3] !== undefined) {
    const hue = Number.parseFloat(numbers[1]);
    const saturation = Number.parseFloat(numbers[2]);
    const lightness = Number.parseFloat(numbers[3]);
    if (text.startsWith("rgb")) {
      return [hue, saturation, lightness];
    }
    return hslToRgb(((hue % 360) + 360) % 360, saturation, lightness);
  }
  const rgb = /^rgba?\(([\d.\s,/]+)\)$/.exec(text);
  if (rgb?.[1] !== undefined) {
    const [red, green, blue] = rgb[1].split(/[\s,/]+/).map((part) => Number.parseFloat(part));
    if (Number.isFinite(red) && Number.isFinite(green) && Number.isFinite(blue)) {
      return [red ?? 0, green ?? 0, blue ?? 0];
    }
  }
  return undefined;
}

function sourceFiles(extensions: readonly string[]): string[] {
  const pattern = new RegExp(`\\.(${extensions.join("|")})$`);
  return TOKEN_CONSUMER_DIRS.flatMap((dir) =>
    fs
      .readdirSync(dir, { recursive: true })
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => path.join(dir, entry))
      .filter((entry) => pattern.test(entry) && fs.statSync(entry).isFile())
  );
}

function referencesFrom(pattern: RegExp, extensions: readonly string[]): string[] {
  const found = new Set<string>();
  for (const file of sourceFiles(extensions)) {
    const text = stripComments(fs.readFileSync(file, "utf8"));
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match !== null) {
      const name = match[1];
      if (name !== undefined) found.add(name);
      match = pattern.exec(text);
    }
  }
  return [...found].sort();
}

function themeBlockRules(themeId: string): Rule[] {
  return allRules().filter(
    (rule) => rule.conditions.length === 0 && matchesSelector(rule, `[data-theme="${themeId}"]`)
  );
}

function declaredProperties(themeId: string): string[] {
  return themeBlockRules(themeId)
    .flatMap((rule) => rule.declarations.map((declaration) => declaration.property))
    .sort();
}

describe("theme token gate", () => {
  it("refuses to run on an empty file list or an empty catalog", () => {
    expect(TOKEN_STYLESHEETS.length, "no stylesheets configured").toBeGreaterThan(0);
    for (const stylesheet of TOKEN_STYLESHEETS) {
      expect(fs.existsSync(stylesheet), `missing stylesheet ${stylesheet}`).toBe(true);
      expect(fs.statSync(stylesheet).size, `empty stylesheet ${stylesheet}`).toBeGreaterThan(200);
    }
    expect(allRules().length, "no CSS rules parsed").toBeGreaterThan(20);
    expect(DASHBOARD_THEMES.length, "empty theme catalog").toBeGreaterThan(1);
    expect(TEXT_PAIRS.length, "no contrast pairs configured").toBeGreaterThan(10);
    expect(UI_PAIRS.length, "no UI contrast pairs configured").toBeGreaterThan(3);
    expect(
      referencesFrom(MD3_REFERENCE_RE, ["ts", "tsx", "css"]).length,
      "no --md-sys-* references found"
    ).toBeGreaterThan(10);
  });

  it("keeps the CSS theme blocks and the TS catalog naming the same themes", () => {
    const catalogIds = DASHBOARD_THEMES.map((theme) => theme.id).sort();
    const cssIds = allRules()
      .filter((rule) => rule.conditions.length === 0)
      .flatMap((rule) => rule.selectors)
      .map((selector) => /^\[data-theme="([^"]+)"\]$/.exec(selector)?.[1])
      .filter((id): id is string => id !== undefined)
      .filter((id, index, all) => all.indexOf(id) === index)
      .sort();
    expect(cssIds, "app/themes.css and lib/themes.ts disagree about the theme list").toEqual(catalogIds);
  });

  it("paints the default theme without the bootstrap script", () => {
    const defaultBlocks = themeBlockRules(DEFAULT_THEME_ID);
    expect(defaultBlocks.length, `no [data-theme="${DEFAULT_THEME_ID}"] block`).toBeGreaterThan(0);
    expect(
      defaultBlocks.some((rule) => rule.selectors.includes(":root")),
      `the default theme ${DEFAULT_THEME_ID} must also be declared on :root so the first paint matches`
    ).toBe(true);
  });

  it("keeps primitives private and defines every md3 token a source asks for", () => {
    const primitives = referencesFrom(PRIMITIVE_REFERENCE_RE, ["ts", "tsx"]);
    expect(
      primitives,
      `components must use --md-sys-* or Tailwind utilities, not primitives: ${primitives.join(", ")}`
    ).toEqual([]);

    const referenced = referencesFrom(MD3_REFERENCE_RE, ["ts", "tsx", "css"]);
    const undefinedPerTheme: string[] = [];
    for (const theme of DASHBOARD_THEMES) {
      const tokens = tokensForTheme(theme.id);
      for (const property of referenced) {
        const value = resolveToken(tokens, property);
        if (value === undefined || value.trim().length === 0) {
          undefinedPerTheme.push(`${theme.id}: ${property}`);
        }
      }
    }
    expect(undefinedPerTheme, `referenced tokens undefined in some theme (${referenced.length} checked)`).toEqual([]);
  });

  it("declares the identical token set in every theme block", () => {
    const baseline = declaredProperties(DEFAULT_THEME_ID);
    expect(baseline.length, "the default theme declares no tokens").toBeGreaterThan(20);
    const drift: string[] = [];
    for (const theme of DASHBOARD_THEMES) {
      if (theme.id === DEFAULT_THEME_ID) continue;
      const declared = declaredProperties(theme.id);
      const missing = baseline.filter((property) => !declared.includes(property));
      const extra = declared.filter((property) => !baseline.includes(property));
      if (missing.length > 0 || extra.length > 0) {
        drift.push(`${theme.id} missing [${missing.join(", ")}] unexpected [${extra.join(", ")}]`);
      }
    }
    expect(drift).toEqual([]);
  });

  it("ships the accessibility layers and keeps component classes layered", () => {
    const css = stripComments(fs.readFileSync(path.join(DASHBOARD_DIR, "app", "globals.css"), "utf8"));
    for (const feature of [
      '@plugin "tailwindcss-animate"',
      "@layer base",
      "@layer components",
      ":focus-visible",
      "@media (prefers-reduced-motion: reduce)",
      "@media (forced-colors: active)",
      "@media print",
      "font-variant-numeric: var(--font-variant-tabular)",
      ".tnum",
      ".treemap-chart"
    ]) {
      expect(css, `app/globals.css no longer contains ${feature}`).toContain(feature);
    }

    // Unlayered component rules beat Tailwind utilities at the call site, so the
    // type classes must sit inside @layer components.
    const componentsLayer = css.indexOf("@layer components");
    expect(componentsLayer, "no @layer components block").toBeGreaterThan(-1);
    for (const className of [".md3-title-large", ".md3-body-medium", ".kpi-value"]) {
      expect(css.indexOf(className), `${className} is outside @layer components`).toBeGreaterThan(componentsLayer);
    }

    // Dead rules the Card component never matched (it sets no data-slot).
    expect(css).not.toContain('[data-slot="card"]');
    expect(css).not.toMatch(/^\.card[,{ ]/m);
  });
});

describe("theme contrast", () => {
  for (const theme of DASHBOARD_THEMES) {
    describe(`${theme.id} (${theme.mode})`, () => {
      const tokens = (): Map<string, string> => tokensForTheme(theme.id);

      it("declares color-scheme for its mode", () => {
        const scheme = resolveToken(tokens(), "color-scheme");
        expect(scheme, "color-scheme is unset, so native controls keep the wrong scheme").toBe(theme.mode);
      });

      it("resolves every token used in the contrast pairs", () => {
        const properties = new Set<string>([
          ...TEXT_PAIRS.flatMap((pair) => [pair.foreground, pair.background]),
          ...UI_PAIRS.flatMap((pair) => [pair.foreground, pair.background])
        ]);
        const broken = [...properties].filter((property) => resolveToken(tokens(), property) === undefined);
        expect(broken, `unresolvable tokens in ${theme.id}`).toEqual([]);
      });

      for (const pair of [...TEXT_PAIRS, ...UI_PAIRS]) {
        it(`${pair.label} meets ${pair.minimum}:1`, () => {
          const themeTokens = tokens();
          const foregroundValue = resolveToken(themeTokens, pair.foreground);
          const backgroundValue = resolveToken(themeTokens, pair.background);
          expect(foregroundValue, `${pair.foreground} is not defined for ${theme.id}`).toBeDefined();
          expect(backgroundValue, `${pair.background} is not defined for ${theme.id}`).toBeDefined();
          const foreground = parseColor(foregroundValue ?? "");
          const background = parseColor(backgroundValue ?? "");
          expect(foreground, `${pair.foreground}="${foregroundValue}" is not a parseable color`).toBeDefined();
          expect(background, `${pair.background}="${backgroundValue}" is not a parseable color`).toBeDefined();
          const ratio = contrastRatio(foreground ?? [0, 0, 0], background ?? [0, 0, 0]);
          expect(
            Number(ratio.toFixed(2)),
            `${theme.id} ${pair.label}: ${pair.foreground}=${foregroundValue} on ${pair.background}=${backgroundValue}`
          ).toBeGreaterThanOrEqual(pair.minimum);
        });
      }

      it("renders the shadcn and md3 names for one role identically", () => {
        const drift: string[] = [];
        const themeTokens = tokens();
        for (const twin of TWIN_ROLES) {
          const shadcnValue = resolveToken(themeTokens, twin.shadcn);
          const md3Value = resolveToken(themeTokens, twin.md3);
          const shadcnColor = parseColor(shadcnValue ?? "");
          const md3Color = parseColor(md3Value ?? "");
          if (shadcnColor === undefined || md3Color === undefined) {
            drift.push(`${theme.id}: ${twin.shadcn}="${shadcnValue}" / ${twin.md3}="${md3Value}" unparseable`);
            continue;
          }
          const ratio = contrastRatio(shadcnColor, md3Color);
          if (ratio > 1.01) {
            drift.push(
              `${theme.id}: ${twin.shadcn}="${shadcnValue}" != ${twin.md3}="${md3Value}" (${ratio.toFixed(2)}:1 apart)`
            );
          }
        }
        expect(drift, "the two token systems disagree about a shared role").toEqual([]);
      });
    });
  }
});
