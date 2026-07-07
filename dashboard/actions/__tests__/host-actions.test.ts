import { describe, it, expect, vi, beforeEach } from "vitest";

const hostMocks = vi.hoisted(() => ({
  stopContainer: vi.fn().mockResolvedValue({ stopped: "abc123" }),
  getStorageTree: vi.fn().mockResolvedValue({ name: "models", path: "/mnt/models", size: 1, isDir: true }),
  deletePath: vi.fn().mockResolvedValue({ movedToTrash: "/tmp/trash" }),
  findDuplicates: vi.fn().mockResolvedValue({ groups: [] }),
  getMachineIdentity: vi.fn().mockResolvedValue({ hostname: "spark0", nvidia: "mock" }),
  getRunningServices: vi.fn().mockResolvedValue({ services: [] }),
  getPackages: vi.fn().mockResolvedValue({ packages: [] }),
  getUtilityStatus: vi.fn().mockResolvedValue({ status: "ok" }),
  runUtility: vi.fn().mockResolvedValue({ stdout: "{}", stderr: "", exitCode: 0 }),
  getDevWorkspacesStatus: vi.fn().mockResolvedValue({ workspaces: [] }),
  startDevWorkspace: vi.fn().mockResolvedValue({ ok: true }),
  stopDevWorkspace: vi.fn().mockResolvedValue({ ok: true }),
  getClusterCapacity: vi.fn().mockResolvedValue({ nodes: [] }),
  checkCapacity: vi.fn().mockResolvedValue({ allowed: true }),
  suggestFreeResources: vi.fn().mockResolvedValue({ suggestions: [] }),
  getInferenceWorkloadsStatus: vi.fn().mockResolvedValue({ jobs: [] }),
  startInferenceWorkload: vi.fn().mockResolvedValue({ ok: true }),
  stopInferenceWorkload: vi.fn().mockResolvedValue({ ok: true }),
  getNemotronCatalog: vi.fn().mockResolvedValue({ models: [] }),
  getNemotronStackStatus: vi.fn().mockResolvedValue({ stacks: [] }),
  startNemotronStack: vi.fn().mockResolvedValue({ ok: true }),
  stopNemotronStack: vi.fn().mockResolvedValue({ ok: true }),
  getOpenWebUIStatus: vi.fn().mockResolvedValue({ release: "open-webui", state: "stopped" }),
  startOpenWebUI: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" }),
  stopOpenWebUI: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" }),
  getMonitoringStackStatus: vi.fn().mockResolvedValue({ grafana: { state: "running" }, dashboards: [] })
}));

vi.mock("@/lib/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue(undefined),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message = "Unauthorized") {
      super(message);
      this.name = "UnauthorizedError";
    }
  }
}));

vi.mock("@/lib/host", () => hostMocks);

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

import {
  stopContainerAction,
  deletePathAction,
  getUtilityStatusAction,
  getStorageTreeAction,
  getMachineStateAction,
  findDuplicatesAction,
  runUtilityAction,
  getDevWorkspacesStatusAction,
  startDevWorkspaceAction,
  stopDevWorkspaceAction,
  getClusterCapacityAction,
  checkCapacityAction,
  suggestFreeResourcesAction,
  getInferenceWorkloadsAction,
  startInferenceWorkloadAction,
  stopInferenceWorkloadAction,
  getNemotronCatalogAction,
  getNemotronStackStatusAction,
  startNemotronStackAction,
  stopNemotronStackAction,
  getOpenWebUIStatusAction,
  startOpenWebUIAction,
  stopOpenWebUIAction,
  getMonitoringStackStatusAction
} from "../host-actions";
import { requireSession } from "@/lib/require-session";
import { UnauthorizedError } from "@/lib/require-session";
import { revalidatePath } from "next/cache";

describe("host-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(undefined);
  });

  it("stopContainerAction validates container id", async () => {
    await expect(stopContainerAction("bad;id")).rejects.toThrow();
  });

  it("stopContainerAction succeeds for valid id", async () => {
    const result = await stopContainerAction("abc123");
    expect(result).toEqual({ stopped: "abc123" });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("deletePathAction rejects disallowed paths", async () => {
    const fd = new FormData();
    fd.append("path", "/etc/passwd");
    await expect(deletePathAction(fd)).rejects.toThrow();
  });

  it("deletePathAction succeeds for allowed path", async () => {
    const fd = new FormData();
    fd.append("path", "/mnt/models/tmp.bin");
    const result = await deletePathAction(fd);
    expect(result).toEqual({ movedToTrash: "/tmp/trash" });
    expect(hostMocks.deletePath).toHaveBeenCalledWith("/mnt/models/tmp.bin");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("getUtilityStatusAction returns status for valid utility", async () => {
    const result = await getUtilityStatusAction("spark-clock");
    expect(result).toEqual({ status: "ok" });
    expect(hostMocks.getUtilityStatus).toHaveBeenCalledWith("spark-clock");
  });

  it("getDevWorkspacesStatusAction returns workspace status", async () => {
    const result = await getDevWorkspacesStatusAction();
    expect(result).toEqual({ workspaces: [] });
    expect(hostMocks.getDevWorkspacesStatus).toHaveBeenCalled();
  });

  it("getUtilityStatusAction rejects unknown utilities", async () => {
    await expect(getUtilityStatusAction("evil-script")).rejects.toThrow();
  });

  it("propagates unauthorized when session missing", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthorizedError());
    await expect(stopContainerAction("abc123")).rejects.toThrow(/Unauthorized/);
  });

  it("getStorageTreeAction uses default path", async () => {
    await getStorageTreeAction({});
    expect(hostMocks.getStorageTree).toHaveBeenCalledWith("/mnt/models");
  });

  it("getMachineStateAction aggregates identity and inventory", async () => {
    const result = await getMachineStateAction();
    expect(result.identity.hostname).toBe("spark0");
    expect(result.services).toBeDefined();
    expect(result.packages).toBeDefined();
  });

  it("findDuplicatesAction defaults to /mnt/models", async () => {
    await findDuplicatesAction();
    expect(hostMocks.findDuplicates).toHaveBeenCalledWith("/mnt/models");
  });

  it("findDuplicatesAction accepts explicit path", async () => {
    await findDuplicatesAction("/mnt/models/subdir");
    expect(hostMocks.findDuplicates).toHaveBeenCalledWith("/mnt/models/subdir");
  });

  it("runUtilityAction runs without subcommand", async () => {
    await runUtilityAction("spark-clock");
    expect(hostMocks.runUtility).toHaveBeenCalledWith("spark-clock", []);
  });

  it("startInferenceWorkloadAction works without confirm", async () => {
    await startInferenceWorkloadAction("kimi-test");
    expect(hostMocks.startInferenceWorkload).toHaveBeenCalledWith("kimi-test", "");
  });

  it("startNemotronStackAction works without confirm", async () => {
    await startNemotronStackAction("nemotron-agentic-spark-1");
    expect(hostMocks.startNemotronStack).toHaveBeenCalledWith("nemotron-agentic-spark-1", "");
  });

  it("runUtilityAction passes subcommand args", async () => {
    await runUtilityAction("spark-clock", "status");
    expect(hostMocks.runUtility).toHaveBeenCalledWith("spark-clock", ["status"]);
  });

  it("dev workspace actions validate names", async () => {
    await expect(startDevWorkspaceAction("invalid")).rejects.toThrow();
    await startDevWorkspaceAction("coder");
    expect(hostMocks.startDevWorkspace).toHaveBeenCalledWith("coder");
    await stopDevWorkspaceAction("kasm");
    expect(hostMocks.stopDevWorkspace).toHaveBeenCalledWith("kasm");
  });

  it("capacity actions validate action ids", async () => {
    await getClusterCapacityAction();
    await checkCapacityAction("model:kimi-test");
    await suggestFreeResourcesAction("model:kimi");
    expect(hostMocks.checkCapacity).toHaveBeenCalledWith("model:kimi-test");
  });

  it("inference actions handle model start/stop", async () => {
    await getInferenceWorkloadsAction();
    await startInferenceWorkloadAction("kimi-test", "yes");
    expect(hostMocks.startInferenceWorkload).toHaveBeenCalledWith("kimi-test", "yes");
    await stopInferenceWorkloadAction("all");
    await stopInferenceWorkloadAction("kimi-test");
  });

  it("rejects invalid heavy confirm", async () => {
    await expect(startInferenceWorkloadAction("kimi", "nope")).rejects.toThrow();
  });

  it("nemotron stack actions handle lifecycle", async () => {
    await getNemotronCatalogAction();
    await getNemotronStackStatusAction();
    await startNemotronStackAction("nemotron-agentic-spark-1", "yes");
    await stopNemotronStackAction("all");
    await stopNemotronStackAction("nemotron-agentic-spark-1");
  });

  it("rejects invalid nemotron confirm", async () => {
    await expect(startNemotronStackAction("nemotron-agentic-spark-1", "bad")).rejects.toThrow();
  });

  it("open webui actions delegate to host services", async () => {
    await getOpenWebUIStatusAction();
    expect(hostMocks.getOpenWebUIStatus).toHaveBeenCalled();
    await startOpenWebUIAction("open-webui-lab", "yes");
    expect(hostMocks.startOpenWebUI).toHaveBeenCalledWith("open-webui-lab", "yes");
    await startOpenWebUIAction("open-webui-lab");
    expect(hostMocks.startOpenWebUI).toHaveBeenCalledWith("open-webui-lab", "");
    await stopOpenWebUIAction();
    expect(hostMocks.stopOpenWebUI).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("getMonitoringStackStatusAction delegates to host", async () => {
    await getMonitoringStackStatusAction();
    expect(hostMocks.getMonitoringStackStatus).toHaveBeenCalled();
  });

  it("rejects invalid open webui stack id", async () => {
    await expect(startOpenWebUIAction("not-a-stack", "yes")).rejects.toThrow();
  });
});
