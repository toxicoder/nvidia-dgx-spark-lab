import { test, expect } from "@playwright/test";
import { stabilizePage } from "./visual-helpers";

/**
 * The console's own not-found page, reached the way an operator reaches it: a mistyped section.
 *
 * `app/(dashboard)/[section]/page.tsx` calls `notFound()` for anything outside the closed slug
 * set, and `app/(dashboard)/not-found.tsx` answers. `font-coverage.spec.ts` proves the page uses
 * the bundled faces; this proves it explains itself and gets the operator back to work.
 */

test("an unknown section offers the way back to the overview", async ({ page }) => {
  test.setTimeout(120000);
  await stabilizePage(page);

  await page.goto("/section-that-does-not-exist");
  await expect(page.getByRole("heading", { name: "Section not found", level: 1 })).toBeVisible();
  await expect(page.getByTestId("empty-state")).toBeVisible();

  await page.getByRole("link", { name: /back to the overview/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "DGX Spark Lab", level: 1 })).toBeVisible();
});
