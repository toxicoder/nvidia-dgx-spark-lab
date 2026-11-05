/**
 * Shared setup for the docs-site unit suite.
 *
 * The site's components are rendered in jsdom here, so the matcher set and the browser APIs
 * they lean on are installed once, the same way `dashboard/vitest.setup.ts` does it.
 */

import "@testing-library/jest-dom/vitest";

/**
 * fumadocs-ui renders matchMedia-dependent chrome (theme switch, search dialog) on mount.
 * jsdom does not implement it, so every component test would otherwise need its own stub.
 */
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })
  });
}

/** jsdom has no ResizeObserver; the collapsible panels measure themselves with it. */
if (!globalThis.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

/** jsdom does not implement scrollIntoView, which the search dialog uses to focus a row. */
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}
