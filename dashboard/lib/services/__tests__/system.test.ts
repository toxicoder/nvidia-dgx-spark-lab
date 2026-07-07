import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getServiceMocks, resetRealPathEnv } from "./real-path-mocks";
import * as system from "../system";

describe("system service (mock)", () => {
  beforeEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("returns mocked identity/services/packages", async () => {
    const id = await system.getMachineIdentity();
    const svcs = await system.getRunningServices();
    const pkgs = await system.getPackages();
    expect(id.hostname).toBe("spark0");
    expect(id.nvidia).toContain("mock");
    expect(svcs.services.every((s) => s.includes("(mock)"))).toBe(true);
    expect(pkgs.packages.every((p) => p.includes("(mock)"))).toBe(true);
  });
});

describe("system service (real path)", () => {
  beforeEach(() => {
    resetRealPathEnv();
  });

  afterEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("getMachineIdentity returns hostname and nvidia info", async () => {
    getServiceMocks()
      .execAsync.mockResolvedValueOnce({ stdout: "spark-node\n", stderr: "" })
      .mockResolvedValueOnce({ stdout: "H100, 550.54\n", stderr: "" });

    const id = await system.getMachineIdentity();
    expect(id.hostname).toBe("spark-node");
    expect(id.nvidia).toBe("H100, 550.54");
  });

  it("getMachineIdentity handles nvidia-smi failure", async () => {
    getServiceMocks()
      .execAsync.mockResolvedValueOnce({ stdout: "spark-node\n", stderr: "" })
      .mockRejectedValueOnce(new Error("nvidia-smi missing"));

    const id = await system.getMachineIdentity();
    expect(id.hostname).toBe("spark-node");
    expect(id.nvidia).toBe("nvidia-smi unavailable");
  });

  it("getRunningServices parses systemctl output", async () => {
    getServiceMocks().execAsync.mockResolvedValue({ stdout: "docker.service\nssh.service\n", stderr: "" });
    const svcs = await system.getRunningServices();
    expect(svcs.services).toEqual(["docker.service", "ssh.service"]);
  });

  it("getRunningServices returns fallback on failure", async () => {
    getServiceMocks().execAsync.mockRejectedValue(new Error("systemctl missing"));
    const svcs = await system.getRunningServices();
    expect(svcs.services).toEqual(["systemctl unavailable"]);
  });

  it("getPackages parses dpkg output", async () => {
    getServiceMocks().execAsync.mockResolvedValue({ stdout: "curl\nvim\n", stderr: "" });
    const pkgs = await system.getPackages(10);
    expect(pkgs.packages).toEqual(["curl", "vim"]);
  });

  it("getPackages returns empty list on failure", async () => {
    getServiceMocks().execAsync.mockRejectedValue(new Error("dpkg missing"));
    const pkgs = await system.getPackages();
    expect(pkgs.packages).toEqual([]);
  });
});
