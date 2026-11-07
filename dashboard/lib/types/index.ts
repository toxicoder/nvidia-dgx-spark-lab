/**
 * Shared dashboard domain types.
 *
 * This module is the vocabulary layer: interfaces, unions, branded primitives,
 * and the const allowlists that both the types and the zod schemas in
 * `lib/validation.ts` derive from. Allowing only one of the two to be edited is
 * what keeps a runtime check and a compile-time type from drifting apart.
 *
 * Rules for this file:
 *  - A closed set is a union over an `as const` array, never a hand-listed union.
 *  - A string that means something specific is a branded type from
 *    `lib/domain-primitives.ts`, not a bare `string`.
 *  - Data crossing the CLI boundary is validated with zod at the boundary; the
 *    types here describe what a validated payload is guaranteed to look like.
 */

/**
 * Model ids the dashboard may start or stop.
 *
 * Source of truth for `InferenceModelName` and for `InferenceModelNameSchema`.
 * Kept in sync with the Resource Guard policy `models` map; `//tests:safety_invariants`
 * asserts every name here exists in `config/resource-policy.json`.
 */
export const INFERENCE_MODEL_NAMES = [
  "kimi-test",
  "kimi",
  "ray-head",
  "nemotron-3-ultra",
  "nemotron-3-nano-30b",
  "nemotron-3-nano-omni-30b",
  "nemotron-3-super-120b",
  "nemotron-retriever-embed",
  "nemotron-retriever-rerank",
  "nemotron-parse",
  "nemotron-safety-guard",
  "nemotron-speech-asr",
  "nemotron-speech-tts",
  "glm-5.2",
  "qwen3.5-122b-a10b-nvfp4",
  "qwen3.5-397b-spark2",
  "qwen3.5-397b-nvfp4",
  "qwen3.6-27b-nvfp4",
  "qwen3.6-35b-a3b-nvfp4",
  "qwen3.8-27b-nvfp4",
  "qwen3.8-flash-next-nvfp4",
  "glm-5.3-flash",
  "deepseek-v4.1-flash",
  "deepseek-v4-flash-dspark",
  "glm-5.3-flash-exl3-tensorfold",
  "qwen3.8-27b-exl3-16gb",
  "qwen3.8-27b-tensorfold",
  "qwen3.8-flash-next-tensorfold",
  "nemotron-3.5-transcribe-30b-a4b-nvfp4",
  "litellm",
  "comfy-base",
  "flux-fast",
  "flux-quality",
  "ltx-balanced",
  "ltx-quality",
  "flux-to-ltx"
] as const;

/**
 * Nemotron/Qwen agentic stack ids the dashboard may start or stop.
 *
 * Source of truth for `NemotronStackId` and for `NemotronStackIdSchema`.
 */
export const NEMOTRON_STACK_IDS = [
  "nemotron-agentic-spark-1",
  "nemotron-agentic-spark-1-reasoning",
  "nemotron-agentic-spark-2-agent",
  "nemotron-agentic-spark-2-reasoning",
  "nemotron-agentic-spark-3",
  "nemotron-agentic-spark-4",
  "qwen-agentic-spark-1",
  "qwen-agentic-spark-2",
  "qwen-agentic-spark-4",
  "qwen36-dual-spark-1"
] as const;

/**
 * Kubernetes namespaces the dashboard is allowed to name or reach.
 *
 * Source of truth for {@link K8sNamespaceName} and for the namespace field of
 * `OpenWebUIBackendSchema` in `lib/services/cli-json.ts`.
 */
export const K8S_NAMESPACE_NAMES = ["dev", "ai-inference", "monitoring", "kube-system", "gpu-operator"] as const;

/** Kubernetes namespace name; derived from {@link K8S_NAMESPACE_NAMES}. */
export type K8sNamespaceName = (typeof K8S_NAMESPACE_NAMES)[number];

/** A Kubernetes resource quantity as written in the policy files, e.g. `"600m"`, `"24Gi"`. */
export type K8sQuantity = string;

/** Epoch milliseconds, as stored on `LabSecretMeta` and consumed by `formatTs`. */
export type TimestampMs = number;

/** TCP port number, 1-65535. Produced by the port parsers, never by an arbitrary number. */
export type PortNumber = number;

/**
 * Every verdict a Resource Guard check can report.
 *
 * Source of truth for {@link CapacityVerdict} and for `CapacityVerdictSchema`.
 * Mirrors `CapacityVerdict` (a `StrEnum`) in `scripts/lib/py/lab_types.py`; the
 * composed members stack in GPU, CPU, memory order.
 *
 * `"error"` has no Python counterpart: `lib/services/cluster-resources.ts`
 * synthesises it when the capacity utility itself cannot run, so the panel can
 * distinguish "the cluster cannot fit this" from "we could not ask the cluster".
 */
export const CAPACITY_VERDICTS = [
  "ok",
  "error",
  "unknown_model",
  "unknown_stack",
  "insufficient_nodes",
  "too_many_nodes",
  "insufficient_gpu",
  "insufficient_cpu",
  "insufficient_memory",
  "insufficient_gpu_cpu",
  "insufficient_gpu_memory",
  "insufficient_cpu_memory",
  "insufficient_gpu_cpu_memory"
] as const;

/** Why a Resource Guard capacity check passed or failed. */
export type CapacityVerdict = (typeof CAPACITY_VERDICTS)[number];

export interface TreeNode {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  ext?: string | null;
  type?: string;
  children?: TreeNode[];
}

export interface DockerContainer {
  ID: string;
  Names: string;
  Status: string;
  Image: string;
}

export type DockerListResult = DockerContainer[] | { error: string };

export interface OllamaModelsResult {
  raw: string;
}

export interface MachineIdentity {
  hostname: string;
  nvidia: string;
}

export interface RunningServices {
  services: string[];
}

export interface PackageList {
  packages: string[];
}

export interface MachineState {
  identity: MachineIdentity;
  services: RunningServices;
  packages: PackageList;
}

export interface UtilityInfo {
  name: string;
  path: string;
}

export interface UtilityStatus {
  name?: string | undefined;
  status?: string | undefined;
  lastRun?: string | undefined;
  error?: string | undefined;
  /** Utility-specific keys, documented by each script's `# @command` header. */
  [key: string]: unknown;
}

export interface UtilityRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DuplicateGroup {
  size: number;
  files: string[];
}

export interface DuplicateFindResult {
  groups: DuplicateGroup[];
}

/**
 * Every dev workspace the dashboard can render.
 *
 * Source of truth for {@link DevWorkspaceName} and for the parser in
 * `lib/services/cli-json.ts`.
 */
export const DEV_WORKSPACE_NAMES = ["coder", "kasm"] as const;

/** Dev workspace the dashboard may start or stop; derived from {@link DEV_WORKSPACE_NAMES}. */
export type DevWorkspaceName = (typeof DEV_WORKSPACE_NAMES)[number];

/**
 * Every lifecycle state a dev workspace can report.
 *
 * Source of truth for {@link DevWorkspaceState} and for the parser in
 * `lib/services/cli-json.ts`.
 */
export const DEV_WORKSPACE_STATES = ["stopped", "starting", "running", "stopping", "error"] as const;

/** Lifecycle state of a dev workspace; derived from {@link DEV_WORKSPACE_STATES}. */
export type DevWorkspaceState = (typeof DEV_WORKSPACE_STATES)[number];

export interface DevWorkspaceInfo {
  name: DevWorkspaceName;
  state: DevWorkspaceState;
  readyPods: number;
  totalPods: number;
  url: string;
  helmInstalled: boolean;
}

export interface DevWorkspacesStatus {
  coder: DevWorkspaceInfo;
  kasm: DevWorkspaceInfo;
  /** `| undefined` so the boundary parser can omit a key the utility left out. */
  error?: string | undefined;
}

export interface StorageKpis {
  totalBytes: number;
  totalStorage: string;
  itemCount: number;
  largestName: string;
  largestBytes: number;
  largestModel: string;
  largestPct: number;
}

export interface ResourceAmount {
  gpus: number;
  cpu: K8sQuantity;
  memory: K8sQuantity;
}

/** Node-count comparison emitted by a pre-flight rejection. */
export interface NodeCount {
  nodes: number;
}

export interface ClusterCapacity {
  node_count: number;
  allocatable: ResourceAmount;
  requested: ResourceAmount;
  headroom: { cpu: number; memory: number };
  free: ResourceAmount;
  available: ResourceAmount;
  utilization: { gpu_pct: number; cpu_pct: number; memory_pct: number };
  /**
   * Set when the capacity utility could not be reached or returned something the
   * boundary schema rejected; the panel shows mock numbers plus this reason.
   *
   * `| undefined` is explicit so the zod-derived boundary parsers in
   * `lib/services/cli-json.ts` can assign an absent optional under
   * `exactOptionalPropertyTypes`.
   */
  error?: string | undefined;
}

/**
 * How much of each dimension a check came up short by.
 *
 * Only the short dimensions appear. Spelled out rather than `Partial<ResourceAmount>`
 * because, under `exactOptionalPropertyTypes`, `Partial` still forbids an explicit
 * `undefined`, which is exactly what the boundary parser produces for an absent key.
 */
export interface CapacityDeficit {
  gpus?: number | undefined;
  cpu?: K8sQuantity | undefined;
  memory?: K8sQuantity | undefined;
}

export interface CapacityCheck {
  ok: boolean;
  /** Closed set; the utility only ever emits one of {@link CAPACITY_VERDICTS}. */
  verdict: CapacityVerdict;
  action: string;
  /** Present once the stack/model spec resolves. `| undefined` so the boundary parsers can omit it. */
  heavy?: boolean | undefined;
  required: ResourceAmount;
  available: ResourceAmount;
  deficit: CapacityDeficit;
}

/** A value inside a `frees` map: a formatted quantity, a count, or the literal `"all"`. */
export type FreesValue = string | number;

export interface FreeResourceSuggestion {
  id: string;
  label: string;
  action: string;
  reversible: boolean;
  impact: string;
  applicable: boolean;
  /**
   * What stopping this workload would release, keyed by dimension.
   *
   * Values mix kinds on purpose: `"4Gi"`, `0`, and the sentinel `"all"` all
   * appear depending on how well the estimator can bound the saving. `gpus_note`
   * carries `"approx"` for job estimates.
   */
  frees: Record<string, FreesValue>;
}

/** Model id the dashboard may start or stop; derived from {@link INFERENCE_MODEL_NAMES}. */
export type InferenceModelName = (typeof INFERENCE_MODEL_NAMES)[number];

/** Agentic stack id the dashboard may start or stop; derived from {@link NEMOTRON_STACK_IDS}. */
export type NemotronStackId = (typeof NEMOTRON_STACK_IDS)[number];

/**
 * Narrow a name the cluster reported to one the dashboard catalog knows.
 *
 * Cluster-reported model names arrive as plain `string`: a Job can outlive a
 * catalog edit, so a strict enum at the parse boundary would reject a whole
 * status payload over one unrecognised name. Callers that need an
 * {@link InferenceModelName} narrow with this predicate, which keeps the cast
 * out of the call site.
 * @param value - Model id as reported by the cluster.
 * @returns Whether the id is in the dashboard catalog.
 */
export function isInferenceModelName(value: string): value is InferenceModelName {
  return (INFERENCE_MODEL_NAMES as readonly string[]).includes(value);
}

export interface NemotronStackPreset {
  label: string;
  min_nodes?: number | undefined;
  max_nodes?: number | undefined;
  heavy?: boolean | undefined;
  tier?: string | undefined;
  description?: string | undefined;
  stack_with?: string[] | undefined;
  startup_order?: string[] | undefined;
  pillars?: string[] | undefined;
  quality_notes?: string | undefined;
}

export interface NemotronCatalogModel {
  display_name: string;
  family: string;
  runtime: string;
  agent_roles?: string[] | undefined;
  openai_svc?: string | undefined;
  port?: number | undefined;
  cpu_only?: boolean | undefined;
}

export interface QwenTierInfo {
  model?: string | undefined;
  hf_path?: string | undefined;
  rationale?: string | undefined;
}

export interface NemotronCatalog {
  models: Record<string, NemotronCatalogModel>;
  pillars: Record<string, { label: string; icon: string }>;
  stacks: Record<string, NemotronStackPreset>;
  qwen_tiers?:
    | {
        frontier_target?: string | undefined;
        spark_1?: QwenTierInfo | undefined;
        spark_2?: QwenTierInfo | undefined;
        spark_4?: QwenTierInfo | undefined;
      }
    | undefined;
}

export interface NemotronStackComponentStatus {
  model: string;
  state: string;
}

export interface NemotronStackHealth {
  id: string;
  label: string;
  healthy: boolean;
  components: NemotronStackComponentStatus[];
}

export interface NemotronStackStatus {
  stacks: NemotronStackHealth[];
  namespace: string;
}

/**
 * Every lifecycle state an inference Job can report.
 *
 * Source of truth for {@link InferenceJobState} and for `InferenceJobStateSchema`
 * in `lib/services/cli-json.ts`, so the schema and the type cannot drift apart.
 */
export const INFERENCE_JOB_STATES = ["absent", "running", "succeeded", "failed", "error"] as const;

/** Lifecycle state of an inference Job; derived from {@link INFERENCE_JOB_STATES}. */
export type InferenceJobState = (typeof INFERENCE_JOB_STATES)[number];

export interface InferenceJobInfo {
  /** Model id as reported by the cluster; narrow with {@link isInferenceModelName}. */
  model: string;
  job: string;
  /** `| undefined` so the boundary parser can omit a counter the utility left out. */
  active?: number | undefined;
  succeeded?: number | undefined;
  failed?: number | undefined;
  /** Closed set; the utility only ever emits one of {@link INFERENCE_JOB_STATES}. */
  state: InferenceJobState;
  error?: string | undefined;
}

export interface InferenceWorkloadsStatus {
  jobs: InferenceJobInfo[];
  namespace: string;
  error?: string | undefined;
}

/**
 * Every lifecycle state the Open WebUI stack can report.
 *
 * Source of truth for {@link OpenWebUIState} and for the parser in
 * `lib/services/cli-json.ts`.
 */
export const OPEN_WEBUI_STATES = ["stopped", "starting", "running"] as const;

/** Lifecycle state of the Open WebUI stack; derived from {@link OPEN_WEBUI_STATES}. */
export type OpenWebUIState = (typeof OPEN_WEBUI_STATES)[number];

export interface OpenWebUIBackendStatus {
  url: string;
  reachable: boolean;
  endpoint_ip?: string | undefined;
}

export interface OpenWebUIStatus {
  release: string;
  namespace: string;
  state: OpenWebUIState;
  helm_installed: boolean;
  pod_ready: boolean;
  urls: {
    sso: string;
    nodeport: string;
    local?: string | undefined;
    public?: string | null | undefined;
  };
  backend: {
    hermes_gateway: OpenWebUIBackendStatus;
  };
  prerequisites: {
    hermes_stack: string;
  };
  error?: string | undefined;
}

/** One backend entry of `config/open-webui-policy.json` `backends`. */
export interface OpenWebUIBackend {
  /** Kubernetes service name providing the backend. */
  service: string;
  /** Namespace the service lives in. */
  namespace: K8sNamespaceName;
  /** Service port. */
  port: PortNumber;
  /** Base path the UI proxies under. */
  path: string;
  /** Stack that must be running before this backend is usable. */
  requires_hermes_stack?: string | undefined;
}

export interface OpenWebUICatalog {
  helm: Record<string, string>;
  ports: Record<string, PortNumber>;
  sso: Record<string, string>;
  backends: Record<string, OpenWebUIBackend>;
  stacks: Record<
    string,
    {
      label: string;
      description?: string | undefined;
      requires_hermes_stack?: string | undefined;
    }
  >;
}

/**
 * Every lifecycle state a monitoring service can report.
 *
 * Source of truth for {@link MonitoringServiceState} and for the parser in
 * `lib/services/cli-json.ts`.
 */
export const MONITORING_SERVICE_STATES = ["stopped", "starting", "running", "error"] as const;

/** Lifecycle state of a monitoring service; derived from {@link MONITORING_SERVICE_STATES}. */
export type MonitoringServiceState = (typeof MONITORING_SERVICE_STATES)[number];

export interface MonitoringServiceUrls {
  sso: string;
  nodeport: string;
  local?: string | undefined;
  public?: string | null | undefined;
}

export interface MonitoringServiceStatus {
  name: string;
  state: MonitoringServiceState;
  readyPods: number;
  totalPods: number;
  helmInstalled: boolean;
  urls?: MonitoringServiceUrls | undefined;
}

export interface GrafanaDashboardLink {
  uid: string;
  title: string;
  url: string;
  nodeportUrl: string;
  localUrl?: string | undefined;
  publicUrl?: string | null | undefined;
}

export interface MonitoringStackStatus {
  grafana: MonitoringServiceStatus;
  headlamp: MonitoringServiceStatus;
  prometheus: MonitoringServiceStatus;
  nodeExporter: MonitoringServiceStatus;
  kubeStateMetrics: MonitoringServiceStatus;
  blackboxExporter: MonitoringServiceStatus;
  dcgmExporter: MonitoringServiceStatus;
  dashboards: GrafanaDashboardLink[];
  error?: string | undefined;
}

export type SecretCategory = "api_key" | "token" | "password" | "other";

export type SecretAuditAction = "create" | "update_value" | "update_meta" | "delete" | "reveal" | "k8s_sync";

/**
 * Namespaces the dashboard is allowed to write Secrets into.
 *
 * Source of truth for {@link K8sSecretNamespace}, for the allowlist in
 * `lib/services/k8s-secrets.ts`, and for the doc comment on that file.
 */
export const K8S_SECRET_NAMESPACES = ["dev", "ai-inference"] as const;

/** Namespace a Secret may be synced to; derived from {@link K8S_SECRET_NAMESPACES}. */
export type K8sSecretNamespace = (typeof K8S_SECRET_NAMESPACES)[number];

export interface K8sSyncTarget {
  namespace: K8sSecretNamespace;
  secretName: string;
  key: string;
}

/**
 * The part of a Kubernetes Secret object the key-removal flow reads.
 *
 * `kubectl get secret -o json` returns the whole API object; only `data` drives
 * the delete-or-rewrite decision, and `metadata` is kept so a wrong secret can be
 * named in a diagnostic. Everything else is dropped at the boundary.
 */
export interface K8sSecretPayload {
  metadata?: { name?: string | undefined; namespace?: string | undefined } | undefined;
  data?: Record<string, string> | undefined;
}

export interface LabSecretMeta {
  id: string;
  name: string;
  category: SecretCategory;
  description: string | null;
  valueHint: string;
  k8sSync: K8sSyncTarget | null;
  createdAt: number;
  updatedAt: number;
  createdBy: string | null;
}

/**
 * Every section of the operator console, in navigation order.
 *
 * Single source of truth for the sidebar rail, the `[section]` route's
 * `generateStaticParams`, and the per-route document title. A slug listed here
 * with no matching module under `components/sections/`, or a module with no
 * entry here, fails `//dashboard:test` — this is the gate that would have
 * caught the sidebar silently losing the Agent Chat panel.
 */
export const DASHBOARD_SECTIONS = [
  "resources",
  "observability",
  "inference",
  "agent-chat",
  "storage",
  "tasks",
  "workspaces",
  "system",
  "utilities",
  "secrets"
] as const;

/** One console section route; derived from {@link DASHBOARD_SECTIONS}. */
export type DashboardSectionSlug = (typeof DASHBOARD_SECTIONS)[number];

/**
 * Sidebar groupings, in the order the rail renders them.
 *
 * Sections are clustered by the operator's intent rather than by the panel that
 * happens to implement them, so the rail reads as a task list.
 */
export const DASHBOARD_SECTION_GROUPS = ["observe", "serve", "data", "workloads", "operate"] as const;

/** Sidebar group label; derived from {@link DASHBOARD_SECTION_GROUPS}. */
export type DashboardSectionGroup = (typeof DASHBOARD_SECTION_GROUPS)[number];
