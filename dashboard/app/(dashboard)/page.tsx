import type React from "react";
import { TasksPanel } from "@/components/TasksPanel";
import { StoragePanel } from "@/components/StoragePanel";
import { MachineStatePanel } from "@/components/MachineStatePanel";
import { UtilitiesPanel } from "@/components/UtilitiesPanel";
import { SecretsPanel } from "@/components/SecretsPanel";
import { WorkspacesPanel } from "@/components/WorkspacesPanel";
import { ResourcesPanel } from "@/components/ResourcesPanel";
import { InferencePanel } from "@/components/InferencePanel";
import { NemotronStackPanel } from "@/components/NemotronStackPanel";
import { OpenWebUIPanel } from "@/components/OpenWebUIPanel";
import { ObservabilityPanel } from "@/components/ObservabilityPanel";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  getNemotronCatalog,
  getNemotronStackStatus,
  getOpenWebUIStatus,
  getMonitoringStackStatus,
  listSecrets
} from "@/lib/host";
import { computeStorageKpis } from "@/lib/storage-stats";
import { HardDrive, Layers, PieChart } from "lucide-react";

/**
 * Main dashboard route — server-rendered control plane home.
 * Fetches host/cluster state via `@/lib/host` and composes feature panels.
 * Requires authenticated session via `(dashboard)/layout.tsx`.
 */
/** Force dynamic rendering so host state is always fresh. */
export const dynamic = "force-dynamic";

const sectionContentClass = "px-4 pb-4 pt-0 sm:px-6";

/**
 * Main dashboard home — composes all feature panels with server-fetched data.
 * @returns Full dashboard page with Tasks, Storage, Machine State, and stack panels.
 */
export default async function DashboardPage(): Promise<React.JSX.Element> {
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
    nemotronCatalog,
    nemotronStackStatus,
    openWebUIStatus,
    monitoringStatus,
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
    getNemotronCatalog(),
    getNemotronStackStatus(),
    getOpenWebUIStatus(),
    getMonitoringStackStatus(),
    listSecrets()
  ]);

  const machineState = { identity, services, packages };
  const kpis = computeStorageKpis(initialTree);
  const containerCount = Array.isArray(containers) ? containers.length : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">DGX Spark Lab • Self-hosted control plane</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-start justify-between">
              <div className="kpi-value tabular-nums tracking-tight">{kpis.totalStorage}</div>
              <CardAction>
                <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
                  <HardDrive className="mr-0.5 h-2.5 w-2.5" />
                  {containerCount} running
                </Badge>
              </CardAction>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-[13px] font-semibold tracking-tight">Total storage</div>
            <div className="text-[10px] text-muted-foreground">{containerCount} containers running</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-start justify-between">
              <div className="kpi-value tabular-nums tracking-tight">{kpis.largestModel}</div>
              <CardAction>
                <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
                  <PieChart className="mr-0.5 h-2.5 w-2.5" />
                  {kpis.largestPct}% share
                </Badge>
              </CardAction>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-[13px] font-semibold tracking-tight">Largest model</div>
            <div className="text-[10px] text-muted-foreground">
              {kpis.largestName} • {kpis.largestPct}% of storage
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-start justify-between">
              <div className="kpi-value tabular-nums tracking-tight">{kpis.itemCount}</div>
              <CardAction>
                <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
                  <Layers className="mr-0.5 h-2.5 w-2.5" />
                  at root
                </Badge>
              </CardAction>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-[13px] font-semibold tracking-tight">Items visible</div>
            <div className="text-[10px] text-muted-foreground">Across current level</div>
          </CardContent>
        </Card>
      </div>

      <section id="resources" className="dashboard-section">
        <Card className="overflow-hidden">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-6">
            <CardTitle>Resource Guard</CardTitle>
          </CardHeader>
          <CardContent className={sectionContentClass}>
            <ResourcesPanel initialCapacity={clusterCapacity} monitoringStatus={monitoringStatus} />
          </CardContent>
        </Card>
      </section>

      <section id="observability" className="dashboard-section">
        <Card className="overflow-hidden">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-6">
            <CardTitle>Observability</CardTitle>
          </CardHeader>
          <CardContent className={sectionContentClass}>
            <ObservabilityPanel initialStatus={monitoringStatus} />
          </CardContent>
        </Card>
      </section>

      <section id="inference" className="dashboard-section">
        <Card className="overflow-hidden">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-6">
            <CardTitle>Inference Workloads</CardTitle>
          </CardHeader>
          <CardContent className={sectionContentClass}>
            <div className="space-y-6">
              <NemotronStackPanel
                initialCatalog={nemotronCatalog}
                initialStackStatus={nemotronStackStatus}
                clusterCapacity={clusterCapacity}
              />
              <InferencePanel initialStatus={inferenceStatus} />
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="agent-chat" className="dashboard-section">
        <Card className="overflow-hidden">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-6">
            <CardTitle>Agent Chat</CardTitle>
          </CardHeader>
          <CardContent className={sectionContentClass}>
            <OpenWebUIPanel initialStatus={openWebUIStatus} />
          </CardContent>
        </Card>
      </section>

      <section id="storage" className="dashboard-section">
        <Card className="overflow-hidden">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-6">
            <CardTitle>Storage Visualization</CardTitle>
          </CardHeader>
          <CardContent className={sectionContentClass}>
            <StoragePanel initialTree={initialTree} />
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section id="tasks" className="dashboard-section min-w-0 lg:col-span-2">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="px-4 pb-2 pt-4 sm:px-6">
              <CardTitle className="md3-title-medium text-[var(--md-sys-color-on-surface-variant)]">
                Tasks — Containers &amp; Ollama
              </CardTitle>
            </CardHeader>
            <CardContent className={sectionContentClass}>
              <TasksPanel containers={containers} ollama={ollama} />
            </CardContent>
          </Card>
        </section>

        <section id="workspaces" className="dashboard-section min-w-0 lg:col-span-2">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="px-4 pb-2 pt-4 sm:px-6">
              <CardTitle className="md3-title-medium text-[var(--md-sys-color-on-surface-variant)]">
                Dev Workspaces — Coder &amp; Kasm
              </CardTitle>
            </CardHeader>
            <CardContent className={sectionContentClass}>
              <WorkspacesPanel initialStatus={workspacesStatus} />
            </CardContent>
          </Card>
        </section>

        <section id="system" className="dashboard-section min-w-0">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="px-4 pb-2 pt-4 sm:px-6">
              <CardTitle className="md3-title-medium text-[var(--md-sys-color-on-surface-variant)]">
                Machine State
              </CardTitle>
            </CardHeader>
            <CardContent className={sectionContentClass}>
              <MachineStatePanel initialData={machineState} />
            </CardContent>
          </Card>
        </section>

        <section id="utilities" className="dashboard-section min-w-0">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="px-4 pb-2 pt-4 sm:px-6">
              <CardTitle className="md3-title-medium text-[var(--md-sys-color-on-surface-variant)]">
                Utilities
              </CardTitle>
            </CardHeader>
            <CardContent className={sectionContentClass}>
              <UtilitiesPanel />
            </CardContent>
          </Card>
        </section>

        <section id="secrets" className="dashboard-section min-w-0 lg:col-span-2">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="px-4 pb-2 pt-4 sm:px-6">
              <CardTitle className="md3-title-medium text-[var(--md-sys-color-on-surface-variant)]">
                Secrets Vault
              </CardTitle>
            </CardHeader>
            <CardContent className={sectionContentClass}>
              <SecretsPanel initialSecrets={initialSecrets} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
