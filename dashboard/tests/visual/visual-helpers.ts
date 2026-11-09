/** Shared Playwright helpers for dashboard visual regression captures. */

import { Page, Locator } from "@playwright/test";

export const SCREENSHOT_OPTS = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.01
};

/**
 * Themes the visual suite pins.
 *
 * The console ships ten themes, but a golden matrix has to stay reviewable, so the suite
 * locks one dark and one light theme by id rather than trusting the ambient default. Light
 * mode gets first-class coverage because its contrast was the worst finding in the audit;
 * a golden set that only ever looked at dark would let it regress silently.
 */
export const THEMES = [
  { name: "dark", themeId: "spark-lime", colorScheme: "dark" } as const,
  { name: "light", themeId: "daylight", colorScheme: "light" } as const
];

/** localStorage key `components/ThemeProvider.tsx` reads on boot. */
export const THEME_STORAGE_KEY = "dgx-dashboard-theme";

/**
 * One row per routed console section.
 *
 * These used to be `#anchor` fragments on a single page. Sections are real routes now, so
 * the suite navigates to `/{slug}`; `requiredSelector` is the assertion floor that makes a
 * missing section fail the run instead of quietly producing no screenshot.
 */
export const SECTION_ROUTES = [
  { slug: "resources", baseSlug: "dashboard-resources", requiredSelector: '[data-testid="resources-panel"]' },
  {
    slug: "observability",
    baseSlug: "dashboard-observability",
    requiredSelector: '[data-testid="observability-panel"]'
  },
  { slug: "inference", baseSlug: "dashboard-inference", requiredSelector: '[data-testid="inference-panel"]' },
  { slug: "agent-chat", baseSlug: "dashboard-agent-chat", requiredSelector: '[data-testid="open-webui-panel"]' },
  { slug: "storage", baseSlug: "dashboard-storage", requiredSelector: '[data-testid="storage-panel"]' },
  { slug: "tasks", baseSlug: "dashboard-tasks", requiredSelector: '[data-testid="tasks-panel"]' },
  { slug: "workspaces", baseSlug: "dashboard-workspaces", requiredSelector: '[data-testid="workspaces-panel"]' },
  { slug: "system", baseSlug: "dashboard-machine", requiredSelector: '[data-testid="machine-state-panel"]' },
  { slug: "utilities", baseSlug: "dashboard-utilities", requiredSelector: '[data-testid="utilities-panel"]' },
  { slug: "secrets", baseSlug: "dashboard-secrets", requiredSelector: '[data-testid="secrets-panel"]' }
] as const;

export const PANEL_SELECTORS = [
  { selector: '[data-testid="resources-panel"]', baseSlug: "dashboard-resources-panel" },
  { selector: '[data-testid="observability-panel"]', baseSlug: "dashboard-observability-panel" },
  { selector: '[data-testid="inference-panel"]', baseSlug: "dashboard-inference-panel" },
  { selector: '[data-testid="nemotron-stack-panel"]', baseSlug: "dashboard-nemotron-stack-panel" },
  { selector: '[data-testid="open-webui-panel"]', baseSlug: "dashboard-open-webui-panel" },
  { selector: '[data-testid="tasks-panel"]', baseSlug: "dashboard-tasks-panel" },
  { selector: '[data-testid="storage-panel"]', baseSlug: "dashboard-storage-panel" },
  { selector: '[data-testid="workspaces-panel"]', baseSlug: "dashboard-workspaces-panel" },
  { selector: '[data-testid="machine-state-panel"]', baseSlug: "dashboard-machine-state-panel" },
  { selector: '[data-testid="utilities-panel"]', baseSlug: "dashboard-utilities-panel" },
  { selector: '[data-testid="secrets-panel"]', baseSlug: "dashboard-secrets-panel" }
];

/** Rail landmark: the one chrome element captured on the overview at every viewport and theme. */
export const SIDEBAR_SELECTOR = '[data-testid="sidebar"]';
export const SIDEBAR_BASE = "dashboard-sidebar";

/**
 * Elements the overview route (`/`) renders and captures per viewport and theme.
 *
 * The treemap used to be listed here. It is rendered by `StoragePanel`, which mounts on
 * `/storage`, so it never appeared on the overview: `dashboard-main.spec.ts` had to skip
 * those names, and the base treemap goldens quietly stopped being produced while their
 * stale PNGs stayed committed. They now live in `STORAGE_EXTRA_CAPTURES`.
 */
export const MAIN_PAGE_ELEMENTS = [{ selector: SIDEBAR_SELECTOR, baseSlug: SIDEBAR_BASE, hideChrome: false }];

/**
 * Extra surfaces the storage route captures beyond its own panel frame.
 *
 * `sections.spec.ts` owns these because it already navigates to `/storage` once per
 * viewport and theme; the treemap has to hold in light mode too, and a dark-only golden set
 * is what let the rail and the charts regress there.
 */
export const STORAGE_EXTRA_CAPTURES = [
  { selector: '[data-testid="treemap"]', baseSlug: "dashboard-treemap", hideChrome: true },
  { selector: '[data-testid="treemap-viz"]', baseSlug: "dashboard-treemap-viz", hideChrome: true },
  {
    selector: '[data-testid="treemap-controls"]',
    baseSlug: "dashboard-treemap-controls",
    hideChrome: true,
    extraWait: 200
  },
  { selector: '[data-testid="treemap-side-list"]', baseSlug: "dashboard-treemap-side-list", hideChrome: true }
];

export const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 375, height: 667 }
] as const;

export const UI_FIXTURES = [
  {
    selector: '[data-testid="visual-test-fixtures"] [data-testid="ui-button-hero"]',
    baseSlug: "dashboard-ui-button"
  },
  { selector: '[data-testid="visual-test-fixtures"] [data-testid="ui-card-demo"]', baseSlug: "dashboard-ui-card" },
  { selector: '[data-testid="visual-test-fixtures"] [data-testid="ui-badge"]', baseSlug: "dashboard-ui-badge" },
  { selector: '[data-testid="visual-test-fixtures"] [data-testid="ui-input"]', baseSlug: "dashboard-ui-input" },
  { selector: '[data-testid="visual-test-fixtures"] [data-testid="ui-skeleton"]', baseSlug: "dashboard-ui-skeleton" },
  { selector: '[data-testid="visual-test-fixtures"] [data-testid="ui-table"]', baseSlug: "dashboard-ui-table" }
];

/**
 * Wait for fonts, charts, and key panels before screenshots.
 *
 * The treemap and the task / machine panels are home-page only. On a single-section route
 * they never appear, so each waiter would burn its whole timeout and then swallow the miss
 * behind `.catch(() => {})`; across ten routes that is ~18s of dead wait each and it pushed
 * the sections capture past its test timeout. `sections.spec.ts` opts out and asserts its own
 * target with `requireVisible`, so nothing is waited on that the route cannot satisfy.
 */
export async function waitForDashboardReady(
  page: Page,
  options?: { treemap?: boolean | undefined; homePanels?: boolean | undefined }
) {
  const { treemap = true, homePanels = true } = options ?? {};

  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle");
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);

  if (treemap) {
    await page
      .waitForFunction(
        () => {
          const viz = document.querySelector('[data-testid="treemap-viz"]');
          if (!viz) return false;
          const svg = viz.querySelector("svg");
          if (!svg) return false;
          const children = svg.querySelectorAll("rect, path, g");
          return children.length > 0;
        },
        { timeout: 10000 }
      )
      .catch(() => {});
  }

  if (homePanels) {
    await page
      .waitForFunction(
        () => {
          const tasks = document.querySelector('[data-testid="tasks-panel"]');
          const machine = document.querySelector('[data-testid="machine-state-panel"]');
          return (tasks && tasks.children.length > 0) || (machine && machine.children.length > 0);
        },
        { timeout: 8000 }
      )
      .catch(() => {});
  }

  await page.waitForTimeout(300).catch(() => {});
}

/** Wait until the nested treemap SVG rects are rendered. */
export async function waitForTreemapChart(page: Page) {
  const viz = page.locator('[data-testid="treemap-viz"]');
  await viz.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(250).catch(() => {});
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="treemap-viz"]');
      if (!el || el.getAttribute("data-chart-view") !== "nested-treemap") return false;
      const rects = el.querySelectorAll("svg rect");
      return rects.length > 0;
    },
    { timeout: 20000 }
  );
  await page.waitForTimeout(200).catch(() => {});
}

/** Wait until the sunburst chart paths and legend are rendered. */
export async function waitForSunburstChart(page: Page) {
  const viz = page.locator('[data-testid="treemap-viz"]');
  await viz.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300).catch(() => {});
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="treemap-viz"][data-chart-view="sunburst"]');
      if (!el) return false;
      const paths = el.querySelectorAll("svg path");
      const legend = el.querySelector('[data-testid="sunburst-legend"]');
      const center = el.querySelector('[data-testid="sunburst-center"]');
      // Legend/center may lag on narrow viewports; paths alone are enough to screenshot.
      return paths.length > 0 && (legend !== null || center !== null || paths.length >= 3);
    },
    { timeout: 25000 }
  );
  await page.waitForTimeout(300).catch(() => {});
}

/** Hover the first treemap cell to stabilize tooltip screenshots. */
export async function hoverTreemapForTooltip(page: Page) {
  const chartCell = page.locator('[data-testid="treemap-viz"] rect, [data-testid="treemap-viz"] path').first();
  if ((await chartCell.count()) > 0) {
    await chartCell.hover({ force: true }).catch(() => {});
    await page.waitForTimeout(150);
  }
}

/** Wait for panel fixture routes before panel-level screenshots. */
export async function waitForPanelsReady(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('[data-testid="visual-panel-fixtures"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="storage-panel"]', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300).catch(() => {});
}

/** Disable animations and transitions for deterministic Playwright captures. */
export async function stabilizePage(page: Page) {
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
        caret-color: transparent !important;
      }
      body, button, input, text { font-synthesis: none !important; -webkit-font-smoothing: antialiased !important; text-rendering: optimizeLegibility !important; }
    `;
    document.head.appendChild(style);
  });
}

/**
 * Block until the self-hosted faces are loaded and actually applied.
 *
 * Playwright waits for pending font loads before it captures, but content mounted late (a
 * portal opening, a toast firing) can request a face after that check has passed, and the
 * capture then lands on the fallback. The metrics differ, so a run can bless a baseline in the
 * wrong typeface and the next run reports it a few percent off. This gates on the real
 * condition and fails loudly instead of writing a golden nobody asked for.
 *
 * @param page - The page about to be captured.
 * @throws When a declared family never becomes available.
 */
export async function requireBundledFonts(page: Page) {
  await page.evaluate(
    async (vars: string[]) => {
      await document.fonts.ready;
      const pending = Array.from(document.fonts).filter((face) => face.status !== "loaded");
      if (pending.length > 0) {
        await Promise.all(pending.map((face) => face.load()));
      }
      // `next/font` writes the token as a whole stack (`"notoSans", system-ui, Arial, ...`),
      // so only the leading family names the self-hosted face; the rest is the fallback it added.
      const families = vars.map((v) => {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
        const first = raw.split(",")[0]?.trim() ?? "";
        return first.replace(/^['"]|['"]$/g, "");
      });
      if (families.some((f) => f.length === 0)) {
        throw new Error(`visual: font token empty on :root, got ${JSON.stringify(families)}`);
      }
      const missing = families.filter((f) => !document.fonts.check(`16px "${f}"`));
      if (missing.length > 0) {
        throw new Error(`visual: bundled font(s) not applied: ${missing.join(", ")}`);
      }
    },
    ["--font-noto-sans", "--font-noto-sans-mono"]
  );
}

/** Hide sidebar and sticky header during element-focused screenshots. */
export async function hideDashboardChrome(page: Page) {
  await page.addStyleTag({
    content: `
      [data-testid="sidebar"],
      header.sticky {
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `
  });
}

/** Remove Sonner toasts that would otherwise appear in screenshots. */
export async function dismissToasts(page: Page) {
  await page
    .evaluate(() => {
      document.querySelectorAll("[data-sonner-toast]").forEach((t) => t.remove());
    })
    .catch(() => {});
  await page.waitForFunction(() => !document.querySelector("[data-sonner-toast]"), { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(200);
}

/** Scroll an element into view and assert a Playwright screenshot golden. */
export async function captureElement(
  page: Page,
  el: Locator,
  filename: string,
  // Callers forward fields destructured from MAIN_PAGE_ELEMENTS, where absent keys read as undefined.
  options?: { hideChrome?: boolean | undefined; extraWait?: number | undefined }
) {
  const { expect } = await import("@playwright/test");
  if (options?.hideChrome) {
    await hideDashboardChrome(page);
  }
  await el.scrollIntoViewIfNeeded().catch(() => {});
  if (options?.extraWait) {
    await page.waitForTimeout(options.extraWait);
  }
  await requireBundledFonts(page);
  await expect(el).toHaveScreenshot(filename, SCREENSHOT_OPTS);
}

/** Map a viewport label to the golden filename suffix. */
export function viewportSuffix(name: string) {
  return name === "mobile" ? "-mobile" : "";
}

/** Map a theme label to the golden filename suffix. Dark keeps the legacy bare name. */
export function themeSuffix(name: string) {
  return name === "dark" ? "" : `-${name}`;
}

/**
 * Pin the theme before the app boots.
 *
 * The pre-paint script in `app/layout.tsx` reads this key, so setting it in an init script
 * lands before first paint and avoids the flash a post-load click on the theme picker
 * would cause. `colorScheme` is emulated too, because some tokens key off the media query.
 */
export async function applyTheme(page: Page, theme: { themeId: string; colorScheme: string }) {
  await page.addInitScript(
    ([key, id]: [string, string]) => {
      localStorage.setItem(key, id);
    },
    [THEME_STORAGE_KEY, theme.themeId] as [string, string]
  );
  await page.emulateMedia({ colorScheme: theme.colorScheme as "dark" | "light", reducedMotion: "reduce" });
}

/**
 * Fail loudly when a capture target is absent.
 *
 * The previous suite wrapped every lookup in `.catch(() => {})` and skipped the screenshot
 * when an element was missing, so a whole route could disappear from the console and the
 * visual job still went green. A golden that was never produced is a failure, not a skip.
 */
export async function requireVisible(page: Page, selector: string, what: string) {
  const { expect } = await import("@playwright/test");
  const target = page.locator(selector).first();
  const found = await target.waitFor({ state: "visible", timeout: 15000 }).then(
    () => true,
    () => false
  );
  expect(found, `${what} missing: ${selector} never became visible on ${page.url()}`).toBe(true);
  await expect(target).toBeVisible();
}

/** Assert the page-level heading exists and carries the text the route registry promised. */
export async function requirePageTitle(page: Page, expected: RegExp) {
  const { expect } = await import("@playwright/test");
  const heading = page.getByRole("heading", { level: 1 }).first();
  await expect(heading, `no h1 on ${page.url()}`).toBeVisible();
  await expect(heading, `unexpected page title on ${page.url()}`).toHaveText(expected);
}
