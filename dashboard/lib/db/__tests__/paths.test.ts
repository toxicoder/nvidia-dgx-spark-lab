import { describe, it, expect, afterEach } from "vitest";
import { getDbPath, getMigrationsDir } from "../paths";

describe("db paths", () => {
  const origDb = process.env.DATABASE_URL;
  const origMig = process.env.MIGRATIONS_DIR;

  afterEach(() => {
    if (origDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = origDb;
    if (origMig === undefined) delete process.env.MIGRATIONS_DIR;
    else process.env.MIGRATIONS_DIR = origMig;
  });

  it("getDbPath uses DATABASE_URL when set", () => {
    process.env.DATABASE_URL = "file:/custom/path.db";
    expect(getDbPath()).toBe("/custom/path.db");
  });

  it("getDbPath falls back to default", () => {
    delete process.env.DATABASE_URL;
    expect(getDbPath()).toBe("/tmp/lab-dashboard.db");
  });

  it("getMigrationsDir uses MIGRATIONS_DIR when set", () => {
    process.env.MIGRATIONS_DIR = "/migrations";
    expect(getMigrationsDir()).toBe("/migrations");
  });
});
