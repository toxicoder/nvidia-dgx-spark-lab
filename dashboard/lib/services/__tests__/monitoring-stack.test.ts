import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getServiceMocks, mockUtilityExists, resetRealPathEnv } from "./real-path-mocks";
import * as monitoring from "../monitoring-stack";

describe("monitoring-stack service (mock)", () => {
  beforeEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("getMonitoringStackStatus returns grafana and dashboards", async () => {
    const status = await monitoring.getMonitoringStackStatus();
    expect(status.grafana.state).toBe("running");
    expect(status.dashboards.length).toBeGreaterThan(0);
  });
});

describe("monitoring-stack service (real path)", () => {
  beforeEach(() => {
    resetRealPathEnv();
    mockUtilityExists("monitoring-stack.sh");
  });

  afterEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("getMonitoringStackStatus parses status JSON", async () => {
    const payload = {
      grafana: { name: "grafana", state: "running", readyPods: 1, totalPods: 1, helmInstalled: true, urls: {} },
      headlamp: { name: "headlamp", state: "stopped", readyPods: 0, totalPods: 1, helmInstalled: true, urls: {} },
      prometheus: { name: "prometheus", state: "running", readyPods: 1, totalPods: 1, helmInstalled: true },
      nodeExporter: { name: "node-exporter", state: "running", readyPods: 2, totalPods: 2, helmInstalled: true },
      kubeStateMetrics: {
        name: "kube-state-metrics",
        state: "running",
        readyPods: 1,
        totalPods: 1,
        helmInstalled: true
      },
      blackboxExporter: {
        name: "blackbox-exporter",
        state: "running",
        readyPods: 1,
        totalPods: 1,
        helmInstalled: true
      },
      dcgmExporter: { name: "dcgm-exporter", state: "running", readyPods: 2, totalPods: 2, helmInstalled: true },
      dashboards: [{ uid: "spark-overview", title: "Lab Overview", url: "https://g", nodeportUrl: "http://g" }]
    };
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: JSON.stringify(payload), stderr: "" });

    const status = await monitoring.getMonitoringStackStatus();
    expect(status.grafana.state).toBe("running");
    expect(status.dashboards[0].uid).toBe("spark-overview");
  });

  it("getMonitoringStackStatus throws when utility exits non-zero", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ stdout: "status failed", stderr: "err", code: 2 });
    await expect(monitoring.getMonitoringStackStatus()).rejects.toThrow(/status failed/);
  });

  it("resolveMonitoringStackScript skips missing workspace utility path", async () => {
    process.env.BUILD_WORKSPACE_DIRECTORY = "/workspace";
    getServiceMocks().existsSync.mockReturnValue(false);
    getServiceMocks().execFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        grafana: { name: "grafana", state: "stopped", readyPods: 0, totalPods: 0, helmInstalled: false, urls: {} },
        headlamp: { name: "headlamp", state: "stopped", readyPods: 0, totalPods: 0, helmInstalled: false, urls: {} },
        prometheus: { name: "prometheus", state: "stopped", readyPods: 0, totalPods: 0, helmInstalled: false },
        nodeExporter: { name: "node-exporter", state: "stopped", readyPods: 0, totalPods: 0, helmInstalled: false },
        kubeStateMetrics: {
          name: "kube-state-metrics",
          state: "stopped",
          readyPods: 0,
          totalPods: 0,
          helmInstalled: false
        },
        blackboxExporter: {
          name: "blackbox-exporter",
          state: "stopped",
          readyPods: 0,
          totalPods: 0,
          helmInstalled: false
        },
        dcgmExporter: { name: "dcgm-exporter", state: "stopped", readyPods: 0, totalPods: 0, helmInstalled: false },
        dashboards: []
      }),
      stderr: ""
    });

    const status = await monitoring.getMonitoringStackStatus();
    expect(status.dashboards).toEqual([]);
  });

  it("resolveMonitoringStackScript uses BUILD_WORKSPACE_DIRECTORY when present", async () => {
    mockUtilityExists("monitoring-stack.sh", "/workspace");
    getServiceMocks().execFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        grafana: { name: "grafana", state: "running", readyPods: 1, totalPods: 1, helmInstalled: true, urls: {} },
        headlamp: { name: "headlamp", state: "stopped", readyPods: 0, totalPods: 0, helmInstalled: false, urls: {} },
        prometheus: { name: "prometheus", state: "running", readyPods: 1, totalPods: 1, helmInstalled: true },
        nodeExporter: { name: "node-exporter", state: "running", readyPods: 2, totalPods: 2, helmInstalled: true },
        kubeStateMetrics: {
          name: "kube-state-metrics",
          state: "running",
          readyPods: 1,
          totalPods: 1,
          helmInstalled: true
        },
        blackboxExporter: {
          name: "blackbox-exporter",
          state: "running",
          readyPods: 1,
          totalPods: 1,
          helmInstalled: true
        },
        dcgmExporter: { name: "dcgm-exporter", state: "running", readyPods: 2, totalPods: 2, helmInstalled: true },
        dashboards: []
      }),
      stderr: ""
    });

    const status = await monitoring.getMonitoringStackStatus();
    expect(status.grafana.state).toBe("running");
    expect(getServiceMocks().execFileAsync).toHaveBeenCalled();
  });

  it("runMonitoringStack maps exec errors without numeric code", async () => {
    mockUtilityExists("monitoring-stack.sh");
    getServiceMocks().execFileAsync.mockRejectedValue(new Error("spawn ENOENT"));
    await expect(monitoring.getMonitoringStackStatus()).rejects.toThrow();
  });

  it("resolveMonitoringStackScript uses container candidate path", async () => {
    delete process.env.BUILD_WORKSPACE_DIRECTORY;
    getServiceMocks().existsSync.mockImplementation((p: string) =>
      String(p).endsWith("/app/scripts/utilities/monitoring-stack.sh")
    );
    getServiceMocks().execFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        grafana: { name: "grafana", state: "stopped", readyPods: 0, totalPods: 0, helmInstalled: false, urls: {} },
        headlamp: { name: "headlamp", state: "stopped", readyPods: 0, totalPods: 0, helmInstalled: false, urls: {} },
        prometheus: { name: "prometheus", state: "stopped", readyPods: 0, totalPods: 0, helmInstalled: false },
        nodeExporter: { name: "node-exporter", state: "stopped", readyPods: 0, totalPods: 0, helmInstalled: false },
        kubeStateMetrics: {
          name: "kube-state-metrics",
          state: "stopped",
          readyPods: 0,
          totalPods: 0,
          helmInstalled: false
        },
        blackboxExporter: {
          name: "blackbox-exporter",
          state: "stopped",
          readyPods: 0,
          totalPods: 0,
          helmInstalled: false
        },
        dcgmExporter: { name: "dcgm-exporter", state: "stopped", readyPods: 0, totalPods: 0, helmInstalled: false },
        dashboards: []
      }),
      stderr: ""
    });

    const status = await monitoring.getMonitoringStackStatus();
    expect(status.grafana.state).toBe("stopped");
  });

  it("resolveMonitoringStackScript falls back when workspace path missing", async () => {
    delete process.env.BUILD_WORKSPACE_DIRECTORY;
    getServiceMocks().existsSync.mockReturnValue(false);
    getServiceMocks().execFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        grafana: { name: "grafana", state: "stopped", readyPods: 0, totalPods: 0, helmInstalled: false, urls: {} },
        headlamp: { name: "headlamp", state: "stopped", readyPods: 0, totalPods: 0, helmInstalled: false, urls: {} },
        prometheus: { name: "prometheus", state: "stopped", readyPods: 0, totalPods: 0, helmInstalled: false },
        nodeExporter: { name: "node-exporter", state: "stopped", readyPods: 0, totalPods: 0, helmInstalled: false },
        kubeStateMetrics: {
          name: "kube-state-metrics",
          state: "stopped",
          readyPods: 0,
          totalPods: 0,
          helmInstalled: false
        },
        blackboxExporter: {
          name: "blackbox-exporter",
          state: "stopped",
          readyPods: 0,
          totalPods: 0,
          helmInstalled: false
        },
        dcgmExporter: { name: "dcgm-exporter", state: "stopped", readyPods: 0, totalPods: 0, helmInstalled: false },
        dashboards: []
      }),
      stderr: ""
    });

    const status = await monitoring.getMonitoringStackStatus();
    expect(status.dashboards).toEqual([]);
  });
});
