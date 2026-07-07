import type React from "react";
import { notFound } from "next/navigation";
import { StoragePanel } from "@/components/StoragePanel";
import { TasksPanel } from "@/components/TasksPanel";
import { MachineStatePanel } from "@/components/MachineStatePanel";
import { UtilitiesPanel } from "@/components/UtilitiesPanel";
import { WorkspacesPanel } from "@/components/WorkspacesPanel";
import { ResourcesPanel } from "@/components/ResourcesPanel";
import { InferencePanel } from "@/components/InferencePanel";
import { ObservabilityPanel } from "@/components/ObservabilityPanel";
import { NemotronStackPanel } from "@/components/NemotronStackPanel";
import { OpenWebUIPanel } from "@/components/OpenWebUIPanel";
import { SecretsPanel } from "@/components/SecretsPanel";
import {
  getStorageTree,
  listContainers,
  listOllamaModels,
  getMachineIdentity,
  getRunningServices,
  getPackages,
  getDevWorkspacesStatus,
  getClusterCapacity,
  getInferenceWorkloadsStatus,
  getMonitoringStackStatus,
  getNemotronCatalog,
  getNemotronStackStatus,
  getOpenWebUIStatus,
  listSecrets
} from "@/lib/host";
/**
 * Isolated panel fixtures for visual regression (not shown on main dashboard).
 * @returns Dev-only page rendering all panels with mock data.
 */
export default async function DevPanelsPage(): Promise<React.JSX.Element> {
  if (process.env.NODE_ENV === "production" && process.env.USE_MOCKS !== "1") {
    notFound();
  }

  const [
    initialTree,
    containers,
    ollama,
    identity,
    services,
    packages,
    workspacesStatus,
    clusterCapacity,
    inferenceStatus,
    monitoringStatus,
    nemotronCatalog,
    nemotronStackStatus,
    openWebUIStatus,
    initialSecrets
  ] = await Promise.all([
    getStorageTree("/mnt/models"),
    listContainers(),
    listOllamaModels(),
    getMachineIdentity(),
    getRunningServices(),
    getPackages(),
    getDevWorkspacesStatus(),
    getClusterCapacity(),
    getInferenceWorkloadsStatus(),
    getMonitoringStackStatus(),
    getNemotronCatalog(),
    getNemotronStackStatus(),
    getOpenWebUIStatus(),
    listSecrets()
  ]);

  const machineState = { identity, services, packages };

  return (
    <div className="min-h-screen bg-background p-8">
      <div data-testid="visual-panel-fixtures" className="mx-auto max-w-5xl space-y-8">
        <h1 className="md3-title-large text-foreground">Panel fixture gallery</h1>

        <div data-testid="visual-panel-resources" className="rounded-lg bg-background p-4">
          <ResourcesPanel initialCapacity={clusterCapacity} monitoringStatus={monitoringStatus} />
        </div>

        <div data-testid="visual-panel-observability" className="rounded-lg bg-background p-4">
          <ObservabilityPanel initialStatus={monitoringStatus} />
        </div>

        <div data-testid="visual-panel-inference" className="rounded-lg bg-background p-4">
          <InferencePanel initialStatus={inferenceStatus} />
        </div>

        <div data-testid="visual-panel-nemotron" className="rounded-lg bg-background p-4">
          <NemotronStackPanel
            initialCatalog={nemotronCatalog}
            initialStackStatus={nemotronStackStatus}
            clusterCapacity={clusterCapacity}
          />
        </div>

        <div data-testid="visual-panel-open-webui" className="rounded-lg bg-background p-4">
          <OpenWebUIPanel initialStatus={openWebUIStatus} />
        </div>

        <div data-testid="visual-panel-storage" className="rounded-lg bg-background p-4">
          <StoragePanel initialTree={initialTree} />
        </div>

        <div data-testid="visual-panel-tasks" className="rounded-lg bg-background p-4">
          <TasksPanel containers={containers} ollama={ollama} />
        </div>

        <div data-testid="visual-panel-workspaces" className="rounded-lg bg-background p-4">
          <WorkspacesPanel initialStatus={workspacesStatus} />
        </div>

        <div data-testid="visual-panel-machine" className="rounded-lg bg-background p-4">
          <MachineStatePanel initialData={machineState} />
        </div>

        <div data-testid="visual-panel-utilities" className="rounded-lg bg-background p-4">
          <UtilitiesPanel />
        </div>

        <div data-testid="visual-panel-secrets" className="rounded-lg bg-background p-4">
          <SecretsPanel initialSecrets={initialSecrets} />
        </div>
      </div>
    </div>
  );
}
