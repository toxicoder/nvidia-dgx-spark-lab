import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getServiceMocks, resetRealPathEnv } from "./real-path-mocks";

vi.mock("../../db/repositories/utility-runs", () => ({
  recordUtilityRun: vi.fn().mockResolvedValue(undefined)
}));

import * as utilities from "../utilities";

describe("utilities service (mock)", () => {
  beforeEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("listUtilities returns allowed utilities", () => {
    const list = utilities.listUtilities();
    expect(list.some((u) => u.name === "spark-clock")).toBe(true);
  });

  it("getUtilityStatus returns shape", async () => {
    const st = await utilities.getUtilityStatus("spark-clock");
    expect(st).toHaveProperty("status");
  });

  it("runUtility returns mock stdout under USE_MOCKS", async () => {
    const result = await utilities.runUtility("spark-clock", ["run"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("mock");
  });

  it("runUtility returns visual payload when VISUAL_TEST=1", async () => {
    process.env.VISUAL_TEST = "1";
    const result = await utilities.runUtility("spark-clock");
    expect(result.stdout).toContain("dgx-spark");
  });

  it("runUtility throws for unknown utility", async () => {
    await expect(utilities.runUtility("not-a-real-utility")).rejects.toThrow(/Unknown utility/);
  });
});

describe("utilities service (real path)", () => {
  beforeEach(() => {
    resetRealPathEnv();
    process.env.BUILD_WORKSPACE_DIRECTORY = "/workspace";
    getServiceMocks().existsSync.mockImplementation((p: string) => p === "/workspace/scripts/utilities");
    getServiceMocks().readdirSync.mockReturnValue([
      "spark-clock.sh",
      "system-update.sh",
      "sync-ollama-models.sh",
      "not-allowed.sh"
    ] as string[]);
  });

  afterEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("listUtilities reads directory and filters allowlist", () => {
    const list = utilities.listUtilities();
    expect(list.map((u) => u.name).sort()).toEqual(["spark-clock", "sync-ollama-models", "system-update"].sort());
  });

  it("getUtilitiesDir resolves through candidate paths", () => {
    delete process.env.BUILD_WORKSPACE_DIRECTORY;
    getServiceMocks().existsSync.mockImplementation((p: string) => p.endsWith("/scripts/utilities"));
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: '{"status":"ok"}', stderr: "" });
    expect(utilities.listUtilities().length).toBeGreaterThan(0);
  });

  it("getUtilityStatus handles non-Error exec failure", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue("raw status failure");
    const st = await utilities.getUtilityStatus("spark-clock");
    expect(st).toEqual({ error: "raw status failure" });
  });

  it("listUtilities returns empty when utilities dir missing", () => {
    getServiceMocks().existsSync.mockReturnValue(false);
    expect(utilities.listUtilities()).toEqual([]);
  });

  it("getUtilityStatus parses utility JSON", async () => {
    const payload = { name: "spark-clock", status: "ok", lastRun: "2026-01-01" };
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: JSON.stringify(payload), stderr: "" });

    const st = await utilities.getUtilityStatus("spark-clock");
    expect(st).toEqual(payload);
  });

  it("getUtilityStatus returns error message on exec failure", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue(new Error("status timeout"));
    const st = await utilities.getUtilityStatus("spark-clock");
    expect(st).toEqual({ error: "status timeout" });
  });

  it("getUtilityStatus throws for unknown utility", async () => {
    await expect(utilities.getUtilityStatus("missing-utility")).rejects.toThrow(/Unknown utility/);
  });

  it("runUtility executes script and records success", async () => {
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: "done", stderr: "" });
    const result = await utilities.runUtility("spark-clock", ["run", "--json"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("done");
  });

  it("runUtility defaults args to run", async () => {
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: "ok", stderr: "" });
    await utilities.runUtility("spark-clock");
    expect(getServiceMocks().execFileAsync).toHaveBeenCalledWith(
      expect.stringContaining("spark-clock.sh"),
      ["run"],
      expect.any(Object)
    );
  });

  it("runUtility records failure exit code", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ stdout: "out", stderr: "err", code: 2 });
    const result = await utilities.runUtility("system-update");
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe("err");
  });

  it("runUtility handles failure without stderr/code", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue("run failed");
    const result = await utilities.runUtility("sync-ollama-models");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("run failed");
  });
});
