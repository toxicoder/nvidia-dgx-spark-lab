import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { handler: vi.fn() }
}));

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: () => ({
    GET: vi.fn(),
    POST: vi.fn(),
    PATCH: vi.fn(),
    PUT: vi.fn(),
    DELETE: vi.fn()
  })
}));

describe("app/api/auth route", () => {
  it("exports HTTP method handlers from better-auth", async () => {
    const route = await import("@/app/api/auth/[...all]/route");
    expect(typeof route.GET).toBe("function");
    expect(typeof route.POST).toBe("function");
    expect(typeof route.PATCH).toBe("function");
    expect(typeof route.PUT).toBe("function");
    expect(typeof route.DELETE).toBe("function");
  });
});
