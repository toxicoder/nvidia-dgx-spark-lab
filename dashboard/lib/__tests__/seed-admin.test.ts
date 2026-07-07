import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const signUpEmail = vi.fn().mockResolvedValue({ user: { id: "u1" } });
const selectMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      signUpEmail
    }
  }
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        limit: selectMock
      })
    })
  })
}));

describe("ensureAdminUser", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...origEnv, USE_MOCKS: "0", AUTH_BYPASS: "0" };
    delete process.env.LAB_DASHBOARD_ADMIN_EMAIL;
    delete process.env.LAB_DASHBOARD_ADMIN_PASSWORD;
    selectMock.mockResolvedValue([]);
    signUpEmail.mockResolvedValue({ user: { id: "u1" } });
  });

  afterEach(() => {
    process.env = origEnv;
    vi.resetModules();
  });

  it("no-ops when USE_MOCKS=1", async () => {
    process.env.USE_MOCKS = "1";
    const { ensureAdminUser } = await import("@/lib/seed-admin");
    await ensureAdminUser();
    expect(selectMock).not.toHaveBeenCalled();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("no-ops when admin env vars are missing", async () => {
    const { ensureAdminUser } = await import("@/lib/seed-admin");
    await ensureAdminUser();
    expect(selectMock).not.toHaveBeenCalled();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("seeds admin when no users exist", async () => {
    process.env.LAB_DASHBOARD_ADMIN_EMAIL = "admin@lab.local";
    process.env.LAB_DASHBOARD_ADMIN_PASSWORD = "secret-pass";

    const { ensureAdminUser } = await import("@/lib/seed-admin");
    await ensureAdminUser();

    expect(signUpEmail).toHaveBeenCalledWith({
      body: { email: "admin@lab.local", password: "secret-pass", name: "Lab Admin" }
    });
  });

  it("skips sign-up when users already exist", async () => {
    process.env.LAB_DASHBOARD_ADMIN_EMAIL = "admin@lab.local";
    process.env.LAB_DASHBOARD_ADMIN_PASSWORD = "secret-pass";
    selectMock.mockResolvedValue([{ id: "existing" }]);

    const { ensureAdminUser } = await import("@/lib/seed-admin");
    await ensureAdminUser();
    await ensureAdminUser();

    expect(signUpEmail).not.toHaveBeenCalled();
    expect(selectMock).toHaveBeenCalledTimes(1);
  });
});
