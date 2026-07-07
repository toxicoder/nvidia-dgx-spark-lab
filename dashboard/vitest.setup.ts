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

/** jsdom lacks ResizeObserver — Treemap and other layout components need it. */
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
