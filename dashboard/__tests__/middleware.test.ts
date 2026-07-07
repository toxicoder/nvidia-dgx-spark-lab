import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const getSessionCookie = vi.fn();

vi.mock("better-auth/cookies", () => ({
  getSessionCookie: (...args: unknown[]) => getSessionCookie(...args)
}));

import { middleware } from "../middleware";

function req(path: string) {
  return new NextRequest(new URL(`http://localhost:3000${path}`));
}

describe("middleware", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...origEnv, NODE_ENV: "test" };
    delete process.env.AUTH_BYPASS;
    delete process.env.USE_MOCKS;
    getSessionCookie.mockReturnValue(undefined);
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("redirects unauthenticated users to login", () => {
    const res = middleware(req("/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("allows authenticated users with session cookie", () => {
    getSessionCookie.mockReturnValue("session-token");
    const res = middleware(req("/"));
    expect(res.status).toBe(200);
  });

  it("allows public login path", () => {
    const res = middleware(req("/login"));
    expect(res.status).toBe(200);
  });

  it("bypasses auth when USE_MOCKS=1 in non-production", () => {
    process.env.USE_MOCKS = "1";
    const res = middleware(req("/"));
    expect(res.status).toBe(200);
  });

  it("forbids USE_MOCKS in production", () => {
    process.env = { ...process.env, NODE_ENV: "production", USE_MOCKS: "1" };
    expect(() => middleware(req("/"))).toThrow(/USE_MOCKS/);
  });

  it("bypasses auth when AUTH_BYPASS=1 in non-production", () => {
    process.env.AUTH_BYPASS = "1";
    const res = middleware(req("/"));
    expect(res.status).toBe(200);
  });

  it("forbids AUTH_BYPASS in production", () => {
    process.env = { ...process.env, NODE_ENV: "production", AUTH_BYPASS: "1" };
    expect(() => middleware(req("/"))).toThrow(/AUTH_BYPASS/);
  });

  it("allows proxy-authenticated users when TRUST_PROXY_AUTH=1", () => {
    process.env.TRUST_PROXY_AUTH = "1";
    getSessionCookie.mockClear();
    const request = new NextRequest(new URL("http://localhost:3000/"), {
      headers: { "x-forwarded-user": "coder" }
    });
    expect(middleware(request).status).toBe(200);
  });

  it("reads Remote-User header for proxy auth", () => {
    process.env.TRUST_PROXY_AUTH = "1";
    const request = new NextRequest(new URL("http://localhost:3000/"), {
      headers: { "Remote-User": "alice" }
    });
    expect(middleware(request).status).toBe(200);
  });
});
