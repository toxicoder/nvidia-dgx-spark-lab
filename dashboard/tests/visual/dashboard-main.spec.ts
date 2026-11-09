import { test, expect } from "@playwright/test";
import {
  requireBundledFonts,
  SCREENSHOT_OPTS,
  SIDEBAR_BASE,
  SIDEBAR_SELECTOR,
  THEMES,
  VIEWPORTS,
  applyTheme,
  captureElement,
  requirePageTitle,
  requireVisible,
  stabilizePage,
  themeSuffix,
  viewportSuffix,
  waitForDashboardReady
} from "./visual-helpers";

/**
 * Overview goldens: the full page, the rail, and the KPI band.
 *
 * The section captures that used to live here walked `#anchor` fragments on a single page.
 * Sections are routes now and are captured per-route in `sections.spec.ts`, so this file
 * covers only what the overview itself renders.
 *
 * The previous version wrapped every lookup in `.catch(() => {})` and skipped the capture
 * when the element was absent, so a missing block produced no golden and no failure. Every
 * capture below asserts its target first.
 */
for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    test(`dashboard main page goldens (${vp.name}, ${theme.name})`, async ({ page }) => {
      test.setTimeout(120000);
      const suffix = `${viewportSuffix(vp.name)}${themeSuffix(theme.name)}`;

      await stabilizePage(page);
      await applyTheme(page, theme);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await waitForDashboardReady(page);

      await requirePageTitle(page, /overview|DGX Spark Lab/i);
      await requireBundledFonts(page);
      await expect(page).toHaveScreenshot(`dashboard-main${suffix}.png`, {
        ...SCREENSHOT_OPTS,
        fullPage: true
      });

      if (vp.name === "desktop") {
        await requireVisible(page, SIDEBAR_SELECTOR, "desktop rail");
        await captureElement(page, page.locator(SIDEBAR_SELECTOR).first(), `${SIDEBAR_BASE}${suffix}.png`);
      } else {
        await requireVisible(page, 'button[aria-label="Open menu"]', "mobile menu button");
        await page.locator('button[aria-label="Open menu"]').first().click();
        await page.waitForTimeout(250);
        const sheet = page.locator('[data-testid="ui-sheet"]').first();
        await expect(sheet, "mobile menu did not open").toBeVisible();
        await requireBundledFonts(page);
        await expect(sheet).toHaveScreenshot(`${SIDEBAR_BASE}${suffix}.png`, SCREENSHOT_OPTS);
        await page.keyboard.press("Escape").catch(() => {});
      }

      // The KPI band is the overview's own content and the thing an operator scans first.
      await requireVisible(page, '[data-testid="metric-tile"]', "overview KPI tile");
    });
  }
}
