/**
 * Server actions for host operations: storage, machine state, utilities, capacity,
 * inference workloads, Nemotron stacks, dev workspaces, Open WebUI, and observability.
 *
 * Thin wrappers around `@/lib/host` services with Zod validation and session gating.
 * Mutating actions call `revalidatePath("/")` so the dashboard reflects fresh state.
 * All actions require an authenticated session via {@link requireSession}.
 */
"use server";

import { revalidatePath } from "next/cache";
import {
  stopContainer,
  getStorageTree,
  deletePath,
  findDuplicates,
  getMachineIdentity,
  getRunningServices,
  getPackages,
  getUtilityStatus,
  runUtility,
  getDevWorkspacesStatus,
  startDevWorkspace,
  stopDevWorkspace,
  getClusterCapacity,
  checkCapacity,
  suggestFreeResources,
  getInferenceWorkloadsStatus,
  startInferenceWorkload,
  stopInferenceWorkload,
  getNemotronCatalog,
  getNemotronStackStatus,
  startNemotronStack,
  stopNemotronStack,
  getOpenWebUIStatus,
  startOpenWebUI,
  stopOpenWebUI,
  getMonitoringStackStatus
} from "@/lib/host";
import { requireSession } from "@/lib/require-session";
import {
  ContainerIdSchema,
  PathSchema,
  UtilityNameSchema,
  DevWorkspaceNameSchema,
  CapacityActionSchema,
  InferenceModelNameSchema,
  NemotronStackIdSchema,
  OpenWebUIStackIdSchema,
  HeavyConfirmSchema
} from "@/lib/validation";
import type {
  CapacityCheck,
  ClusterCapacity,
  DevWorkspacesStatus,
  DuplicateFindResult,
  FreeResourceSuggestion,
  InferenceWorkloadsStatus,
  MachineState,
  MonitoringStackStatus,
  NemotronCatalog,
  NemotronStackStatus,
  OpenWebUIStatus,
  TreeNode,
  UtilityRunResult,
  UtilityStatus
} from "@/lib/types";

/**
 * Stop a Docker container by id.
 * @param id - Container id or name (validated via {@link ContainerIdSchema}).
 * @returns Stop result with the container id.
 * @throws When session is missing or id fails validation.
 */
export async function stopContainerAction(id: string): Promise<{ stopped: string }> {
  await requireSession();
  const parsed = ContainerIdSchema.parse(id);
  const result = await stopContainer(parsed);
  revalidatePath("/");
  return result;
}

/**
 * Fetch a storage directory tree for treemap visualization.
 * @param input - Optional root path; defaults to `/mnt/models`.
 * @returns Hierarchical {@link TreeNode} for the requested path.
 * @throws When session is missing or path fails whitelist validation.
 */
export async function getStorageTreeAction(input: { path?: string }): Promise<TreeNode> {
  await requireSession();
  const { path: p } = PathSchema.parse({
    path: input.path || "/mnt/models"
  });
  return await getStorageTree(p);
}

/**
 * Move a whitelisted path to lab trash (safe delete).
 * @param formData - Must include a `path` field.
 * @returns Trash location where the item was moved.
 * @throws When session is missing or path fails validation.
 */
export async function deletePathAction(formData: FormData): Promise<{ movedToTrash: string }> {
  await requireSession();
  const { path } = PathSchema.parse({
    path: formData.get("path") as string
  });
  const result = await deletePath(path);
  revalidatePath("/");
  return result;
}

/**
 * Aggregate host identity, running services, and installed packages.
 * @returns Combined {@link MachineState} snapshot.
 * @throws When session is missing.
 */
export async function getMachineStateAction(): Promise<MachineState> {
  await requireSession();
  const [identity, services, packages] = await Promise.all([getMachineIdentity(), getRunningServices(), getPackages()]);
  return { identity, services, packages };
}

/**
 * Find duplicate files by size under a storage path.
 * @param path - Optional root path; defaults to `/mnt/models`.
 * @returns Groups of files sharing the same size above the minimum threshold.
 * @throws When session is missing or path fails validation.
 */
export async function findDuplicatesAction(path?: string): Promise<DuplicateFindResult> {
  await requireSession();
  const target = path ? PathSchema.parse({ path }).path : "/mnt/models";
  return await findDuplicates(target);
}

/**
 * Query status JSON for a lab utility script.
 * @param name - Utility script name (without `.sh`).
 * @returns Parsed status object or error shape from the utility.
 * @throws When session is missing or name is not in the allowlist.
 */
export async function getUtilityStatusAction(name: string): Promise<UtilityStatus> {
  await requireSession();
  const parsed = UtilityNameSchema.parse(name);
  return await getUtilityStatus(parsed);
}

/**
 * Run a lab utility script with optional subcommand args.
 * @param name - Utility script name (without `.sh`).
 * @param subcommand - Optional extra CLI args passed to the script.
 * @returns Captured stdout, stderr, and exit code.
 * @throws When session is missing or name is not in the allowlist.
 */
export async function runUtilityAction(name: string, subcommand?: string): Promise<UtilityRunResult> {
  await requireSession();
  const parsed = UtilityNameSchema.parse(name);
  const args = subcommand ? [subcommand] : [];
  const result = await runUtility(parsed, args);
  revalidatePath("/");
  return result;
}

/**
 * Fetch Coder and Kasm dev workspace pod/helm status.
 * @returns Combined workspace status with URLs.
 * @throws When session is missing.
 */
export async function getDevWorkspacesStatusAction(): Promise<DevWorkspacesStatus> {
  await requireSession();
  return await getDevWorkspacesStatus();
}

/**
 * Start a dev workspace (Coder or Kasm).
 * @param name - Workspace id (`coder` or `kasm`).
 * @returns Utility script stdout/stderr and exit code.
 * @throws When session is missing or name fails validation.
 */
export async function startDevWorkspaceAction(name: string): Promise<UtilityRunResult> {
  await requireSession();
  const parsed = DevWorkspaceNameSchema.parse(name);
  const result = await startDevWorkspace(parsed);
  revalidatePath("/");
  return result;
}

/**
 * Stop a dev workspace (Coder or Kasm).
 * @param name - Workspace id (`coder` or `kasm`).
 * @returns Utility script stdout/stderr and exit code.
 * @throws When session is missing or name fails validation.
 */
export async function stopDevWorkspaceAction(name: string): Promise<UtilityRunResult> {
  await requireSession();
  const parsed = DevWorkspaceNameSchema.parse(name);
  const result = await stopDevWorkspace(parsed);
  revalidatePath("/");
  return result;
}

/**
 * Fetch cluster GPU, CPU, and memory capacity snapshot.
 * @returns {@link ClusterCapacity} from `cluster-resources.sh`.
 * @throws When session is missing.
 */
export async function getClusterCapacityAction(): Promise<ClusterCapacity> {
  await requireSession();
  return await getClusterCapacity();
}

/**
 * Check whether a planned action fits current cluster capacity.
 * @param action - Capacity action token (e.g. `model:kimi`, `dev:coder`).
 * @returns Verdict with required vs available resources.
 * @throws When session is missing or action token fails validation.
 */
export async function checkCapacityAction(action: string): Promise<CapacityCheck> {
  await requireSession();
  const parsed = CapacityActionSchema.parse(action);
  return await checkCapacity(parsed);
}

/**
 * Suggest workloads to stop in order to free resources for an action.
 * @param action - Capacity action token (e.g. `stack:nemotron-agentic-spark-1`).
 * @returns Ordered list of stop suggestions.
 * @throws When session is missing or action token fails validation.
 */
export async function suggestFreeResourcesAction(action: string): Promise<FreeResourceSuggestion[]> {
  await requireSession();
  const parsed = CapacityActionSchema.parse(action);
  return await suggestFreeResources(parsed);
}

/**
 * Fetch inference workload (K8s job) status for all models.
 * @returns {@link InferenceWorkloadsStatus} from `inference-workloads.sh`.
 * @throws When session is missing.
 */
export async function getInferenceWorkloadsAction(): Promise<InferenceWorkloadsStatus> {
  await requireSession();
  return await getInferenceWorkloadsStatus();
}

/**
 * Start an inference workload for a model.
 * @param model - Model id (validated via {@link InferenceModelNameSchema}).
 * @param confirm - Optional heavy-model confirmation (`yes`).
 * @returns Utility script stdout/stderr and exit code.
 * @throws When session is missing, model fails validation, or confirm is invalid.
 */
export async function startInferenceWorkloadAction(model: string, confirm?: string): Promise<UtilityRunResult> {
  await requireSession();
  const parsedModel = InferenceModelNameSchema.parse(model);
  if (confirm) HeavyConfirmSchema.parse(confirm);
  const result = await startInferenceWorkload(parsedModel, confirm ?? "");
  revalidatePath("/");
  return result;
}

/**
 * Stop an inference workload or Ray head.
 * @param target - Model id, `all`, or `ray`.
 * @returns Utility script stdout/stderr and exit code.
 * @throws When session is missing or target fails validation.
 */
export async function stopInferenceWorkloadAction(target: string): Promise<UtilityRunResult> {
  await requireSession();
  const parsed = target === "all" || target === "ray" ? target : InferenceModelNameSchema.parse(target);
  const result = await stopInferenceWorkload(parsed);
  revalidatePath("/");
  return result;
}

/**
 * Fetch Nemotron agentic stack catalog (models, pillars, endpoints).
 * @returns {@link NemotronCatalog} from `nemotron-stack.sh`.
 * @throws When session is missing.
 */
export async function getNemotronCatalogAction(): Promise<NemotronCatalog> {
  await requireSession();
  return await getNemotronCatalog();
}

/**
 * Fetch running Nemotron stack status and pillar health.
 * @returns {@link NemotronStackStatus} from `nemotron-stack.sh`.
 * @throws When session is missing.
 */
export async function getNemotronStackStatusAction(): Promise<NemotronStackStatus> {
  await requireSession();
  return await getNemotronStackStatus();
}

/**
 * Start a Nemotron agentic stack.
 * @param stackId - Stack id (validated via {@link NemotronStackIdSchema}).
 * @param confirm - Optional heavy-stack confirmation (`yes`).
 * @returns Utility script stdout/stderr and exit code.
 * @throws When session is missing, stackId fails validation, or confirm is invalid.
 */
export async function startNemotronStackAction(stackId: string, confirm?: string): Promise<UtilityRunResult> {
  await requireSession();
  const parsed = NemotronStackIdSchema.parse(stackId);
  if (confirm) HeavyConfirmSchema.parse(confirm);
  const result = await startNemotronStack(parsed, confirm ?? "");
  revalidatePath("/");
  return result;
}

/**
 * Stop a Nemotron agentic stack or all stacks.
 * @param stackId - Stack id or `all`.
 * @returns Utility script stdout/stderr and exit code.
 * @throws When session is missing or stackId fails validation.
 */
export async function stopNemotronStackAction(stackId: string): Promise<UtilityRunResult> {
  await requireSession();
  const parsed = stackId === "all" ? "all" : NemotronStackIdSchema.parse(stackId);
  const result = await stopNemotronStack(parsed);
  revalidatePath("/");
  return result;
}

/**
 * Fetch Open WebUI stack status (pods, URLs).
 * @returns {@link OpenWebUIStatus} from `open-webui-stack.sh`.
 * @throws When session is missing.
 */
export async function getOpenWebUIStatusAction(): Promise<OpenWebUIStatus> {
  await requireSession();
  return await getOpenWebUIStatus();
}

/**
 * Start the Open WebUI lab stack.
 * @param stackId - Stack id (validated via {@link OpenWebUIStackIdSchema}).
 * @param confirm - Optional heavy-stack confirmation (`yes`).
 * @returns Utility script stdout/stderr and exit code.
 * @throws When session is missing, stackId fails validation, or confirm is invalid.
 */
export async function startOpenWebUIAction(stackId: string, confirm?: string): Promise<UtilityRunResult> {
  await requireSession();
  const parsed = OpenWebUIStackIdSchema.parse(stackId);
  if (confirm) HeavyConfirmSchema.parse(confirm);
  const result = await startOpenWebUI(parsed, confirm ?? "");
  revalidatePath("/");
  return result;
}

/**
 * Stop the Open WebUI lab stack.
 * @returns Utility script stdout/stderr and exit code.
 * @throws When session is missing.
 */
export async function stopOpenWebUIAction(): Promise<UtilityRunResult> {
  await requireSession();
  const result = await stopOpenWebUI();
  revalidatePath("/");
  return result;
}

/**
 * Fetch Grafana/Headlamp monitoring stack status.
 * @returns {@link MonitoringStackStatus} from `monitoring-stack.sh`.
 * @throws When session is missing.
 */
export async function getMonitoringStackStatusAction(): Promise<MonitoringStackStatus> {
  await requireSession();
  return await getMonitoringStackStatus();
}
