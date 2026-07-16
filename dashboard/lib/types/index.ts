/** Shared dashboard domain types. */

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
  name?: string;
  status?: string;
  lastRun?: string;
  error?: string;
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

export type DevWorkspaceName = "coder" | "kasm";

export type DevWorkspaceState = "stopped" | "starting" | "running" | "stopping" | "error";

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
  error?: string;
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
  cpu: string;
  memory: string;
}

export interface ClusterCapacity {
  node_count: number;
  allocatable: ResourceAmount;
  requested: ResourceAmount;
  headroom: { cpu: number; memory: number };
  free: ResourceAmount;
  available: ResourceAmount;
  utilization: { gpu_pct: number; cpu_pct: number; memory_pct: number };
  error?: string;
}

export interface CapacityCheck {
  ok: boolean;
  verdict: string;
  action: string;
  heavy?: boolean;
  required: ResourceAmount;
  available: ResourceAmount;
  deficit: Partial<ResourceAmount>;
}

export interface FreeResourceSuggestion {
  id: string;
  label: string;
  action: string;
  reversible: boolean;
  impact: string;
  applicable: boolean;
  frees: Partial<ResourceAmount & { gpus_note?: string }>;
}

export type InferenceModelName =
  | "kimi-test"
  | "kimi"
  | "ray-head"
  | "nemotron-3-ultra"
  | "nemotron-3-nano-30b"
  | "nemotron-3-nano-omni-30b"
  | "nemotron-3-super-120b"
  | "nemotron-retriever-embed"
  | "nemotron-retriever-rerank"
  | "nemotron-parse"
  | "nemotron-safety-guard"
  | "nemotron-speech-asr"
  | "nemotron-speech-tts"
  | "glm-5.2"
  | "qwen3.5-122b-a10b-nvfp4"
  | "qwen3.5-397b-spark2"
  | "qwen3.5-397b-nvfp4"
  | "qwen3.6-27b-nvfp4"
  | "qwen3.6-35b-a3b-nvfp4";

export type NemotronStackId =
  | "nemotron-agentic-spark-1"
  | "nemotron-agentic-spark-1-reasoning"
  | "nemotron-agentic-spark-2-agent"
  | "nemotron-agentic-spark-2-reasoning"
  | "nemotron-agentic-spark-3"
  | "nemotron-agentic-spark-4"
  | "qwen-agentic-spark-1"
  | "qwen-agentic-spark-2"
  | "qwen-agentic-spark-4"
  | "qwen36-dual-spark-1";

export interface NemotronStackPreset {
  label: string;
  min_nodes?: number;
  max_nodes?: number;
  heavy?: boolean;
  tier?: string;
  description?: string;
  stack_with?: string[];
  startup_order?: string[];
  pillars?: string[];
  quality_notes?: string;
}

export interface NemotronCatalogModel {
  display_name: string;
  family: string;
  runtime: string;
  agent_roles?: string[];
  openai_svc?: string;
  port?: number;
  cpu_only?: boolean;
}

export interface QwenTierInfo {
  model?: string;
  hf_path?: string;
  rationale?: string;
}

export interface NemotronCatalog {
  models: Record<string, NemotronCatalogModel>;
  pillars: Record<string, { label: string; icon: string }>;
  stacks: Record<string, NemotronStackPreset>;
  qwen_tiers?: {
    frontier_target?: string;
    spark_1?: QwenTierInfo;
    spark_2?: QwenTierInfo;
    spark_4?: QwenTierInfo;
  };
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

export type InferenceJobState = "absent" | "running" | "succeeded" | "failed" | "error";

export interface InferenceJobInfo {
  model: InferenceModelName | string;
  job: string;
  active?: number;
  succeeded?: number;
  failed?: number;
  state: InferenceJobState;
  error?: string;
}

export interface InferenceWorkloadsStatus {
  jobs: InferenceJobInfo[];
  namespace: string;
  error?: string;
}

export type OpenWebUIState = "stopped" | "starting" | "running";

export interface OpenWebUIBackendStatus {
  url: string;
  reachable: boolean;
  endpoint_ip?: string;
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
    local?: string;
    public?: string | null;
  };
  backend: {
    hermes_gateway: OpenWebUIBackendStatus;
  };
  prerequisites: {
    hermes_stack: string;
  };
  error?: string;
}

export interface OpenWebUICatalog {
  helm: Record<string, string>;
  ports: Record<string, number>;
  sso: Record<string, string>;
  backends: Record<string, unknown>;
  stacks: Record<string, { label: string; description?: string; requires_hermes_stack?: string }>;
}

export type MonitoringServiceState = "stopped" | "starting" | "running" | "error";

export interface MonitoringServiceUrls {
  sso: string;
  nodeport: string;
  local?: string;
  public?: string | null;
}

export interface MonitoringServiceStatus {
  name: string;
  state: MonitoringServiceState;
  readyPods: number;
  totalPods: number;
  helmInstalled: boolean;
  urls?: MonitoringServiceUrls;
}

export interface GrafanaDashboardLink {
  uid: string;
  title: string;
  url: string;
  nodeportUrl: string;
  localUrl?: string;
  publicUrl?: string | null;
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
  error?: string;
}

export type SecretCategory = "api_key" | "token" | "password" | "other";

export type SecretAuditAction = "create" | "update_value" | "update_meta" | "delete" | "reveal" | "k8s_sync";

export interface K8sSyncTarget {
  namespace: "dev" | "ai-inference";
  secretName: string;
  key: string;
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
