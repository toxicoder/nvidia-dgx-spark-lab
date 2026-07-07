/** Shared Playwright helpers for dashboard visual regression captures. */

import { Page, Locator } from "@playwright/test";

export const SCREENSHOT_OPTS = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.01
};

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

export const MAIN_PAGE_ELEMENTS = [
  { selector: '[data-testid="sidebar"]', baseSlug: "dashboard-sidebar", hideChrome: false },
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

export const BASE_SECTIONS = [
  { id: "#resources", baseSlug: "dashboard-resources" },
  { id: "#observability", baseSlug: "dashboard-observability" },
  { id: "#inference", baseSlug: "dashboard-inference" },
  { id: "#agent-chat", baseSlug: "dashboard-agent-chat" },
  { id: "#tasks", baseSlug: "dashboard-tasks" },
  { id: "#storage", baseSlug: "dashboard-storage" },
  { id: "#workspaces", baseSlug: "dashboard-workspaces" },
  { id: "#system", baseSlug: "dashboard-machine" },
  { id: "#utilities", baseSlug: "dashboard-utilities" },
  { id: "#secrets", baseSlug: "dashboard-secrets" }
];

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

/** Wait for fonts, charts, and key panels before main-page screenshots. */
export async function waitForDashboardReady(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle");
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);

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
  await page.waitForFunction(
    () => {
      const viz = document.querySelector('[data-testid="treemap-viz"][data-chart-view="sunburst"]');
      if (!viz) return false;
      const paths = viz.querySelectorAll("svg path");
      const legend = viz.querySelector('[data-testid="sunburst-legend"]');
      const center = viz.querySelector('[data-testid="sunburst-center"]');
      return paths.length > 0 && legend !== null && center !== null;
    },
    { timeout: 10000 }
  );
  await page.waitForTimeout(200).catch(() => {});
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
  options?: { hideChrome?: boolean; extraWait?: number }
) {
  const { expect } = await import("@playwright/test");
  if (options?.hideChrome) {
    await hideDashboardChrome(page);
  }
  await el.scrollIntoViewIfNeeded().catch(() => {});
  if (options?.extraWait) {
    await page.waitForTimeout(options.extraWait);
  }
  await expect(el).toHaveScreenshot(filename, SCREENSHOT_OPTS);
}

/** Map a viewport label to the golden filename suffix. */
export function viewportSuffix(name: string) {
  return name === "mobile" ? "-mobile" : "";
}
