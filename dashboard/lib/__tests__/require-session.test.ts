import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn()
}));

const { mockHeaders } = vi.hoisted(() => ({
  mockHeaders: vi.fn().mockResolvedValue(new Headers())
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession
    }
  }
}));

import { requireSession, requireSessionUser, UnauthorizedError } from "../require-session";

describe("requireSession", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...origEnv, NODE_ENV: "test" };
    delete process.env.AUTH_BYPASS;
    delete process.env.USE_MOCKS;
    delete process.env.VISUAL_TEST;
    getSession.mockReset();
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("skips auth when AUTH_BYPASS=1 in non-production", async () => {
    process.env.AUTH_BYPASS = "1";
    await expect(requireSession()).resolves.toBeUndefined();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("skips auth when USE_MOCKS=1 in non-production", async () => {
    process.env.USE_MOCKS = "1";
    await expect(requireSession()).resolves.toBeUndefined();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("skips auth when VISUAL_TEST=1 even in production", async () => {
    process.env = { ...process.env, NODE_ENV: "production", VISUAL_TEST: "1" };
    await expect(requireSession()).resolves.toBeUndefined();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("requires session in production without bypass flags", async () => {
    process.env = { ...process.env, NODE_ENV: "production" };
    getSession.mockResolvedValue(null);
    await expect(requireSession()).rejects.toThrow(UnauthorizedError);
    expect(getSession).toHaveBeenCalled();
  });

  it("passes when session has a user with email", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", email: "admin@lab.local" } });
    await expect(requireSession()).resolves.toBeUndefined();
  });

  it("throws UnauthorizedError when session is missing", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireSession()).rejects.toThrow(/Unauthorized/);
  });

  it("requireSessionUser uses proxy headers when TRUST_PROXY_AUTH=1", async () => {
    process.env = { ...process.env, NODE_ENV: "production", TRUST_PROXY_AUTH: "1" };
    mockHeaders.mockResolvedValue(new Headers({ "remote-user": "coder", "remote-email": "coder@lab.local" }));
    await expect(requireSessionUser()).resolves.toEqual({
      id: "proxy:coder",
      email: "coder@lab.local"
    });
    expect(getSession).not.toHaveBeenCalled();
  });

  it("requireSessionUser falls back to Remote-User and x-forwarded-user headers", async () => {
    process.env = { ...process.env, NODE_ENV: "production", TRUST_PROXY_AUTH: "1" };
    mockHeaders.mockResolvedValue(new Headers({ "x-forwarded-user": "alice" }));
    await expect(requireSessionUser()).resolves.toEqual({
      id: "proxy:alice",
      email: "alice@lab.local"
    });
  });

  it("requireSessionUser reads Remote-User and Remote-Email proxy headers", async () => {
    process.env = { ...process.env, NODE_ENV: "production", TRUST_PROXY_AUTH: "1" };
    mockHeaders.mockResolvedValue(new Headers({ "Remote-User": "bob", "Remote-Email": "bob@corp.local" }));
    await expect(requireSessionUser()).resolves.toEqual({
      id: "proxy:bob",
      email: "bob@corp.local"
    });
  });

  it("requireSessionUser bypasses via AUTH_BYPASS only", async () => {
    process.env = { ...process.env, NODE_ENV: "test", AUTH_BYPASS: "1" };
    delete process.env.USE_MOCKS;
    await expect(requireSessionUser()).resolves.toEqual({
      id: "mock-user",
      email: "mock@lab.local"
    });
  });

  it("requireSessionUser bypasses via USE_MOCKS only", async () => {
    process.env = { ...process.env, NODE_ENV: "test", USE_MOCKS: "1" };
    delete process.env.AUTH_BYPASS;
    await expect(requireSessionUser()).resolves.toEqual({
      id: "mock-user",
      email: "mock@lab.local"
    });
  });

  it("requireSessionUser falls through when proxy headers are empty", async () => {
    process.env = { ...process.env, NODE_ENV: "production", TRUST_PROXY_AUTH: "1" };
    mockHeaders.mockResolvedValue(new Headers());
    getSession.mockResolvedValue({ user: { id: "u1", email: "a@b.c" } });
    await expect(requireSessionUser()).resolves.toEqual({ id: "u1", email: "a@b.c" });
  });

  it("requireSessionUser ignores proxy headers when TRUST_PROXY_AUTH is unset", async () => {
    process.env = { ...process.env, NODE_ENV: "production" };
    delete process.env.TRUST_PROXY_AUTH;
    mockHeaders.mockResolvedValue(new Headers({ "remote-user": "coder" }));
    getSession.mockResolvedValue({ user: { id: "u1", email: "admin@lab.local" } });
    await expect(requireSessionUser()).resolves.toEqual({
      id: "u1",
      email: "admin@lab.local"
    });
  });
});
