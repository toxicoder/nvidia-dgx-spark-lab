import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "fs";
import os from "os";
import path from "path";
import { getDb, resetDbForTests } from "@/lib/db";
import { getPreference, setPreference } from "../preferences";

describe("preferences repository", () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `prefs-test-${Date.now()}.db`);
    resetDbForTests(dbPath);
    process.env.USE_MOCKS = "0";
    migrate(getDb(), {
      migrationsFolder: path.join(__dirname, "../../migrations")
    });
  });

  afterEach(() => {
    resetDbForTests();
    process.env.USE_MOCKS = "1";
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it("stores and retrieves preferences by key", async () => {
    await setPreference("ui.sidebar.collapsed", "true");
    const value = await getPreference("ui.sidebar.collapsed");
    expect(value).toBe("true");
  });

  it("returns null for missing keys", async () => {
    expect(await getPreference("missing.key")).toBeNull();
  });

  it("updates existing preference on conflict", async () => {
    await setPreference("theme", "spark-lime");
    await setPreference("theme", "ocean-teal");
    expect(await getPreference("theme")).toBe("ocean-teal");
  });

  describe("USE_MOCKS=1", () => {
    beforeEach(() => {
      process.env.USE_MOCKS = "1";
    });

    it("getPreference returns null", async () => {
      expect(await getPreference("theme")).toBeNull();
    });

    it("setPreference is a no-op", async () => {
      await expect(setPreference("theme", "x")).resolves.toBeUndefined();
    });
  });
});
