import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const getSessionCookie = vi.fn<() => unknown>();

vi.mock("better-auth/cookies", () => ({
  getSessionCookie: () => getSessionCookie()
}));

vi.mock("@/lib/env-guards", () => ({
  assertTestBypassAllowed: () => undefined
}));

/** Build a request for a pathname, with optional proxy-auth headers. */
function requestFor(pathname: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(pathname, "http://spark-lab.local"), { headers });
}

/** Import the middleware after the env has been stubbed for the case under test. */
async function loadMiddleware() {
  vi.resetModules();
  return (await import("@/middleware")).middleware;
}

describe("route protection middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_BYPASS", "0");
    vi.stubEnv("USE_MOCKS", "0");
    vi.stubEnv("TRUST_PROXY_AUTH", "0");
    getSessionCookie.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends an unauthenticated operator to login and remembers where they were", async () => {
    const middleware = await loadMiddleware();

    const response = middleware(requestFor("/storage"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
    expect(new URL(response.headers.get("location") ?? "").searchParams.get("next")).toBe("/storage");
  });

  it("lets an authenticated session through", async () => {
    getSessionCookie.mockReturnValue({ value: "session-token" });
    const middleware = await loadMiddleware();

    expect(middleware(requestFor("/storage")).status).toBe(200);
  });

  it("treats a trusted proxy identity as a session", async () => {
    vi.stubEnv("TRUST_PROXY_AUTH", "1");
    const middleware = await loadMiddleware();

    const response = middleware(requestFor("/system", { "remote-user": "operator" }));

    expect(response.status).toBe(200);
  });

  it("keeps login and the auth api public", async () => {
    const middleware = await loadMiddleware();

    expect(middleware(requestFor("/login")).status).toBe(200);
    expect(middleware(requestFor("/api/auth/sign-in")).status).toBe(200);
  });

  it("bounces an already-authenticated operator away from login", async () => {
    getSessionCookie.mockReturnValue({ value: "session-token" });
    const middleware = await loadMiddleware();

    const response = middleware(requestFor("/login"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/");
  });

  it("serves the fixture gallery outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const middleware = await loadMiddleware();

    expect(middleware(requestFor("/dev/panels")).status).toBe(200);
  });

  it("does not expose the fixture gallery in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const middleware = await loadMiddleware();

    const response = middleware(requestFor("/dev/panels"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").searchParams.get("next")).toBe("/dev/panels");
  });

  it("short-circuits every route when a test bypass is set", async () => {
    vi.stubEnv("USE_MOCKS", "1");
    const middleware = await loadMiddleware();

    expect(middleware(requestFor("/storage")).status).toBe(200);
  });
});
