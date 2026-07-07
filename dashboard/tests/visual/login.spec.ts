import { test, expect } from "@playwright/test";
import { SCREENSHOT_OPTS, stabilizePage } from "./visual-helpers";

test("login page golden", async ({ page }) => {
  await stabilizePage(page);
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("dashboard-login.png", SCREENSHOT_OPTS);
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page).toHaveScreenshot("dashboard-login-mobile.png", SCREENSHOT_OPTS);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/login?visual_error=1");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("dashboard-login-error.png", SCREENSHOT_OPTS);
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page).toHaveScreenshot("dashboard-login-error-mobile.png", SCREENSHOT_OPTS);
});
