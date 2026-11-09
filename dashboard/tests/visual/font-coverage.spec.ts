/**
 * Asserts no operator-visible text falls back to a system font.
 *
 * The app self-hosts its two faces (see `app/layout.tsx`) precisely so that a dev box, the
 * pinned test image, and an operator's laptop all measure text the same way. A glyph outside
 * the bundled subsets silently returns to whatever the host OS ships, which is invisible on one
 * machine and shows up as an unexplained pixel diff on another. This walks the real routes and
 * asks Chromium which face it actually used per node.
 */
import { test, expect } from "@playwright/test";
import { SECTION_ROUTES, stabilizePage } from "./visual-helpers";

/** Both bundled faces report under this family prefix. */
const BUNDLED_PREFIX = "Noto Sans";

/** Enough of each page to catch a fallback without spending the whole lane budget. */
const NODE_CAP = 250;

const SELECTOR = "h1,h2,h3,h4,button,a,p,span,label,li,td,th,code,pre,input";

/**
 * A mistyped section is a route operators actually reach, and it used to be the one page Next
 * rendered itself: unstyled, and set in the platform font. `app/(dashboard)/not-found.tsx`
 * replaced that default, and this keeps it from quietly coming back.
 */
const NOT_FOUND_ROUTE = { slug: "section-that-does-not-exist", requiredSelector: '[data-testid="empty-state"]' };

test("every rendered glyph uses a self-hosted face", async ({ page }) => {
  await stabilizePage(page);
  const client = await page.context().newCDPSession(page);
  await client.send("DOM.enable");
  await client.send("CSS.enable");

  const offenders: string[] = [];

  for (const route of [NOT_FOUND_ROUTE, ...SECTION_ROUTES]) {
    const response = await page.goto(`/${route.slug}`, { waitUntil: "networkidle" });
    expect(response?.status(), `${route.slug} did not render`).toBeLessThan(400);
    await page.waitForSelector(route.requiredSelector, { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);

    const { root } = await client.send("DOM.getDocument");
    const { nodeIds } = await client.send("DOM.querySelectorAll", {
      nodeId: root.nodeId,
      selector: SELECTOR
    });

    for (const nodeId of nodeIds.slice(0, NODE_CAP)) {
      const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
      for (const font of fonts) {
        if (font.familyName && !font.familyName.startsWith(BUNDLED_PREFIX)) {
          offenders.push(`${route.slug}: ${font.familyName}`);
        }
      }
    }
  }

  expect(offenders.slice(0, 6), `system fallback in use -> ${offenders.join(", ")}`).toHaveLength(0);
});

/**
 * Sonner brings its own `font-family` on the toast, so the app's `font-sans` never reaches it
 * unless the toaster is told. Untold, the toast measured in the host's system face: DejaVu Sans
 * on a dev box and the pinned image's distro-packaged Noto Sans in CI, which is a different build
 * of a similar name and drifted the `dashboard-ui-toast` golden by 899 pixels.
 */
test("a toast renders in the bundled faces too", async ({ page }) => {
  await stabilizePage(page);
  const client = await page.context().newCDPSession(page);
  await client.send("DOM.enable");
  await client.send("CSS.enable");

  await page.goto("/utilities", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="utility-row"]', { timeout: 15000 });
  await page.locator('[data-testid="utility-row"] button:has-text("Run")').first().click();
  await page.locator("[data-sonner-toast]").first().waitFor({ state: "visible", timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);

  const offenders: string[] = [];
  for (const selector of ["[data-sonner-toast] [data-title]", "[data-sonner-toast] [data-description]"]) {
    const { root } = await client.send("DOM.getDocument");
    const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector });
    expect(nodeIds.length, `${selector} never rendered`).toBeGreaterThan(0);
    for (const nodeId of nodeIds) {
      const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
      for (const font of fonts) {
        if (font.familyName && !font.familyName.startsWith(BUNDLED_PREFIX)) {
          offenders.push(`${selector}: ${font.familyName}`);
        }
      }
    }
  }

  expect(offenders.slice(0, 6), `toast fell back to a system face -> ${offenders.join(", ")}`).toHaveLength(0);
});
