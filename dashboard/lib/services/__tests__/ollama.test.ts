import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getServiceMocks, resetRealPathEnv } from "./real-path-mocks";
import * as ollama from "../ollama";

describe("ollama service (mock)", () => {
  beforeEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("returns mock when USE_MOCKS=1", async () => {
    const res = await ollama.listOllamaModels();
    expect(res).toHaveProperty("raw");
    expect(String(res.raw)).toContain("mock");
  });
});

describe("ollama service (real path)", () => {
  beforeEach(() => {
    resetRealPathEnv();
  });

  afterEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("listOllamaModels returns trimmed stdout", async () => {
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: "  llama3\tabc\t4GB\n", stderr: "" });
    const res = await ollama.listOllamaModels();
    expect(res.raw).toBe("llama3\tabc\t4GB");
  });

  it("listOllamaModels returns unavailable when stdout empty", async () => {
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: "   ", stderr: "" });
    const res = await ollama.listOllamaModels();
    expect(res.raw).toBe("ollama unavailable");
  });

  it("listOllamaModels returns unavailable on exec failure", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue(new Error("ollama down"));
    const res = await ollama.listOllamaModels();
    expect(res.raw).toBe("ollama unavailable");
  });
});
