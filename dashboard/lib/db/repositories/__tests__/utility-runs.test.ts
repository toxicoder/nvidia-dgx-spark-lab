import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import fs from "fs";
import { getDb, resetDbForTests } from "@/lib/db";
import {
  recordUtilityRun,
  getLatestUtilityRun,
  getLatestUtilityRunsByName,
  listRecentUtilityRuns
} from "@/lib/db/repositories/utility-runs";

const dbFile = "/tmp/lab-dashboard-test.db";

describe("utility-runs repository", () => {
  beforeEach(() => {
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    resetDbForTests(dbFile);
    process.env.USE_MOCKS = "0";
    migrate(getDb(), {
      migrationsFolder: path.join(__dirname, "../../migrations")
    });
  });

  afterEach(() => {
    resetDbForTests();
    process.env.USE_MOCKS = "1";
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  it("records and retrieves the latest run for a utility", async () => {
    await recordUtilityRun({
      name: "spark-clock",
      stdout: '{"ok":true}',
      stderr: "",
      exitCode: 0
    });

    const latest = await getLatestUtilityRun("spark-clock");
    expect(latest?.name).toBe("spark-clock");
    expect(latest?.status).toBe("success");
    expect(latest?.exit_code).toBe(0);
  });

  it("skips persistence when USE_MOCKS=1", async () => {
    process.env.USE_MOCKS = "1";
    await recordUtilityRun({
      name: "spark-clock",
      stdout: "",
      stderr: "",
      exitCode: 0
    });
    const latest = await getLatestUtilityRun("spark-clock");
    expect(latest).toBeUndefined();
    expect(await getLatestUtilityRunsByName(["spark-clock"])).toEqual(new Map());
    expect(await listRecentUtilityRuns()).toEqual([]);
  });

  it("stores null output when stdout and stderr are empty", async () => {
    await recordUtilityRun({
      name: "silent-util",
      stdout: "",
      stderr: "",
      exitCode: 0
    });
    const latest = await getLatestUtilityRun("silent-util");
    expect(latest?.output).toBeNull();
  });

  it("records noop and error statuses", async () => {
    await recordUtilityRun({
      name: "noop-util",
      stdout: "",
      stderr: "skipped",
      exitCode: 2
    });
    await recordUtilityRun({
      name: "error-util",
      stdout: "",
      stderr: "boom",
      exitCode: 1
    });

    expect((await getLatestUtilityRun("noop-util"))?.status).toBe("noop");
    expect((await getLatestUtilityRun("error-util"))?.status).toBe("error");
  });

  it("getLatestUtilityRunsByName returns latest per utility", async () => {
    await recordUtilityRun({ name: "a", stdout: "1", stderr: "", exitCode: 0 });
    await recordUtilityRun({ name: "a", stdout: "2", stderr: "", exitCode: 0 });
    await recordUtilityRun({ name: "b", stdout: "b", stderr: "", exitCode: 0 });

    const map = await getLatestUtilityRunsByName(["a", "b"]);
    expect(map.get("a")?.output).toBe("2");
    expect(map.get("b")?.name).toBe("b");
  });

  it("returns empty map for empty name list", async () => {
    expect(await getLatestUtilityRunsByName([])).toEqual(new Map());
  });

  it("getLatestUtilityRun returns undefined on query failure", async () => {
    resetDbForTests("/tmp/nonexistent-dir/broken.db");
    expect(await getLatestUtilityRun("spark-clock")).toBeUndefined();
    resetDbForTests(dbFile);
    process.env.USE_MOCKS = "0";
    migrate(getDb(), {
      migrationsFolder: path.join(__dirname, "../../migrations")
    });
  });

  it("listRecentUtilityRuns returns rows in reverse id order", async () => {
    await recordUtilityRun({ name: "first", stdout: "1", stderr: "", exitCode: 0 });
    await recordUtilityRun({ name: "second", stdout: "2", stderr: "", exitCode: 0 });

    const rows = await listRecentUtilityRuns(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("second");
  });
});
