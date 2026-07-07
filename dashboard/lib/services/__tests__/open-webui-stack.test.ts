import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getServiceMocks, mockUtilityExists, resetRealPathEnv } from "./real-path-mocks";
import * as openWebUI from "../open-webui-stack";

describe("open-webui-stack service (mock)", () => {
  beforeEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("getOpenWebUICatalog returns stacks", async () => {
    const catalog = await openWebUI.getOpenWebUICatalog();
    expect(catalog.stacks["open-webui-lab"]).toBeDefined();
  });

  it("getOpenWebUIStatus returns release state", async () => {
    const status = await openWebUI.getOpenWebUIStatus();
    expect(status.release).toBe("open-webui");
  });

  it("start and stop under mock", async () => {
    await openWebUI.startOpenWebUI("open-webui-lab", "yes");
    await openWebUI.stopOpenWebUI();
  });
});

describe("open-webui-stack service (real path)", () => {
  beforeEach(() => {
    resetRealPathEnv();
    mockUtilityExists("open-webui-stack.sh");
  });

  afterEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("resolveOpenWebUIStackScript skips missing workspace utility path", async () => {
    process.env.BUILD_WORKSPACE_DIRECTORY = "/workspace";
    getServiceMocks().existsSync.mockReturnValue(false);
    getServiceMocks().execFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        release: "open-webui",
        namespace: "dev",
        state: "stopped",
        helm_installed: false,
        pod_ready: false,
        urls: {},
        backend: { hermes_gateway: { url: "", reachable: false, endpoint_ip: "" } },
        prerequisites: { hermes_stack: "hermes-lab" }
      }),
      stderr: ""
    });

    const status = await openWebUI.getOpenWebUIStatus();
    expect(status.state).toBe("stopped");
  });

  it("resolveOpenWebUIStackScript uses BUILD_WORKSPACE_DIRECTORY when present", async () => {
    mockUtilityExists("open-webui-stack.sh", "/workspace");
    getServiceMocks().execFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        helm: { release: "open-webui", namespace: "dev", chart: "open-webui" },
        ports: { nodeport: 32085, container: 8080, service: 80 },
        sso: { host: "chat" },
        backends: {},
        stacks: { "open-webui-lab": { label: "Chat", description: "desc", requires_hermes_stack: "hermes-lab" } }
      }),
      stderr: ""
    });

    const catalog = await openWebUI.getOpenWebUICatalog();
    expect(catalog.stacks["open-webui-lab"].label).toBe("Chat");
  });

  it("resolveOpenWebUIStackScript falls back when workspace path missing", async () => {
    delete process.env.BUILD_WORKSPACE_DIRECTORY;
    getServiceMocks().existsSync.mockReturnValue(false);
    getServiceMocks().execFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        release: "open-webui",
        namespace: "dev",
        state: "stopped",
        helm_installed: false,
        pod_ready: false,
        urls: {},
        backend: { hermes_gateway: { url: "", reachable: false, endpoint_ip: "" } },
        prerequisites: { hermes_stack: "hermes-lab" }
      }),
      stderr: ""
    });

    const status = await openWebUI.getOpenWebUIStatus();
    expect(status.state).toBe("stopped");
  });

  it("runOpenWebUIStack maps exec errors without numeric code", async () => {
    mockUtilityExists("open-webui-stack.sh");
    getServiceMocks().execFileAsync.mockRejectedValue(new Error("spawn ENOENT"));
    const result = await openWebUI.stopOpenWebUI();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("spawn ENOENT");
  });

  it("getOpenWebUICatalog parses catalog JSON", async () => {
    const payload = {
      helm: { release: "open-webui", namespace: "dev", chart: "open-webui" },
      ports: { nodeport: 32085, container: 8080, service: 80 },
      sso: { host: "chat" },
      backends: { hermes_gateway: { port: 8642, path: "/v1", requires_hermes_stack: "hermes-lab" } },
      stacks: { "open-webui-lab": { label: "Chat", description: "desc", requires_hermes_stack: "hermes-lab" } }
    };
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: JSON.stringify(payload), stderr: "" });

    const catalog = await openWebUI.getOpenWebUICatalog();
    expect(catalog.stacks["open-webui-lab"].label).toBe("Chat");
  });

  it("getOpenWebUICatalog throws when utility exits non-zero", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ stdout: "catalog failed", stderr: "err", code: 2 });
    await expect(openWebUI.getOpenWebUICatalog()).rejects.toThrow(/catalog failed/);
  });

  it("getOpenWebUICatalog throws default message when stdout empty", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ stdout: "", stderr: "err", code: 2 });
    await expect(openWebUI.getOpenWebUICatalog()).rejects.toThrow(/open-webui-stack catalog failed/);
  });

  it("resolveOpenWebUIStackScript uses container candidate path", async () => {
    delete process.env.BUILD_WORKSPACE_DIRECTORY;
    getServiceMocks().existsSync.mockImplementation((p: string) =>
      String(p).endsWith("/app/scripts/utilities/open-webui-stack.sh")
    );
    getServiceMocks().execFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        helm: { release: "open-webui", namespace: "dev", chart: "open-webui" },
        ports: { nodeport: 32085, container: 8080, service: 80 },
        sso: { host: "chat" },
        backends: {},
        stacks: {}
      }),
      stderr: ""
    });

    const catalog = await openWebUI.getOpenWebUICatalog();
    expect(catalog.helm.release).toBe("open-webui");
  });

  it("getOpenWebUIStatus parses status JSON", async () => {
    const payload = {
      release: "open-webui",
      namespace: "dev",
      state: "running",
      helm_installed: true,
      pod_ready: true,
      urls: { sso: "https://chat", nodeport: "http://localhost:32085" },
      backend: { hermes_gateway: { url: "http://gw", reachable: true, endpoint_ip: "10.0.0.1" } },
      prerequisites: { hermes_stack: "hermes-lab" }
    };
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: JSON.stringify(payload), stderr: "" });

    const status = await openWebUI.getOpenWebUIStatus();
    expect(status.state).toBe("running");
  });

  it("getOpenWebUIStatus throws when utility exits non-zero", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ stdout: "", stderr: "status err", code: 1 });
    await expect(openWebUI.getOpenWebUIStatus()).rejects.toThrow(/status failed/);
  });

  it("startOpenWebUI returns success stdout", async () => {
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: "ok", stderr: "" });
    const result = await openWebUI.startOpenWebUI("open-webui-lab", "yes");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("ok");
  });

  it("stopOpenWebUI maps exec errors with stdout/stderr/code", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ stdout: "partial", stderr: "stderr", code: 5 });
    const result = await openWebUI.stopOpenWebUI();
    expect(result.exitCode).toBe(5);
    expect(result.stdout).toBe("partial");
    expect(result.stderr).toBe("stderr");
  });
});
