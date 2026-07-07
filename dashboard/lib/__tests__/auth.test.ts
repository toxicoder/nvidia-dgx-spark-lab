import { describe, it, expect, afterEach, vi } from "vitest";

describe("auth production guard", () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
    vi.resetModules();
  });

  it("throws when BETTER_AUTH_SECRET is missing in production runtime", async () => {
    process.env = { ...origEnv, NODE_ENV: "production" };
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.NEXT_PHASE;
    delete process.env.USE_MOCKS;
    delete process.env.AUTH_BYPASS;

    await expect(import("@/lib/auth")).rejects.toThrow(/BETTER_AUTH_SECRET/);
  });

  it("allows production build phase without BETTER_AUTH_SECRET", async () => {
    process.env = {
      ...origEnv,
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build"
    };
    delete process.env.BETTER_AUTH_SECRET;

    const mod = await import("@/lib/auth");
    expect(mod.auth).toBeDefined();
  });

  it("loads auth in non-production without BETTER_AUTH_SECRET", async () => {
    process.env = { ...origEnv, NODE_ENV: "test" };
    delete process.env.BETTER_AUTH_SECRET;

    const mod = await import("@/lib/auth");
    expect(mod.auth).toBeDefined();
  });
});
