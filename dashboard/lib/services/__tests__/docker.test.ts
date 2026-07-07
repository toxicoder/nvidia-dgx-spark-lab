import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getServiceMocks, resetRealPathEnv } from "./real-path-mocks";
import * as docker from "../docker";

describe("docker service (mock)", () => {
  beforeEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("listContainers returns mock containers", async () => {
    const result = await docker.listContainers();
    expect(Array.isArray(result)).toBe(true);
    expect((result as { ID: string }[])[0]).toHaveProperty("ID");
  });

  it("stopContainer accepts common container id/name formats", async () => {
    await expect(docker.stopContainer("abc123")).resolves.toEqual({ stopped: "abc123" });
    await expect(docker.stopContainer("my_container-1")).resolves.toEqual({
      stopped: "my_container-1"
    });
  });
});

describe("docker service (real path)", () => {
  beforeEach(() => {
    resetRealPathEnv();
  });

  afterEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("listContainers parses docker ps JSON lines", async () => {
    const line1 = JSON.stringify({ ID: "abc", Names: "kimi", Status: "Up", Image: "vllm" });
    const line2 = JSON.stringify({ ID: "def", Names: "storage", Status: "Up", Image: "minio" });
    getServiceMocks().execAsync.mockResolvedValue({ stdout: `${line1}\n${line2}\n`, stderr: "" });

    const result = await docker.listContainers();
    expect(result).toHaveLength(2);
    expect((result as { ID: string }[])[0].ID).toBe("abc");
  });

  it("listContainers returns error shape when docker unavailable", async () => {
    getServiceMocks().execAsync.mockRejectedValue(new Error("permission denied"));
    const result = await docker.listContainers();
    expect(result).toEqual({ error: "docker not available or permission denied" });
  });

  it("stopContainer invokes docker stop on real path", async () => {
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: "abc123", stderr: "" });
    const result = await docker.stopContainer("abc123");
    expect(result).toEqual({ stopped: "abc123" });
    expect(getServiceMocks().execFileAsync).toHaveBeenCalledWith("docker", ["stop", "abc123"], expect.any(Object));
  });

  it("stopContainer rejects invalid ids (no shell injection possible)", async () => {
    await expect(docker.stopContainer("")).rejects.toThrow(/invalid/);
    await expect(docker.stopContainer("id with spaces")).rejects.toThrow(/invalid/);
    await expect(docker.stopContainer("bad;id")).rejects.toThrow(/invalid/);
    await expect(docker.stopContainer("id`whoami`")).rejects.toThrow(/invalid/);
  });
});
