import { describe, it, expect, vi, afterEach } from "vitest";

const createAuthClient = vi.fn((config: { baseURL: string }) => ({ config }));

vi.mock("better-auth/react", () => ({
  createAuthClient
}));

describe("auth-client", () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
    vi.resetModules();
    createAuthClient.mockClear();
  });

  it("uses NEXT_PUBLIC_BETTER_AUTH_URL when set", async () => {
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL = "https://dash.lab.example";
    const { authClient } = await import("@/lib/auth-client");

    expect(createAuthClient).toHaveBeenCalledWith({ baseURL: "https://dash.lab.example" });
    expect(authClient).toEqual({ config: { baseURL: "https://dash.lab.example" } });
  });

  it("falls back to localhost in development", async () => {
    delete process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
    const { authClient } = await import("@/lib/auth-client");

    expect(createAuthClient).toHaveBeenCalledWith({ baseURL: "http://localhost:3000" });
    expect(authClient).toEqual({ config: { baseURL: "http://localhost:3000" } });
  });
});
