/**
 * Loader contract tests for the ten `components/sections/<slug>/index.tsx` modules.
 *
 * The unit under test is the data loader, not the panels: every panel and
 * `SectionFailure` is mocked to a marker element that records the props the loader
 * forwarded. That keeps these tests independent of panel internals (which other
 * work is rewriting) and keeps the coverage gate pointed only at the contract in
 * `components/sections/README.md`: read host state through `attempt()`, hand it to
 * the panel, or degrade to `SectionFailure` with the section's own headline.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  fakeClusterCapacity,
  fakeContainers,
  fakeDevWorkspacesStatus,
  fakeInferenceWorkloadsStatus,
  fakeMachineIdentity,
  fakeMonitoringStackStatus,
  fakeNemotronCatalog,
  fakeNemotronStackStatus,
  fakeOllama,
  fakeOpenWebUIStatus,
  fakePackages,
  fakeSecrets,
  fakeServices,
  fakeTree
} from "@/lib/mocks/fixtures";
import type {
  ClusterCapacity,
  DevWorkspacesStatus,
  DockerListResult,
  InferenceWorkloadsStatus,
  LabSecretMeta,
  MachineIdentity,
  MonitoringStackStatus,
  NemotronCatalog,
  NemotronStackStatus,
  OllamaModelsResult,
  OpenWebUIStatus,
  PackageList,
  RunningServices,
  TreeNode
} from "@/lib/types";

import AgentChatSection from "@/components/sections/agent-chat";
import InferenceSection from "@/components/sections/inference";
import ObservabilitySection from "@/components/sections/observability";
import ResourcesSection from "@/components/sections/resources";
import SecretsSection from "@/components/sections/secrets";
import StorageSection from "@/components/sections/storage";
import SystemSection from "@/components/sections/system";
import TasksSection from "@/components/sections/tasks";
import UtilitiesSection from "@/components/sections/utilities";
import WorkspacesSection from "@/components/sections/workspaces";

/**
 * Everything the section modules touch, hoisted so the `vi.mock` factories below
 * can close over it while still running during this file's import phase.
 */
const { panelMarker, host } = vi.hoisted(() => ({
  /** Mock panel factory: render a marker that records the forwarded props. */
  panelMarker: (testId: string) =>
    function PanelMarker(props: Record<string, unknown>) {
      return <div data-testid={testId} data-props={JSON.stringify(props)} />;
    },
  host: {
    getClusterCapacity: vi.fn<() => Promise<ClusterCapacity>>(),
    getMonitoringStackStatus: vi.fn<() => Promise<MonitoringStackStatus>>(),
    getInferenceWorkloadsStatus: vi.fn<() => Promise<InferenceWorkloadsStatus>>(),
    getNemotronCatalog: vi.fn<() => Promise<NemotronCatalog>>(),
    getNemotronStackStatus: vi.fn<() => Promise<NemotronStackStatus>>(),
    getOpenWebUIStatus: vi.fn<() => Promise<OpenWebUIStatus>>(),
    getStorageTree: vi.fn<(targetPath?: string, maxDepth?: number) => Promise<TreeNode>>(),
    listContainers: vi.fn<() => Promise<DockerListResult>>(),
    listOllamaModels: vi.fn<() => Promise<OllamaModelsResult>>(),
    getDevWorkspacesStatus: vi.fn<() => Promise<DevWorkspacesStatus>>(),
    getMachineIdentity: vi.fn<() => Promise<MachineIdentity>>(),
    getRunningServices: vi.fn<() => Promise<RunningServices>>(),
    getPackages: vi.fn<(limit?: number) => Promise<PackageList>>(),
    listSecrets: vi.fn<() => Promise<LabSecretMeta[]>>()
  }
}));

vi.mock("@/lib/host", () => host);

vi.mock("@/components/ResourcesPanel", () => ({ ResourcesPanel: panelMarker("panel-resources") }));
vi.mock("@/components/ObservabilityPanel", () => ({ ObservabilityPanel: panelMarker("panel-observability") }));
vi.mock("@/components/InferencePanel", () => ({ InferencePanel: panelMarker("panel-inference") }));
vi.mock("@/components/NemotronStackPanel", () => ({ NemotronStackPanel: panelMarker("panel-nemotron") }));
vi.mock("@/components/OpenWebUIPanel", () => ({ OpenWebUIPanel: panelMarker("panel-agent-chat") }));
vi.mock("@/components/StoragePanel", () => ({ StoragePanel: panelMarker("panel-storage") }));
vi.mock("@/components/TasksPanel", () => ({ TasksPanel: panelMarker("panel-tasks") }));
vi.mock("@/components/WorkspacesPanel", () => ({ WorkspacesPanel: panelMarker("panel-workspaces") }));
vi.mock("@/components/MachineStatePanel", () => ({ MachineStatePanel: panelMarker("panel-machine-state") }));
vi.mock("@/components/UtilitiesPanel", () => ({ UtilitiesPanel: panelMarker("panel-utilities") }));
vi.mock("@/components/SecretsPanel", () => ({ SecretsPanel: panelMarker("panel-secrets") }));
vi.mock("@/components/SectionFailure", () => ({
  SectionFailure: function SectionFailureMarker({ title, message }: { title: string; message: string }) {
    return <div data-testid="section-failure" data-title={title} data-message={message} />;
  }
}));

/** Props the loader forwarded to one mocked panel, decoded from its marker. */
function forwardedProps(testId: string): Record<string, unknown> {
  const raw = screen.getByTestId(testId).getAttribute("data-props");
  return raw === null ? {} : (JSON.parse(raw) as Record<string, unknown>);
}

/** Headlines of every `SectionFailure` the loader rendered, in document order. */
function failureTitles(): string[] {
  return screen.queryAllByTestId("section-failure").map((node) => node.getAttribute("data-title") ?? "");
}

/** The message shown under one `SectionFailure` headline. */
function failureMessage(title: string): string | undefined {
  return (
    screen
      .getAllByTestId("section-failure")
      .find((node) => node.getAttribute("data-title") === title)
      ?.getAttribute("data-message") ?? undefined
  );
}

describe("section loaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    host.getClusterCapacity.mockResolvedValue(fakeClusterCapacity);
    host.getMonitoringStackStatus.mockResolvedValue(fakeMonitoringStackStatus);
    host.getInferenceWorkloadsStatus.mockResolvedValue(fakeInferenceWorkloadsStatus);
    host.getNemotronCatalog.mockResolvedValue(fakeNemotronCatalog);
    host.getNemotronStackStatus.mockResolvedValue(fakeNemotronStackStatus);
    host.getOpenWebUIStatus.mockResolvedValue(fakeOpenWebUIStatus);
    host.getStorageTree.mockResolvedValue(fakeTree);
    host.listContainers.mockResolvedValue(fakeContainers);
    host.listOllamaModels.mockResolvedValue(fakeOllama);
    host.getDevWorkspacesStatus.mockResolvedValue(fakeDevWorkspacesStatus);
    host.getMachineIdentity.mockResolvedValue(fakeMachineIdentity);
    host.getRunningServices.mockResolvedValue(fakeServices);
    host.getPackages.mockResolvedValue(fakePackages);
    host.listSecrets.mockResolvedValue(fakeSecrets);
  });

  describe("resources", () => {
    it("forwards capacity and monitoring when both reads succeed", async () => {
      render(await ResourcesSection());

      expect(screen.getByTestId("panel-resources")).toBeInTheDocument();
      expect(failureTitles()).toEqual([]);
      expect(forwardedProps("panel-resources")).toStrictEqual({
        initialCapacity: fakeClusterCapacity,
        monitoringStatus: fakeMonitoringStackStatus
      });
    });

    it("omits monitoringStatus when the monitoring read fails, keeping the panel up", async () => {
      host.getMonitoringStackStatus.mockRejectedValue(new Error("grafana unreachable"));

      render(await ResourcesSection());

      // Monitoring is optional input: the panel must still render, minus the prop.
      expect(screen.getByTestId("panel-resources")).toBeInTheDocument();
      expect(failureTitles()).toEqual([]);
      expect(forwardedProps("panel-resources")).toStrictEqual({ initialCapacity: fakeClusterCapacity });
      expect(Object.keys(forwardedProps("panel-resources"))).not.toContain("monitoringStatus");
    });

    it("degrades to SectionFailure when capacity fails and renders no panel", async () => {
      host.getClusterCapacity.mockRejectedValue(new Error("kubectl timed out"));

      render(await ResourcesSection());

      expect(screen.queryByTestId("panel-resources")).not.toBeInTheDocument();
      expect(failureTitles()).toEqual(["Resource Guard"]);
      expect(failureMessage("Resource Guard")).toBe("resources could not load: kubectl timed out");
    });
  });

  describe("observability", () => {
    it("forwards the monitoring status", async () => {
      render(await ObservabilitySection());

      expect(screen.getByTestId("panel-observability")).toBeInTheDocument();
      expect(forwardedProps("panel-observability")).toStrictEqual({ initialStatus: fakeMonitoringStackStatus });
    });

    it("degrades when the monitoring read fails", async () => {
      host.getMonitoringStackStatus.mockRejectedValue(new Error("prometheus not scraped"));

      render(await ObservabilitySection());

      expect(screen.queryByTestId("panel-observability")).not.toBeInTheDocument();
      expect(failureTitles()).toEqual(["Observability"]);
      expect(failureMessage("Observability")).toBe("observability could not load: prometheus not scraped");
    });
  });

  describe("inference", () => {
    it("renders both panels when every read succeeds", async () => {
      render(await InferenceSection());

      expect(screen.getByTestId("panel-nemotron")).toBeInTheDocument();
      expect(screen.getByTestId("panel-inference")).toBeInTheDocument();
      expect(screen.queryByTestId("section-failure")).not.toBeInTheDocument();
      expect(forwardedProps("panel-nemotron")).toStrictEqual({
        initialCatalog: fakeNemotronCatalog,
        initialStackStatus: fakeNemotronStackStatus,
        clusterCapacity: fakeClusterCapacity
      });
      expect(forwardedProps("panel-inference")).toStrictEqual({ initialStatus: fakeInferenceWorkloadsStatus });
    });

    it("fails the Nemotron half alone when the catalog read rejects", async () => {
      host.getNemotronCatalog.mockRejectedValue(new Error("catalog file missing"));

      render(await InferenceSection());

      expect(screen.queryByTestId("panel-nemotron")).not.toBeInTheDocument();
      expect(screen.getByTestId("panel-inference")).toBeInTheDocument();
      expect(failureTitles()).toEqual(["Nemotron stacks"]);
      expect(failureMessage("Nemotron stacks")).toBe("inference could not load: catalog file missing");
    });

    it("fails the Nemotron half alone when the stack status read rejects", async () => {
      host.getNemotronStackStatus.mockRejectedValue(new Error("helm release unknown"));

      render(await InferenceSection());

      expect(screen.queryByTestId("panel-nemotron")).not.toBeInTheDocument();
      expect(screen.getByTestId("panel-inference")).toBeInTheDocument();
      expect(failureTitles()).toEqual(["Nemotron stacks"]);
      expect(failureMessage("Nemotron stacks")).toBe("inference could not load: helm release unknown");
    });

    it("fails the Nemotron half alone when the capacity read rejects", async () => {
      host.getClusterCapacity.mockRejectedValue(new Error("no allocatable GPUs"));

      render(await InferenceSection());

      expect(screen.queryByTestId("panel-nemotron")).not.toBeInTheDocument();
      expect(screen.getByTestId("panel-inference")).toBeInTheDocument();
      expect(failureTitles()).toEqual(["Nemotron stacks"]);
      expect(failureMessage("Nemotron stacks")).toBe("inference could not load: no allocatable GPUs");
    });

    it("fails the jobs half alone when the workloads read rejects", async () => {
      host.getInferenceWorkloadsStatus.mockRejectedValue(new Error("job controller unreachable"));

      render(await InferenceSection());

      expect(screen.getByTestId("panel-nemotron")).toBeInTheDocument();
      expect(screen.queryByTestId("panel-inference")).not.toBeInTheDocument();
      expect(failureTitles()).toEqual(["Workload jobs"]);
      expect(failureMessage("Workload jobs")).toBe("inference could not load: job controller unreachable");
    });
  });

  describe("agent-chat", () => {
    it("forwards the Open WebUI status", async () => {
      render(await AgentChatSection());

      expect(screen.getByTestId("panel-agent-chat")).toBeInTheDocument();
      expect(forwardedProps("panel-agent-chat")).toStrictEqual({ initialStatus: fakeOpenWebUIStatus });
    });

    it("degrades when the Open WebUI read fails", async () => {
      host.getOpenWebUIStatus.mockRejectedValue(new Error("container not running"));

      render(await AgentChatSection());

      expect(screen.queryByTestId("panel-agent-chat")).not.toBeInTheDocument();
      expect(failureTitles()).toEqual(["Agent Chat"]);
      expect(failureMessage("Agent Chat")).toBe("agent-chat could not load: container not running");
    });
  });

  describe("storage", () => {
    it("walks /mnt/models and forwards the tree", async () => {
      render(await StorageSection());

      expect(host.getStorageTree).toHaveBeenCalledWith("/mnt/models");
      expect(screen.getByTestId("panel-storage")).toBeInTheDocument();
      expect(forwardedProps("panel-storage")).toStrictEqual({ initialTree: fakeTree });
    });

    it("degrades when the tree walk fails", async () => {
      host.getStorageTree.mockRejectedValue(new Error("permission denied on /mnt/models"));

      render(await StorageSection());

      expect(host.getStorageTree).toHaveBeenCalledWith("/mnt/models");
      expect(screen.queryByTestId("panel-storage")).not.toBeInTheDocument();
      expect(failureTitles()).toEqual(["Storage"]);
      expect(failureMessage("Storage")).toBe("storage could not load: permission denied on /mnt/models");
    });
  });

  describe("tasks", () => {
    it("forwards containers and ollama models together", async () => {
      render(await TasksSection());

      expect(screen.getByTestId("panel-tasks")).toBeInTheDocument();
      expect(forwardedProps("panel-tasks")).toStrictEqual({ containers: fakeContainers, ollama: fakeOllama });
    });

    it("fails as one when the container read rejects", async () => {
      host.listContainers.mockRejectedValue(new Error("docker socket gone"));

      render(await TasksSection());

      expect(screen.queryByTestId("panel-tasks")).not.toBeInTheDocument();
      expect(failureTitles()).toEqual(["Tasks"]);
      expect(failureMessage("Tasks")).toBe("tasks could not load: docker socket gone");
    });

    it("fails as one when the ollama read rejects", async () => {
      host.listOllamaModels.mockRejectedValue(new Error("ollama port refused"));

      render(await TasksSection());

      expect(screen.queryByTestId("panel-tasks")).not.toBeInTheDocument();
      expect(failureTitles()).toEqual(["Tasks"]);
      expect(failureMessage("Tasks")).toBe("tasks could not load: ollama port refused");
    });
  });

  describe("workspaces", () => {
    it("forwards the dev workspace status", async () => {
      render(await WorkspacesSection());

      expect(screen.getByTestId("panel-workspaces")).toBeInTheDocument();
      expect(forwardedProps("panel-workspaces")).toStrictEqual({ initialStatus: fakeDevWorkspacesStatus });
    });

    it("degrades when the workspace read fails", async () => {
      host.getDevWorkspacesStatus.mockRejectedValue(new Error("coder api unreachable"));

      render(await WorkspacesSection());

      expect(screen.queryByTestId("panel-workspaces")).not.toBeInTheDocument();
      expect(failureTitles()).toEqual(["Dev Workspaces"]);
      expect(failureMessage("Dev Workspaces")).toBe("workspaces could not load: coder api unreachable");
    });
  });

  describe("system", () => {
    it("forwards identity, services and packages as one bundle", async () => {
      render(await SystemSection());

      expect(screen.getByTestId("panel-machine-state")).toBeInTheDocument();
      expect(forwardedProps("panel-machine-state")).toStrictEqual({
        initialData: { identity: fakeMachineIdentity, services: fakeServices, packages: fakePackages }
      });
    });

    it("degrades when the identity read fails", async () => {
      host.getMachineIdentity.mockRejectedValue(new Error("hostname missing"));

      render(await SystemSection());

      expect(screen.queryByTestId("panel-machine-state")).not.toBeInTheDocument();
      expect(failureTitles()).toEqual(["Machine State"]);
      expect(failureMessage("Machine State")).toBe("system could not load: hostname missing");
    });

    it("degrades when the services read fails", async () => {
      host.getRunningServices.mockRejectedValue(new Error("systemctl failed"));

      render(await SystemSection());

      expect(screen.queryByTestId("panel-machine-state")).not.toBeInTheDocument();
      expect(failureTitles()).toEqual(["Machine State"]);
      expect(failureMessage("Machine State")).toBe("system could not load: systemctl failed");
    });

    it("degrades when the packages read fails", async () => {
      host.getPackages.mockRejectedValue(new Error("dpkg query timed out"));

      render(await SystemSection());

      expect(screen.queryByTestId("panel-machine-state")).not.toBeInTheDocument();
      expect(failureTitles()).toEqual(["Machine State"]);
      expect(failureMessage("Machine State")).toBe("system could not load: dpkg query timed out");
    });
  });

  describe("secrets", () => {
    it("forwards only the secret metadata", async () => {
      render(await SecretsSection());

      expect(screen.getByTestId("panel-secrets")).toBeInTheDocument();
      expect(forwardedProps("panel-secrets")).toStrictEqual({ initialSecrets: fakeSecrets });
    });

    it("degrades when the secrets list fails", async () => {
      host.listSecrets.mockRejectedValue(new Error("keystore sealed"));

      render(await SecretsSection());

      expect(screen.queryByTestId("panel-secrets")).not.toBeInTheDocument();
      expect(failureTitles()).toEqual(["Secrets Vault"]);
      expect(failureMessage("Secrets Vault")).toBe("secrets could not load: keystore sealed");
    });
  });

  describe("utilities", () => {
    it("renders the panel with no host read at all", () => {
      render(<UtilitiesSection />);

      expect(screen.getByTestId("panel-utilities")).toBeInTheDocument();
      expect(forwardedProps("panel-utilities")).toStrictEqual({});
      expect(screen.queryByTestId("section-failure")).not.toBeInTheDocument();
      expect(vi.mocked(host.getClusterCapacity)).not.toHaveBeenCalled();
      expect(vi.mocked(host.listSecrets)).not.toHaveBeenCalled();
    });
  });
});
