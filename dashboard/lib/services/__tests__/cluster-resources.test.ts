import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getServiceMocks, mockUtilityExists, resetRealPathEnv } from "./real-path-mocks";
import * as cluster from "../cluster-resources";

describe("cluster-resources service (mock)", () => {
  beforeEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("getClusterCapacity returns mock capacity", async () => {
    const cap = await cluster.getClusterCapacity();
    expect(cap.node_count).toBeGreaterThan(0);
    expect(cap.allocatable.gpus).toBeGreaterThan(0);
  });

  it("checkCapacity returns mock verdict", async () => {
    const check = await cluster.checkCapacity("model:kimi-test");
    expect(check).toHaveProperty("verdict");
  });

  it("suggestFreeResources returns suggestions", async () => {
    const suggestions = await cluster.suggestFreeResources("model:kimi-test");
    expect(Array.isArray(suggestions)).toBe(true);
  });
});

describe("cluster-resources service (real path)", () => {
  beforeEach(() => {
    resetRealPathEnv();
    mockUtilityExists("cluster-resources.sh");
  });

  afterEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("getClusterCapacity parses utility JSON", async () => {
    const payload = { node_count: 2, allocatable: { gpus: 2, cpu: "32", memory: "128Gi" } };
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: JSON.stringify(payload), stderr: "" });

    const cap = await cluster.getClusterCapacity();
    expect(cap.node_count).toBe(2);
    expect(getServiceMocks().execFileAsync).toHaveBeenCalled();
  });

  it("getClusterCapacity returns error when utility missing", async () => {
    getServiceMocks().existsSync.mockReturnValue(false);
    const cap = await cluster.getClusterCapacity();
    expect(cap.error).toMatch(/Utility not found/);
  });

  it("getClusterCapacity handles exec failure", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue(new Error("kubectl timeout"));
    const cap = await cluster.getClusterCapacity();
    expect(cap.error).toBe("kubectl timeout");
  });

  it("getClusterCapacity handles non-Error exec failure", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue("boom");
    const cap = await cluster.getClusterCapacity();
    expect(cap.error).toBe("boom");
  });

  it("checkCapacity parses successful check JSON", async () => {
    const payload = {
      ok: true,
      verdict: "ok",
      action: "model:kimi-test",
      required: { gpus: 1, cpu: "4", memory: "8Gi" },
      available: { gpus: 2, cpu: "8", memory: "16Gi" },
      deficit: {}
    };
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: JSON.stringify(payload), stderr: "" });

    const check = await cluster.checkCapacity("model:kimi-test");
    expect(check.verdict).toBe("ok");
  });

  it("checkCapacity parses error stdout when exec fails", async () => {
    const payload = {
      ok: false,
      verdict: "insufficient_gpu",
      action: "model:kimi",
      required: { gpus: 8, cpu: "32", memory: "128Gi" },
      available: { gpus: 0, cpu: "0", memory: "0" },
      deficit: { gpus: 8 }
    };
    getServiceMocks().execFileAsync.mockRejectedValue({ stdout: JSON.stringify(payload) });

    const check = await cluster.checkCapacity("model:kimi");
    expect(check.verdict).toBe("insufficient_gpu");
  });

  it("checkCapacity returns default error shape when stdout is not JSON", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ stdout: "not json", message: "failed" });

    const check = await cluster.checkCapacity("model:kimi-test");
    expect(check.ok).toBe(false);
    expect(check.verdict).toBe("error");
  });

  it("checkCapacity returns default error shape without stdout", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue(new Error("no stdout"));

    const check = await cluster.checkCapacity("model:kimi-test");
    expect(check.ok).toBe(false);
    expect(check.verdict).toBe("error");
  });

  it("suggestFreeResources parses suggestions JSON", async () => {
    const suggestions = [{ action: "stop:kimi-test", frees: { gpus: 2 } }];
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: JSON.stringify(suggestions), stderr: "" });

    const result = await cluster.suggestFreeResources("model:kimi");
    expect(result).toEqual(suggestions);
  });

  it("suggestFreeResources returns empty array on failure", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue(new Error("suggest failed"));
    const result = await cluster.suggestFreeResources("model:kimi");
    expect(result).toEqual([]);
  });

  it("getUtilityPath falls back when workspace script missing", async () => {
    delete process.env.BUILD_WORKSPACE_DIRECTORY;
    getServiceMocks().existsSync.mockImplementation((p: string) =>
      p.endsWith("/scripts/utilities/cluster-resources.sh")
    );
    getServiceMocks().execFileAsync.mockResolvedValue({
      stdout: JSON.stringify({ node_count: 1, allocatable: { gpus: 1, cpu: "1", memory: "1Gi" } }),
      stderr: ""
    });

    await cluster.getClusterCapacity();
    expect(getServiceMocks().existsSync).toHaveBeenCalled();
  });
});
