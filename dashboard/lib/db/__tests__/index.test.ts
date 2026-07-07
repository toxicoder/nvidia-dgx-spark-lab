import { describe, it, expect, afterEach } from "vitest";
import { getDb, resetDbForTests } from "../index";

describe("db index", () => {
  afterEach(() => {
    resetDbForTests();
    process.env.USE_MOCKS = "1";
  });

  it("skips auto-migrate when USE_MOCKS=1", () => {
    process.env.USE_MOCKS = "1";
    process.env.DATABASE_URL = "file:/tmp/mocks-db.db";
    expect(getDb()).toBeDefined();
  });

  it("db proxy exposes non-function drizzle properties", async () => {
    const { db } = await import("../index");
    process.env.USE_MOCKS = "1";
    process.env.DATABASE_URL = "file:/tmp/proxy-db.db";
    expect(db._.fullSchema).toBeDefined();
  });
});
