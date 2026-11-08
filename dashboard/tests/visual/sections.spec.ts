import { test, expect } from "@playwright/test";
import {
  SECTION_ROUTES,
  STORAGE_EXTRA_CAPTURES,
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
 * Per-route section goldens.
 *
 * Sections became real routes, so each one is now captured by navigating to `/{slug}`.
 * Every capture is preceded by a hard assertion that its target is visible: a section that
 * fails to render fails this run rather than silently contributing no golden.
 *
 * Dark and light are both captured because light mode was the weakest area in the audit,
 * and a dark-only golden matrix cannot catch it regressing.
 */
for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    test(`section routes (${vp.name}, ${theme.name})`, async ({ page }) => {
      test.setTimeout(240000);
      const suffix = `${viewportSuffix(vp.name)}${themeSuffix(theme.name)}`;

      await stabilizePage(page);
      await applyTheme(page, theme);
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const route of SECTION_ROUTES) {
        await page.goto(`/${route.slug}`);
        // A section route renders one panel: no treemap, no home-page task/machine panels.
        // `requireVisible` below is the real assertion for what this route must show.
        await waitForDashboardReady(page, { treemap: false, homePanels: false });

        await requirePageTitle(page, /\S/);
        await requireVisible(page, route.requiredSelector, `${route.slug} panel`);
        await requireVisible(page, '[data-slot="panel"]', `${route.slug} panel frame`);

        await captureElement(page, page.locator(route.requiredSelector).first(), `${route.baseSlug}${suffix}.png`, {
          hideChrome: true
        });

        // The storage route owns the treemap surfaces: they render inside StoragePanel, so
        // they get the same viewport x theme coverage as the panel that hosts them.
        if (route.slug === "storage") {
          for (const extra of STORAGE_EXTRA_CAPTURES) {
            await requireVisible(page, extra.selector, `${extra.baseSlug} on /storage`);
            await captureElement(page, page.locator(extra.selector).first(), `${extra.baseSlug}${suffix}.png`, {
              hideChrome: extra.hideChrome,
              extraWait: extra.extraWait
            });
          }
        }
      }

      // The rail is the one chrome element that must hold in every theme: it carries the
      // active-section state, and light mode previously rendered it with unreadable text.
      // The landmark is labelled "Primary" on desktop and "Dashboard sections" on mobile,
      // so assert the landmark exists rather than pinning one of the two names. On mobile the
      // rail lives inside a closed Radix Sheet, which unmounts its content, so open it first.
      await page.goto("/");
      await waitForDashboardReady(page);
      if (vp.name === "mobile") {
        await page.getByRole("button", { name: "Open menu" }).click();
      }
      await expect(page.getByRole("navigation").first()).toBeVisible();
    });
  }
}
