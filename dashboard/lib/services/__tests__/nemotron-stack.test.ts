import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getServiceMocks, mockUtilityExists, resetRealPathEnv } from "./real-path-mocks";
import * as nemotron from "../nemotron-stack";

describe("nemotron-stack service (mock)", () => {
  beforeEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("getNemotronCatalog returns models", async () => {
    const catalog = await nemotron.getNemotronCatalog();
    expect(Object.keys(catalog.models).length).toBeGreaterThan(0);
  });

  it("getNemotronStackStatus returns stack health", async () => {
    const status = await nemotron.getNemotronStackStatus();
    expect(status.stacks).toBeDefined();
  });

  it("start and stop stack under mock", async () => {
    await nemotron.startNemotronStack("nemotron-agentic-spark-1", "yes");
    await nemotron.stopNemotronStack("all");
  });
});

describe("nemotron-stack service (real path)", () => {
  beforeEach(() => {
    resetRealPathEnv();
    mockUtilityExists("nemotron-stack.sh");
  });

  afterEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("getNemotronCatalog parses catalog JSON", async () => {
    const payload = { models: { "nemotron-3-ultra": { display_name: "Ultra", family: "llm" } } };
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: JSON.stringify(payload), stderr: "" });

    const catalog = await nemotron.getNemotronCatalog();
    expect(catalog.models["nemotron-3-ultra"].display_name).toBe("Ultra");
  });

  it("getNemotronCatalog throws when utility exits non-zero", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ stdout: "catalog failed", stderr: "err", code: 2 });
    await expect(nemotron.getNemotronCatalog()).rejects.toThrow(/catalog failed/);
  });

  it("getNemotronStackStatus parses status JSON", async () => {
    const payload = {
      stacks: [
        {
          id: "nemotron-agentic-spark-1",
          label: "Agentic Spark",
          healthy: true,
          components: [{ name: "api", model: "nemotron", state: "running" }]
        }
      ]
    };
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: JSON.stringify(payload), stderr: "" });

    const status = await nemotron.getNemotronStackStatus();
    expect(status.stacks[0].healthy).toBe(true);
  });

  it("getNemotronStackStatus throws when utility exits non-zero", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ stdout: "", stderr: "status err", code: 1 });
    await expect(nemotron.getNemotronStackStatus()).rejects.toThrow(/status failed/);
  });

  it("runNemotronStack returns success stdout", async () => {
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: "ok", stderr: "" });
    const result = await nemotron.startNemotronStack("nemotron-agentic-spark-1", "yes");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("ok");
  });

  it("runNemotronStack maps exec errors with stdout/stderr/code", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ stdout: "partial", stderr: "stderr", code: 5 });
    const result = await nemotron.stopNemotronStack("all");
    expect(result.exitCode).toBe(5);
    expect(result.stdout).toBe("partial");
    expect(result.stderr).toBe("stderr");
  });

  it("runNemotronStack maps non-object errors", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue("plain error");
    const result = await nemotron.stopNemotronStack("nemotron-agentic-spark-1");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("plain error");
  });

  it("resolveNemotronStackScript skips missing BUILD_WORKSPACE_DIRECTORY path", async () => {
    process.env.BUILD_WORKSPACE_DIRECTORY = "/workspace";
    getServiceMocks().existsSync.mockImplementation(
      (p: string) => p.endsWith("/scripts/utilities/nemotron-stack.sh") && !p.startsWith("/workspace")
    );
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: '{"stacks":[]}', stderr: "" });

    await nemotron.getNemotronStackStatus();
    expect(getServiceMocks().execFileAsync).toHaveBeenCalled();
    expect(getServiceMocks().execFileAsync.mock.calls[0][0]).not.toBe("/workspace/scripts/utilities/nemotron-stack.sh");
  });

  it("resolveNemotronStackScript prefers BUILD_WORKSPACE_DIRECTORY", async () => {
    process.env.BUILD_WORKSPACE_DIRECTORY = "/workspace";
    getServiceMocks().existsSync.mockImplementation(
      (p: string) => p === "/workspace/scripts/utilities/nemotron-stack.sh"
    );
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: '{"stacks":[]}', stderr: "" });

    await nemotron.getNemotronStackStatus();
    expect(getServiceMocks().execFileAsync).toHaveBeenCalledWith(
      "/workspace/scripts/utilities/nemotron-stack.sh",
      ["status", "--json"],
      expect.any(Object)
    );
  });

  it("getNemotronCatalog throws default message when stdout is empty", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ stdout: "", stderr: "catalog err", code: 1 });
    await expect(nemotron.getNemotronCatalog()).rejects.toThrow(/nemotron-stack catalog failed/);
  });

  it("resolveNemotronStackScript falls back through candidates", async () => {
    delete process.env.BUILD_WORKSPACE_DIRECTORY;
    getServiceMocks().existsSync.mockImplementation((p: string) => p.endsWith("/scripts/utilities/nemotron-stack.sh"));
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: '{"stacks":[]}', stderr: "" });

    await nemotron.getNemotronStackStatus();
    expect(getServiceMocks().existsSync).toHaveBeenCalled();
  });
});
