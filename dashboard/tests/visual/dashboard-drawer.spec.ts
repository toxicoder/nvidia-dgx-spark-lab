import { test, expect } from "@playwright/test";

/**
 * Mobile navigation-drawer behaviour.
 *
 * These are behaviour assertions rather than goldens: the drawer's openness is derived from
 * the pathname in `DashboardShell`, and a derived value has failure modes a pixel comparison
 * cannot see. `stabilizePage` is deliberately NOT used here — it disables animations, and the
 * exit animation is exactly the window where the drawer used to eat the next tap.
 */

const MENU_BUTTON = 'button[aria-label="Open menu"]';
const SHEET = '[data-testid="ui-sheet"]';

test.beforeEach(async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
});

test("drawer closes when a nav link navigates", async ({ page }) => {
  await page.goto("/");
  await page.click(MENU_BUTTON);
  await expect(page.locator(SHEET)).toHaveAttribute("data-state", "open");

  await page.click(`${SHEET} [data-testid="nav-storage"]`);
  await expect(page).toHaveURL(/\/storage$/);
  await expect(page.locator(SHEET)).toHaveAttribute("data-state", "closed", { timeout: 10000 });
});

test("a tap during the closing animation still opens the drawer", async ({ page }) => {
  // Radix keeps the closing instance mounted for the exit animation and keeps listening for
  // outside interactions while it fades. Slowing that window makes the next tap land inside it
  // every run instead of on a race, so the assertion covers the defect rather than skipping it.
  await page.addStyleTag({
    content: `${SHEET}, .fixed.inset-0 { animation-duration: 2s !important; }`
  });
  await page.goto("/");
  await page.click(MENU_BUTTON);
  await expect(page.locator(SHEET)).toHaveAttribute("data-state", "open");

  await page.click(`${SHEET} [data-testid="nav-storage"]`);
  await expect(page).toHaveURL(/\/storage$/);
  await expect(page.locator(SHEET)).toHaveAttribute("data-state", "closed", { timeout: 10000 });
  // The stale instance must still be there, or this test would pass without covering anything.
  await expect(page.locator(SHEET)).toHaveCount(1);

  await page.click(MENU_BUTTON, { timeout: 5000 });
  await expect(page.locator(SHEET)).toHaveAttribute("data-state", "open", { timeout: 10000 });
  await expect(page.locator(`${SHEET} [data-testid="nav-storage"]`)).toBeVisible();
});

test("Escape closes the drawer", async ({ page }) => {
  await page.goto("/utilities");
  await page.click(MENU_BUTTON);
  await expect(page.locator(SHEET)).toHaveAttribute("data-state", "open");
  await page.keyboard.press("Escape");
  await expect(page.locator(SHEET)).toHaveAttribute("data-state", "closed", { timeout: 10000 });
});

test("a tap on the backdrop closes the drawer", async ({ page }) => {
  // The stale-dismiss guard in `Sheet` must not swallow a dismissal the operator actually asked
  // for: this pointer goes down long after the sheet finished opening.
  await page.goto("/");
  await page.click(MENU_BUTTON);
  await expect(page.locator(SHEET)).toHaveAttribute("data-state", "open");
  await page.mouse.click(370, 800);
  await expect(page.locator(SHEET)).toHaveAttribute("data-state", "closed", { timeout: 10000 });
});

test("a drawer opened on one route does not reappear on another", async ({ page }) => {
  await page.goto("/utilities");
  await page.click(MENU_BUTTON);
  await expect(page.locator(SHEET)).toHaveAttribute("data-state", "open");

  await page.goto("/tasks");
  await expect(page.locator(SHEET)).toHaveCount(0);
});
