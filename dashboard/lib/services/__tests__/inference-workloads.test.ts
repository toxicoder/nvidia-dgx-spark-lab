import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getServiceMocks, mockUtilityExists, resetRealPathEnv } from "./real-path-mocks";
import * as inference from "../inference-workloads";

describe("inference-workloads service (mock)", () => {
  beforeEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("getInferenceWorkloadsStatus returns mock jobs", async () => {
    const status = await inference.getInferenceWorkloadsStatus();
    expect(status.jobs).toBeDefined();
  });

  it("startInferenceWorkload returns mock result", async () => {
    const result = await inference.startInferenceWorkload("kimi-test", "yes");
    expect(result).toBeDefined();
  });

  it("stopInferenceWorkload handles all and model targets", async () => {
    await inference.stopInferenceWorkload("all");
    await inference.stopInferenceWorkload("kimi-test");
  });
});

describe("inference-workloads service (real path)", () => {
  beforeEach(() => {
    resetRealPathEnv();
    mockUtilityExists("inference-workloads.sh");
  });

  afterEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("getInferenceWorkloadsStatus parses utility JSON", async () => {
    const payload = {
      namespace: "ai-inference",
      jobs: [{ model: "kimi-test", job: "kimi-test", active: 1, state: "running" }]
    };
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: JSON.stringify(payload), stderr: "" });

    const status = await inference.getInferenceWorkloadsStatus();
    expect(status.jobs[0].model).toBe("kimi-test");
  });

  it("getUtilityPath resolves through candidate paths", async () => {
    delete process.env.BUILD_WORKSPACE_DIRECTORY;
    getServiceMocks().existsSync.mockImplementation((p: string) =>
      p.endsWith("/scripts/utilities/inference-workloads.sh")
    );
    getServiceMocks().execFileAsync.mockResolvedValue({
      stdout: JSON.stringify({ namespace: "ai-inference", jobs: [] }),
      stderr: ""
    });

    const status = await inference.getInferenceWorkloadsStatus();
    expect(status.namespace).toBe("ai-inference");
  });

  it("getInferenceWorkloadsStatus returns error when utility missing", async () => {
    getServiceMocks().existsSync.mockReturnValue(false);
    const status = await inference.getInferenceWorkloadsStatus();
    expect(status.error).toMatch(/Utility not found/);
  });

  it("getInferenceWorkloadsStatus handles exec failure", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue(new Error("status boom"));
    const status = await inference.getInferenceWorkloadsStatus();
    expect(status.error).toBe("status boom");
  });

  it("getInferenceWorkloadsStatus handles non-Error failure", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue("raw");
    const status = await inference.getInferenceWorkloadsStatus();
    expect(status.error).toBe("raw");
  });

  it("startInferenceWorkload succeeds on real path", async () => {
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: '{"ok":true}', stderr: "" });
    const result = await inference.startInferenceWorkload("kimi-test", "yes");
    expect(result.exitCode).toBe(0);
  });

  it("startInferenceWorkload handles failure without stderr", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ code: 4 });
    const result = await inference.startInferenceWorkload("kimi-test", "yes");
    expect(result.exitCode).toBe(4);
    expect(result.stderr).toBeTruthy();
  });

  it("startInferenceWorkload defaults exit code to 1 when code is missing", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ stdout: "partial", message: "failed" });
    const result = await inference.startInferenceWorkload("kimi-test", "yes");
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("partial");
  });

  it("startInferenceWorkload handles exec failure", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ stderr: "denied", code: 3 });
    const result = await inference.startInferenceWorkload("kimi-test", "yes");
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toBe("denied");
  });

  it("stopInferenceWorkload succeeds on real path", async () => {
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: '{"ok":true}', stderr: "" });
    const result = await inference.stopInferenceWorkload("all");
    expect(result.exitCode).toBe(0);
  });

  it("stopInferenceWorkload handles exec failure", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue("stop raw");
    const result = await inference.stopInferenceWorkload("kimi-test");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("stop raw");
  });
});
