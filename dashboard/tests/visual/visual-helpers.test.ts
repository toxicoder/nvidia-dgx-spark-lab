import { describe, expect, it } from "vitest";
import type { Page } from "@playwright/test";

import { MAIN_PAGE_ELEMENTS, STORAGE_EXTRA_CAPTURES, waitForDashboardReady } from "./visual-helpers";

/**
 * `waitForDashboardReady` used to ask for the home-page treemap and the home-page task /
 * machine panels on every route. Those nodes only exist on `/`, so a section route paid
 * both full timeouts (10s + 8s) and swallowed the miss, which pushed the ten-route
 * sections capture past its test timeout. Readiness has to be scoped to what the route
 * actually renders.
 */

interface ReadyCalls {
  loadStates: string[];
  evaluates: number;
  waiters: number;
  timeouts: number;
}

function fakePage(options: { waiterAlwaysRejects?: boolean } = {}): { page: Page; calls: ReadyCalls } {
  const calls: ReadyCalls = { loadStates: [], evaluates: 0, waiters: 0, timeouts: 0 };
  const page = {
    waitForLoadState: async (state: string) => {
      calls.loadStates.push(state);
    },
    evaluate: async () => {
      calls.evaluates += 1;
    },
    waitForFunction: async () => {
      calls.waiters += 1;
      if (options.waiterAlwaysRejects) {
        throw new Error("waitForFunction: timeout 10000ms exceeded");
      }
    },
    waitForTimeout: async () => {
      calls.timeouts += 1;
    }
  };
  return { page: page as unknown as Page, calls };
}

describe("waitForDashboardReady", () => {
  it("keeps waiting for the treemap and the home panels on the home page", async () => {
    const { page, calls } = fakePage();

    await waitForDashboardReady(page);

    expect(calls.waiters).toBe(2);
    expect(calls.loadStates).toEqual(["domcontentloaded", "networkidle", "load"]);
    expect(calls.evaluates).toBe(1);
  });

  it("skips the treemap and home-panel waits for a single-section route", async () => {
    const { page, calls } = fakePage();

    await waitForDashboardReady(page, { treemap: false, homePanels: false });

    expect(calls.waiters).toBe(0);
  });

  it("still resolves for a section route when nothing else would settle", async () => {
    const { page } = fakePage({ waiterAlwaysRejects: true });

    await expect(waitForDashboardReady(page, { treemap: false, homePanels: false })).resolves.toBeUndefined();
  });

  it("can drop only the treemap wait", async () => {
    const { page, calls } = fakePage();

    await waitForDashboardReady(page, { treemap: false });

    expect(calls.waiters).toBe(1);
  });

  it("can drop only the home-panel wait", async () => {
    const { page, calls } = fakePage();

    await waitForDashboardReady(page, { homePanels: false });

    expect(calls.waiters).toBe(1);
  });
});

/**
 * The treemap is rendered by `StoragePanel`, which mounts on `/storage`. It never appears on
 * the overview, so listing it among the overview captures left `dashboard-main.spec.ts`
 * skipping four names it claimed to own, and the base treemap goldens silently stopped being
 * produced while their stale dark PNGs stayed on disk.
 */
describe("capture element lists", () => {
  it("keeps the treemap out of the overview capture list", () => {
    expect(MAIN_PAGE_ELEMENTS.map((entry) => entry.baseSlug)).not.toContain("dashboard-treemap");
    for (const entry of MAIN_PAGE_ELEMENTS) {
      expect(entry.baseSlug.startsWith("dashboard-treemap")).toBe(false);
    }
  });

  it("captures every treemap surface on the storage route", () => {
    expect(STORAGE_EXTRA_CAPTURES.map((entry) => entry.baseSlug).sort()).toEqual(
      ["dashboard-treemap", "dashboard-treemap-controls", "dashboard-treemap-side-list", "dashboard-treemap-viz"].sort()
    );
  });
});
