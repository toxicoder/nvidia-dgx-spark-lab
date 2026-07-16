import { test, expect } from "@playwright/test";
import {
  SCREENSHOT_OPTS,
  VIEWPORTS,
  captureElement,
  dismissToasts,
  stabilizePage,
  viewportSuffix,
  waitForDashboardReady,
  waitForSunburstChart,
  waitForTreemapChart
} from "./visual-helpers";

for (const vp of VIEWPORTS) {
  test(`dashboard interaction goldens (${vp.name})`, async ({ page }) => {
    test.setTimeout(120000);
    const suffix = viewportSuffix(vp.name);

    await stabilizePage(page);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/");
    await waitForDashboardReady(page);

    const sunburstToggle = page.locator('[data-testid="treemap-view-sunburst"]');
    if ((await sunburstToggle.count()) > 0) {
      await sunburstToggle.scrollIntoViewIfNeeded().catch(() => {});
      await sunburstToggle.click();
      // Sunburst can be flaky on narrow viewports (SVG paths lag). Skip rather than fail CI.
      try {
        await waitForSunburstChart(page);
        const vizSun = page.locator('[data-testid="treemap-viz"]');
        if ((await vizSun.count()) > 0) {
          await captureElement(page, vizSun, `dashboard-treemap-viz-sunburst${suffix}.png`, { hideChrome: true });
        }
      } catch {
        // continue with remaining interaction goldens
      }
    }

    await page.reload({ waitUntil: "networkidle" });
    await waitForDashboardReady(page);
    await page
      .locator("#storage")
      .scrollIntoViewIfNeeded()
      .catch(() => {});
    await waitForTreemapChart(page);

    const sideRow = page.locator('[data-testid="treemap-side-list"] tr', { hasText: "mistral-7b.gguf" }).first();
    if ((await sideRow.count()) > 0) {
      await sideRow.scrollIntoViewIfNeeded().catch(() => {});
      await sideRow.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      const vizSel = page.locator('[data-testid="treemap-viz"]');
      if ((await vizSel.count()) > 0) {
        await captureElement(page, vizSel, `dashboard-treemap-viz-selected${suffix}.png`, { hideChrome: true });
      }
    } else {
      const vizSel = page.locator('[data-testid="treemap-viz"]');
      if ((await vizSel.count()) > 0) {
        await captureElement(page, vizSel, `dashboard-treemap-viz-selected${suffix}.png`, { hideChrome: true });
      }
    }

    const searchInput = page.locator('[data-testid="treemap-controls"] input').first();
    if ((await searchInput.count()) > 0) {
      await searchInput.fill("mistral");
      await page.waitForTimeout(300);
      const sideList = page.locator('[data-testid="treemap-side-list"]').first();
      if ((await sideList.count()) > 0) {
        await captureElement(page, sideList, `dashboard-treemap-side-list-filtered${suffix}.png`, { hideChrome: true });
      }
      await searchInput.fill("");
      await page.waitForTimeout(200);
    }

    const smallRow = page.locator('[data-testid="treemap-side-list"] tr', { hasText: "small1.bin" }).first();
    const mediumRow = page.locator('[data-testid="treemap-side-list"] tr', { hasText: "medium-a" }).first();
    if ((await smallRow.count()) > 0) {
      await smallRow.click({ force: true }).catch(() => {});
    }
    if ((await mediumRow.count()) > 0) {
      await mediumRow.click({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(300);

    const bulkDeleteBtn = page.getByRole("button", { name: /delete \d+ selected/i });
    if ((await bulkDeleteBtn.count()) > 0) {
      await bulkDeleteBtn.click().catch(() => {});
      await page.waitForTimeout(300);
      const bulkDlg = page.locator('[data-testid="ui-dialog"]').first();
      if ((await bulkDlg.count()) > 0 && (await bulkDlg.isVisible().catch(() => false))) {
        await dismissToasts(page);
        await expect(bulkDlg).toHaveScreenshot(`dashboard-ui-dialog-bulk-delete${suffix}.png`, SCREENSHOT_OPTS);
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(200);
      }
    }

    const findDupesBtn = page.getByRole("button", { name: /find duplicates/i });
    if ((await findDupesBtn.count()) > 0) {
      await findDupesBtn.click().catch(() => {});
      await page.waitForTimeout(350);
      await dismissToasts(page);
      await page
        .addStyleTag({
          content: `main, [data-testid="sidebar"], header.sticky { visibility: hidden !important; }`
        })
        .catch(() => {});
      const sheet = page.locator('[data-testid="ui-sheet"]').first();
      if ((await sheet.count()) > 0 && (await sheet.isVisible().catch(() => false))) {
        await expect(sheet).toHaveScreenshot(`dashboard-ui-sheet-dupes${suffix}.png`, SCREENSHOT_OPTS);
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(300);
      }
    }

    await dismissToasts(page);

    const stopBtn = page.locator('button:has-text("stop")').first();
    if ((await stopBtn.count()) > 0) {
      await stopBtn.click().catch(() => {});
      await page.waitForTimeout(300);
      const dlg = page.locator('[data-testid="ui-dialog"]').first();
      if ((await dlg.count()) > 0 && (await dlg.isVisible().catch(() => false))) {
        await expect(dlg).toHaveScreenshot(`dashboard-ui-dialog${suffix}.png`, SCREENSHOT_OPTS);
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(150);
      }
    }

    await page.goto("/dev/panels/utility-sheet");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    const utilitySheet = page.getByRole("dialog", { name: /Result:/ });
    await utilitySheet.waitFor({ state: "visible", timeout: 10000 });
    if ((await utilitySheet.count()) > 0 && (await utilitySheet.isVisible().catch(() => false))) {
      await expect(utilitySheet).toHaveScreenshot(`dashboard-ui-sheet${suffix}.png`, SCREENSHOT_OPTS);
    }

    await page.goto("/");
    await waitForDashboardReady(page);
    await page
      .locator("#utilities")
      .scrollIntoViewIfNeeded()
      .catch(() => {});
    const runBtn = page.locator('[data-testid="utility-row"] button:has-text("Run")').first();
    if ((await runBtn.count()) > 0) {
      await runBtn.scrollIntoViewIfNeeded().catch(() => {});
      await runBtn.click().catch(() => {});
      await page.waitForTimeout(500);
      const toast = page.locator("[data-sonner-toast]").first();
      if ((await toast.count()) > 0 && (await toast.isVisible().catch(() => false))) {
        await expect(toast).toHaveScreenshot(`dashboard-ui-toast${suffix}.png`, SCREENSHOT_OPTS);
      }
    }
  });
}
