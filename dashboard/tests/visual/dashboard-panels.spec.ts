import { test, expect } from "@playwright/test";
import {
  PANEL_SELECTORS,
  SCREENSHOT_OPTS,
  UI_FIXTURES,
  VIEWPORTS,
  stabilizePage,
  viewportSuffix,
  waitForPanelsReady
} from "./visual-helpers";

for (const vp of VIEWPORTS) {
  test(`dashboard panel + ui fixture goldens (${vp.name})`, async ({ page }) => {
    test.setTimeout(90000);
    const suffix = viewportSuffix(vp.name);

    await stabilizePage(page);
    await page.setViewportSize({ width: vp.width, height: vp.height });

    await page.goto("/dev/panels");
    await waitForPanelsReady(page);
    for (const { selector, baseSlug } of PANEL_SELECTORS) {
      const el = page.locator(selector).first();
      if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) {
        await expect(el).toHaveScreenshot(`${baseSlug}${suffix}.png`, SCREENSHOT_OPTS);
      }
    }

    await page.goto("/dev/panels/empty-dupes");
    await waitForPanelsReady(page);
    const emptyDupesSheet = page.locator('[data-testid="ui-sheet"]').filter({ hasText: "No duplicates found" }).first();
    if ((await emptyDupesSheet.count()) > 0 && (await emptyDupesSheet.isVisible().catch(() => false))) {
      await expect(emptyDupesSheet).toHaveScreenshot(`dashboard-ui-sheet-dupes-empty${suffix}.png`, SCREENSHOT_OPTS);
    }

    await page.goto("/dev/ui");
    await waitForPanelsReady(page).catch(() => page.waitForTimeout(500));
    for (const { selector, baseSlug } of UI_FIXTURES) {
      const el = page.locator(selector).first();
      if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) {
        await expect(el).toHaveScreenshot(`${baseSlug}${suffix}.png`, SCREENSHOT_OPTS);
      }
    }
  });
}
