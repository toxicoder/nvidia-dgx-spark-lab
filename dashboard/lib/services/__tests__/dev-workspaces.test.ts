import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getServiceMocks, mockUtilityExists, resetRealPathEnv } from "./real-path-mocks";
import * as workspaces from "../dev-workspaces";

describe("dev-workspaces service (mock)", () => {
  beforeEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("getDevWorkspacesStatus returns workspace list", async () => {
    const status = await workspaces.getDevWorkspacesStatus();
    expect(status.coder.name).toBe("coder");
    expect(status.kasm.name).toBe("kasm");
  });

  it("start and stop workspace under mock", async () => {
    const start = await workspaces.startDevWorkspace("coder");
    expect(start.exitCode).toBe(0);
    const stop = await workspaces.stopDevWorkspace("coder");
    expect(stop.exitCode).toBe(0);
  });
});

describe("dev-workspaces service (real path)", () => {
  beforeEach(() => {
    resetRealPathEnv();
    mockUtilityExists("dev-workspaces.sh");
  });

  afterEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("getDevWorkspacesStatus parses utility JSON and applies URL overrides", async () => {
    process.env.NEXT_PUBLIC_CODER_URL = "http://coder.example";
    process.env.NEXT_PUBLIC_KASM_URL = "http://kasm.example";
    const payload = {
      coder: {
        name: "coder",
        state: "running",
        readyPods: 1,
        totalPods: 1,
        url: "http://ignored",
        helmInstalled: true
      },
      kasm: {
        name: "kasm",
        state: "stopped",
        readyPods: 0,
        totalPods: 0,
        url: "http://ignored",
        helmInstalled: false
      }
    };
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: JSON.stringify(payload), stderr: "" });

    const status = await workspaces.getDevWorkspacesStatus();
    expect(status.coder.url).toBe("http://coder.example");
    expect(status.kasm.url).toBe("http://kasm.example");
  });

  it("getUtilityPath resolves through candidate paths", async () => {
    delete process.env.BUILD_WORKSPACE_DIRECTORY;
    getServiceMocks().existsSync.mockImplementation((p: string) => p.endsWith("/scripts/utilities/dev-workspaces.sh"));
    getServiceMocks().execFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        coder: {
          name: "coder",
          state: "stopped",
          readyPods: 0,
          totalPods: 0,
          url: "http://ignored",
          helmInstalled: false
        },
        kasm: {
          name: "kasm",
          state: "stopped",
          readyPods: 0,
          totalPods: 0,
          url: "http://ignored",
          helmInstalled: false
        }
      }),
      stderr: ""
    });

    const status = await workspaces.getDevWorkspacesStatus();
    expect(status.coder.name).toBe("coder");
  });

  it("getDevWorkspacesStatus prefers BUILD_WORKSPACE_DIRECTORY utility path", async () => {
    process.env.BUILD_WORKSPACE_DIRECTORY = "/workspace";
    getServiceMocks().existsSync.mockImplementation(
      (p: string) => p === "/workspace/scripts/utilities/dev-workspaces.sh"
    );
    getServiceMocks().execFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        coder: {
          name: "coder",
          state: "stopped",
          readyPods: 0,
          totalPods: 0,
          url: "http://ignored",
          helmInstalled: false
        },
        kasm: {
          name: "kasm",
          state: "stopped",
          readyPods: 0,
          totalPods: 0,
          url: "http://ignored",
          helmInstalled: false
        }
      }),
      stderr: ""
    });

    const status = await workspaces.getDevWorkspacesStatus();
    expect(status.coder.url).toMatch(/localhost/);
  });

  it("getDevWorkspacesStatus uses default host ports when overrides absent", async () => {
    process.env.LAB_WORKSPACE_HOST = "spark.lab";
    process.env.CODER_PORT = "4001";
    process.env.KASM_PORT = "4002";
    getServiceMocks().existsSync.mockReturnValue(false);

    const status = await workspaces.getDevWorkspacesStatus();
    expect(status.coder.url).toBe("http://spark.lab:4001");
    expect(status.kasm.url).toBe("http://spark.lab:4002");
    expect(status.error).toMatch(/Utility not found/);
  });

  it("getDevWorkspacesStatus handles exec Error", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue(new Error("status failed"));
    const status = await workspaces.getDevWorkspacesStatus();
    expect(status.error).toBe("status failed");
    expect(status.coder.state).toBe("error");
  });

  it("getDevWorkspacesStatus handles non-Error exec failure", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue("raw failure");
    const status = await workspaces.getDevWorkspacesStatus();
    expect(status.error).toBe("raw failure");
  });

  it("startDevWorkspace succeeds on real path", async () => {
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: '{"ok":true}', stderr: "", exitCode: 0 });
    const result = await workspaces.startDevWorkspace("coder");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ok");
  });

  it("startDevWorkspace handles exec failure", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({
      stdout: "out",
      stderr: "err",
      code: 2,
      message: "failed"
    });
    const result = await workspaces.startDevWorkspace("kasm");
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe("err");
  });

  it("startDevWorkspace handles failure without stderr/code", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ message: "only message" });
    const result = await workspaces.startDevWorkspace("coder");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("only message");
  });

  it("startDevWorkspace stringifies non-object exec failures", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue("plain failure");
    const result = await workspaces.startDevWorkspace("coder");
    expect(result.stderr).toBe("plain failure");
    expect(result.exitCode).toBe(1);
  });

  it("startDevWorkspace prefers stderr over message when both exist", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({
      stdout: "stdout",
      stderr: "stderr-msg",
      message: "message",
      code: 2
    });
    const result = await workspaces.startDevWorkspace("coder");
    expect(result.stderr).toBe("stderr-msg");
    expect(result.stdout).toBe("stdout");
  });

  it("startDevWorkspace preserves stdout when stderr is absent", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ stdout: "stdout only", message: "failed" });
    const result = await workspaces.startDevWorkspace("coder");
    expect(result.stdout).toBe("stdout only");
    expect(result.stderr).toBe("failed");
  });

  it("stopDevWorkspace succeeds on real path", async () => {
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: '{"ok":true}', stderr: "" });
    const result = await workspaces.stopDevWorkspace("kasm");
    expect(result.exitCode).toBe(0);
  });

  it("stopDevWorkspace handles exec failure", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue("stop failed");
    const result = await workspaces.stopDevWorkspace("coder");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("stop failed");
  });
});
