import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/** Hermetic defaults for dashboard unit tests (matches Playwright webServer). */
process.env.USE_MOCKS = "1";

export const notFoundMock = vi.fn(() => {
  throw new Error("NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  notFound: () => notFoundMock()
}));

/**
 * `next/font/local` only resolves through Next's build loader, which vitest does not run, so
 * the real module answers with something that is not callable. The shim echoes the requested
 * CSS variable back: a test that renders the root layout can then assert the layout publishes
 * the token each face declares instead of silently rendering without a typeface.
 */
vi.mock("next/font/local", () => ({
  default: (options: { variable?: string }) => ({ variable: options.variable ?? "" })
}));

/** jsdom lacks ResizeObserver — Treemap and other layout components need it. */
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
