import { test, expect } from "@playwright/test";
import {
  BASE_SECTIONS,
  MAIN_PAGE_ELEMENTS,
  SCREENSHOT_OPTS,
  VIEWPORTS,
  captureElement,
  hoverTreemapForTooltip,
  stabilizePage,
  viewportSuffix,
  waitForDashboardReady
} from "./visual-helpers";

for (const vp of VIEWPORTS) {
  test(`dashboard main page goldens (${vp.name})`, async ({ page }) => {
    test.setTimeout(120000);
    const suffix = viewportSuffix(vp.name);

    await stabilizePage(page);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/");
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await waitForDashboardReady(page);

    await expect(page).toHaveScreenshot(`dashboard-main${suffix}.png`, {
      ...SCREENSHOT_OPTS,
      fullPage: true
    });

    if (vp.name === "desktop") {
      const sidebar = page.locator('[data-testid="sidebar"]');
      await sidebar.waitFor({ state: "visible", timeout: 10000 });
      await captureElement(page, sidebar, `dashboard-sidebar${suffix}.png`);
    } else {
      const menuBtn = page
        .getByRole("button")
        .filter({ has: page.locator("svg") })
        .first();
      if ((await menuBtn.count()) > 0) {
        await menuBtn.click().catch(() => {});
        await page.waitForTimeout(250);
        const sheet = page.locator('[data-testid="ui-sheet"]').first();
        if ((await sheet.count()) > 0 && (await sheet.isVisible().catch(() => false))) {
          await expect(sheet).toHaveScreenshot(`dashboard-sidebar${suffix}.png`, SCREENSHOT_OPTS);
          await page.keyboard.press("Escape").catch(() => {});
        }
      }
    }

    for (const { id, baseSlug } of BASE_SECTIONS) {
      const section = page.locator(id);
      await section.waitFor({ timeout: 5000 }).catch(() => {});
      if (id === "#storage") {
        await hoverTreemapForTooltip(page);
      }
      await captureElement(page, section, `${baseSlug}${suffix}.png`, { hideChrome: true });
    }

    for (const { selector, baseSlug, hideChrome, extraWait } of MAIN_PAGE_ELEMENTS) {
      if (baseSlug === "dashboard-sidebar") continue;
      const el = page.locator(selector).first();
      if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) {
        await captureElement(page, el, `${baseSlug}${suffix}.png`, { hideChrome, extraWait });
      }
    }
  });
}
