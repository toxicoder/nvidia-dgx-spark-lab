/**
 * Validated parsing of JSON emitted by the lab's shell utilities.
 *
 * Every service under `lib/services/` used to write `JSON.parse(stdout) as T`,
 * which tells the compiler a shape without ever proving it. The worst instance
 * was `checkCapacity`: its `CapacityCheck` gates heavy GPU workload starts behind
 * the Resource Guard, so a renamed key in `scripts/utilities/cluster-resources.sh`
 * turned the gate into `{ ok: undefined }` and let a start through unblocked.
 *
 * Here the zod schema is the definition and the parse is the proof. The domain
 * types in `lib/types` are the single source for the closed sets, so a schema and
 * a type cannot disagree.
 */
import { z } from "zod";
import {
  CAPACITY_VERDICTS,
  DEV_WORKSPACE_NAMES,
  DEV_WORKSPACE_STATES,
  INFERENCE_JOB_STATES,
  K8S_NAMESPACE_NAMES,
  MONITORING_SERVICE_STATES,
  OPEN_WEBUI_STATES
} from "@/lib/types";
import type {
  CapacityCheck,
  ClusterCapacity,
  DevWorkspacesStatus,
  DockerContainer,
  DockerListResult,
  FreeResourceSuggestion,
  InferenceWorkloadsStatus,
  K8sSecretPayload,
  MonitoringStackStatus,
  NemotronCatalog,
  NemotronStackStatus,
  OpenWebUICatalog,
  OpenWebUIStatus,
  UtilityStatus
} from "@/lib/types";

/**
 * A Kubernetes quantity (`"600m"`, `"24Gi"`, or a bare number) normalised to the
 * string form the domain types use. Utilities may emit either; the dashboard
 * displays and re-parses strings.
 */
const QuantitySchema = z.union([z.string(), z.number()]).transform((value) => String(value));

const ResourceAmountSchema = z.object({
  gpus: z.number(),
  cpu: QuantitySchema,
  memory: QuantitySchema
});

/**
 * A capacity snapshot as printed by `cluster-resources.sh status --json`.
 *
 * Unknown keys are stripped rather than passed through: everything the dashboard
 * renders is declared here, so an undeclared key is either dead weight or a
 * rename the schema should have caught.
 */
export const ClusterCapacitySchema = z.object({
  node_count: z.number(),
  allocatable: ResourceAmountSchema,
  requested: ResourceAmountSchema,
  headroom: z.object({ cpu: z.number(), memory: z.number() }),
  free: ResourceAmountSchema,
  available: ResourceAmountSchema,
  utilization: z.object({
    gpu_pct: z.number(),
    cpu_pct: z.number(),
    memory_pct: z.number()
  }),
  error: z.string().optional()
});

/** The verdict a Resource Guard check can report. Derived, never re-listed. */
export const CapacityVerdictSchema = z.enum(CAPACITY_VERDICTS);

/** An all-zero triple, substituted when a rejection payload carries no totals. */
const ZERO_AMOUNT = { gpus: 0, cpu: "0", memory: "0" };

/**
 * A Resource Guard verdict as printed by `cluster-resources.sh check --json`.
 *
 * `required`/`available` default to a zero triple because the utility omits them
 * when it rejects before totalling resources (`unknown_model`, `unknown_stack`,
 * `insufficient_nodes`, `too_many_nodes`). Filling them at the boundary is what
 * lets a renderer read `.gpus` unguarded; the verdict string itself is never
 * rewritten, so the UI still explains the real reason it refused.
 */
export const CapacityCheckSchema = z.object({
  ok: z.boolean(),
  verdict: CapacityVerdictSchema,
  action: z.string(),
  heavy: z.boolean().optional(),
  required: ResourceAmountSchema.default(ZERO_AMOUNT),
  available: ResourceAmountSchema.default(ZERO_AMOUNT),
  deficit: z
    .object({
      gpus: z.number().optional(),
      cpu: QuantitySchema.optional(),
      memory: QuantitySchema.optional()
    })
    .default({})
});

/** One row of `cluster-resources.sh suggest --json`. */
export const FreeResourceSuggestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  action: z.string(),
  reversible: z.boolean(),
  impact: z.string(),
  applicable: z.boolean(),
  // Validated without normalising: FreesValue deliberately admits both `0` and
  // "all", so a String() transform here would rewrite data the domain type allows.
  frees: z.record(z.string(), z.union([z.string(), z.number()]))
});

/** The lifecycle state an inference Job can report. Derived, never re-listed. */
export const InferenceJobStateSchema = z.enum(INFERENCE_JOB_STATES);

/**
 * One row of `inference-workloads.sh status --json`.
 *
 * `model` stays an open `string`: a Job can outlive a catalog edit, and rejecting
 * the whole payload over one unrecognised name would blank the panel the operator
 * needs most in that situation. Callers narrow with `isInferenceModelName`.
 */
export const InferenceJobInfoSchema = z.object({
  model: z.string(),
  job: z.string(),
  active: z.number().optional(),
  succeeded: z.number().optional(),
  failed: z.number().optional(),
  state: InferenceJobStateSchema,
  error: z.string().optional()
});

/** The full inference/visual workload status payload. */
export const InferenceWorkloadsStatusSchema = z.object({
  jobs: z.array(InferenceJobInfoSchema),
  namespace: z.string(),
  error: z.string().optional()
});

/** One line of `docker ps --format '{{json .}}'`. */
export const DockerContainerSchema = z.object({
  ID: z.string(),
  Names: z.string(),
  Status: z.string(),
  Image: z.string()
});

/** One dev workspace as printed by `dev-workspaces.sh status --json`. */
export const DevWorkspaceInfoSchema = z.object({
  name: z.enum(DEV_WORKSPACE_NAMES),
  state: z.enum(DEV_WORKSPACE_STATES),
  readyPods: z.number(),
  totalPods: z.number(),
  url: z.string(),
  helmInstalled: z.boolean()
});

/**
 * Both workspaces are required: the panel renders a row per workspace, so a half
 * payload means a broken utility rather than a workspace that is merely absent.
 */
export const DevWorkspacesStatusSchema = z.object({
  coder: DevWorkspaceInfoSchema,
  kasm: DevWorkspaceInfoSchema,
  error: z.string().optional()
});

/** SSO/nodePort/local/public URL block shared by the monitoring and Open WebUI stacks. */
const ServiceUrlsSchema = z.object({
  sso: z.string(),
  nodeport: z.string(),
  local: z.string().optional(),
  public: z.string().nullable().optional()
});

/** One monitoring service as printed by `monitoring-stack.sh status --json`. */
export const MonitoringServiceStatusSchema = z.object({
  name: z.string(),
  state: z.enum(MONITORING_SERVICE_STATES),
  readyPods: z.number(),
  totalPods: z.number(),
  helmInstalled: z.boolean(),
  urls: ServiceUrlsSchema.optional()
});

/** One Grafana dashboard link. */
export const GrafanaDashboardLinkSchema = z.object({
  uid: z.string(),
  title: z.string(),
  url: z.string(),
  nodeportUrl: z.string(),
  localUrl: z.string().optional(),
  publicUrl: z.string().nullable().optional()
});

/** The monitoring stack status payload. */
export const MonitoringStackStatusSchema = z.object({
  grafana: MonitoringServiceStatusSchema,
  headlamp: MonitoringServiceStatusSchema,
  prometheus: MonitoringServiceStatusSchema,
  nodeExporter: MonitoringServiceStatusSchema,
  kubeStateMetrics: MonitoringServiceStatusSchema,
  blackboxExporter: MonitoringServiceStatusSchema,
  dcgmExporter: MonitoringServiceStatusSchema,
  dashboards: z.array(GrafanaDashboardLinkSchema),
  error: z.string().optional()
});

/**
 * A utility's `status --json` payload.
 *
 * The four keys every utility's `status` contract promises are validated; the
 * rest of the document is utility-specific (see each script's `# @command`
 * header) and passes through untouched, which is what the index signature on
 * `UtilityStatus` already records. `z.unknown()` is the honest type for "whatever
 * this particular utility prints", and nothing renders those keys generically.
 */
export const UtilityStatusSchema = z
  .object({
    name: z.string().optional(),
    status: z.string().optional(),
    lastRun: z.string().optional(),
    error: z.string().optional()
  })
  .catchall(z.unknown());

/** One model entry of `nemotron-stack.sh catalog --json`. */
export const NemotronCatalogModelSchema = z.object({
  display_name: z.string(),
  family: z.string(),
  runtime: z.string(),
  agent_roles: z.array(z.string()).optional(),
  openai_svc: z.string().optional(),
  port: z.number().optional(),
  cpu_only: z.boolean().optional()
});

/** One stack preset of the Nemotron catalog. */
export const NemotronStackPresetSchema = z.object({
  label: z.string(),
  min_nodes: z.number().optional(),
  max_nodes: z.number().optional(),
  heavy: z.boolean().optional(),
  tier: z.string().optional(),
  description: z.string().optional(),
  stack_with: z.array(z.string()).optional(),
  startup_order: z.array(z.string()).optional(),
  pillars: z.array(z.string()).optional(),
  quality_notes: z.string().optional()
});

/** One Spark-size tier of the Nemotron catalog. */
export const QwenTierInfoSchema = z.object({
  model: z.string().optional(),
  hf_path: z.string().optional(),
  rationale: z.string().optional()
});

/** The Nemotron catalog payload: models, pillars, presets, and optional tiers. */
export const NemotronCatalogSchema = z.object({
  models: z.record(z.string(), NemotronCatalogModelSchema),
  pillars: z.record(z.string(), z.object({ label: z.string(), icon: z.string() })),
  stacks: z.record(z.string(), NemotronStackPresetSchema),
  qwen_tiers: z
    .object({
      frontier_target: z.string().optional(),
      spark_1: QwenTierInfoSchema.optional(),
      spark_2: QwenTierInfoSchema.optional(),
      spark_4: QwenTierInfoSchema.optional()
    })
    .optional()
});

/**
 * One component of a running Nemotron stack.
 *
 * `state` stays an open `string`: it carries the Kubernetes Deployment condition
 * the utility read through verbatim, which has more values than the dashboard
 * branches on, and collapsing it to an enum would throw away the reason a stack is
 * unhealthy. The closed sets in this file are all values the *utility* computes.
 */
export const NemotronStackComponentStatusSchema = z.object({
  model: z.string(),
  state: z.string()
});

/** Health of one Nemotron stack. */
export const NemotronStackHealthSchema = z.object({
  id: z.string(),
  label: z.string(),
  healthy: z.boolean(),
  components: z.array(NemotronStackComponentStatusSchema)
});

/** The Nemotron stack status payload. */
export const NemotronStackStatusSchema = z.object({
  stacks: z.array(NemotronStackHealthSchema),
  namespace: z.string()
});

/** Reachability of one Open WebUI backend. */
export const OpenWebUIBackendStatusSchema = z.object({
  url: z.string(),
  reachable: z.boolean(),
  endpoint_ip: z.string().optional()
});

/** The Open WebUI status payload. */
export const OpenWebUIStatusSchema = z.object({
  release: z.string(),
  namespace: z.string(),
  state: z.enum(OPEN_WEBUI_STATES),
  helm_installed: z.boolean(),
  pod_ready: z.boolean(),
  urls: ServiceUrlsSchema,
  backend: z.object({ hermes_gateway: OpenWebUIBackendStatusSchema }),
  prerequisites: z.object({ hermes_stack: z.string() }),
  error: z.string().optional()
});

/**
 * One backend of `config/open-webui-policy.json` as read through the utility.
 *
 * `namespace` is enum-validated against the namespaces the dashboard is allowed to
 * name, so a policy file that points at an unlisted namespace is rejected here with
 * the utility named, rather than reaching `kubectl` through a string. `port` is
 * plain `number` because `PortNumber` is a documentation alias over it.
 */
export const OpenWebUIBackendSchema = z.object({
  service: z.string(),
  namespace: z.enum(K8S_NAMESPACE_NAMES),
  port: z.number(),
  path: z.string(),
  requires_hermes_stack: z.string().optional()
});

/** The Open WebUI catalog payload. */
export const OpenWebUICatalogSchema = z.object({
  helm: z.record(z.string(), z.string()),
  ports: z.record(z.string(), z.number()),
  sso: z.record(z.string(), z.string()),
  backends: z.record(z.string(), OpenWebUIBackendSchema),
  stacks: z.record(
    z.string(),
    z.object({
      label: z.string(),
      description: z.string().optional(),
      requires_hermes_stack: z.string().optional()
    })
  )
});

/** The part of a `kubectl get secret -o json` document the key-removal flow reads. */
export const K8sSecretPayloadSchema = z.object({
  metadata: z.object({ name: z.string().optional(), namespace: z.string().optional() }).optional(),
  data: z.record(z.string(), z.string()).optional()
});

/** Raised when a utility's stdout does not match the shape the dashboard assumes. */
export class CliPayloadError extends Error {
  /**
   * @param utility - Name of the utility whose output was rejected.
   * @param reason - Human-readable summary of the schema failures.
   */
  constructor(
    readonly utility: string,
    readonly reason: string
  ) {
    super(`${utility} returned a payload the dashboard cannot use: ${reason}`);
    this.name = "CliPayloadError";
  }
}

/**
 * Summarise zod failures as a compact, log-safe string.
 * @param issues - Issues reported by `z.ZodError`.
 * @returns A semicolon-joined `path: message` list.
 */
function describeIssues(issues: z.ZodIssue[]): string {
  return issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`).join("; ");
}

/**
 * Parse one JSON document from a utility, proving it matches `schema`.
 *
 * @param schema - The shape the caller needs.
 * @param stdout - Raw stdout from the utility.
 * @param utility - Utility name, used in the error message.
 * @returns The validated payload.
 * @throws CliPayloadError When `stdout` is not JSON, or is JSON of the wrong shape.
 */
export function parseCliJson<T>(schema: z.ZodType<T>, stdout: string, utility: string): T {
  let raw: unknown;
  try {
    raw = JSON.parse(stdout) as unknown;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    throw new CliPayloadError(utility, `stdout is not JSON (${message})`);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new CliPayloadError(utility, describeIssues(parsed.error.issues));
  }
  return parsed.data;
}

/**
 * Parse a Resource Guard verdict.
 * @param stdout - Raw stdout from `cluster-resources.sh check --json`.
 * @param utility - Utility name for diagnostics.
 * @returns A verdict whose totals are always present.
 * @throws CliPayloadError When the payload is unusable. A missing `ok` or
 *   `verdict` is rejected rather than defaulted, so a broken gate can never read
 *   as "allowed".
 */
export function parseCapacityCheck(stdout: string, utility: string): CapacityCheck {
  return parseCliJson(CapacityCheckSchema, stdout, utility);
}

/**
 * Parse a cluster capacity snapshot.
 * @param stdout - Raw stdout from `cluster-resources.sh status --json`.
 * @param utility - Utility name for diagnostics.
 * @returns The validated snapshot.
 * @throws CliPayloadError When the payload is unusable.
 */
export function parseClusterCapacity(stdout: string, utility: string): ClusterCapacity {
  return parseCliJson(ClusterCapacitySchema, stdout, utility);
}

/**
 * Parse the free-resource suggestions list.
 * @param stdout - Raw stdout from `cluster-resources.sh suggest --json`.
 * @param utility - Utility name for diagnostics.
 * @returns One row per applicable suggestion.
 * @throws CliPayloadError When the payload is unusable.
 */
export function parseFreeResourceSuggestions(stdout: string, utility: string): FreeResourceSuggestion[] {
  return parseCliJson(z.array(FreeResourceSuggestionSchema), stdout, utility);
}

/**
 * Parse the inference/visual workload status.
 * @param stdout - Raw stdout from `inference-workloads.sh status --json`.
 * @param utility - Utility name for diagnostics.
 * @returns The validated status payload.
 * @throws CliPayloadError When the payload is unusable. A payload whose `jobs` is
 *   absent or malformed is rejected rather than read as an empty list, so the
 *   panel cannot render "nothing is deployed" when the truth is unknown.
 */
export function parseInferenceWorkloadsStatus(stdout: string, utility: string): InferenceWorkloadsStatus {
  return parseCliJson(InferenceWorkloadsStatusSchema, stdout, utility);
}

/**
 * Parse a whole `docker ps --format '{{json .}}'` document.
 *
 * `listContainers` reports a bad payload as a value (`{ error }`) rather than by
 * throwing, because its callers branch on the `DockerListResult` union to show a
 * friendly panel state. That contract is why this one parser returns instead of
 * raising, and why it distinguishes "not JSON" from "not the shape we render".
 * @param stdout - Raw stdout from `docker ps`, one JSON object per line.
 * @param utility - Command name for diagnostics.
 * @returns The containers, or the reason the first unusable line was rejected.
 */
export function parseDockerContainers(stdout: string, utility: string): DockerListResult {
  const containers: DockerContainer[] = [];
  for (const line of stdout.trim().split("\n").filter(Boolean)) {
    let raw: unknown;
    try {
      raw = JSON.parse(line) as unknown;
    } catch {
      return { error: `${utility} returned a line that is not JSON` };
    }
    const parsed = DockerContainerSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        error: `${utility} returned a payload the dashboard cannot use: ${describeIssues(parsed.error.issues)}`
      };
    }
    containers.push(parsed.data);
  }
  return containers;
}

/**
 * Parse the dev workspace status.
 * @param stdout - Raw stdout from `dev-workspaces.sh status --json`.
 * @param utility - Utility name for diagnostics.
 * @returns The validated status payload.
 * @throws CliPayloadError When either workspace row is missing or malformed.
 */
export function parseDevWorkspacesStatus(stdout: string, utility: string): DevWorkspacesStatus {
  return parseCliJson(DevWorkspacesStatusSchema, stdout, utility);
}

/**
 * Parse the monitoring stack status.
 * @param stdout - Raw stdout from `monitoring-stack.sh status --json`.
 * @param utility - Utility name for diagnostics.
 * @returns The validated status payload.
 * @throws CliPayloadError When the payload is unusable.
 */
export function parseMonitoringStackStatus(stdout: string, utility: string): MonitoringStackStatus {
  return parseCliJson(MonitoringStackStatusSchema, stdout, utility);
}

/**
 * Parse a utility's generic `status --json` document.
 * @param stdout - Raw stdout from `<utility> status --json`.
 * @param utility - Utility name for diagnostics.
 * @returns The validated document, utility-specific keys included.
 * @throws CliPayloadError When one of the four contract keys holds the wrong type.
 */
export function parseUtilityStatus(stdout: string, utility: string): UtilityStatus {
  return parseCliJson(UtilityStatusSchema, stdout, utility);
}

/**
 * Parse the Nemotron catalog.
 * @param stdout - Raw stdout from `nemotron-stack.sh catalog --json`.
 * @param utility - Utility name for diagnostics.
 * @returns The validated catalog.
 * @throws CliPayloadError When the payload is unusable.
 */
export function parseNemotronCatalog(stdout: string, utility: string): NemotronCatalog {
  return parseCliJson(NemotronCatalogSchema, stdout, utility);
}

/**
 * Parse the Nemotron stack health.
 * @param stdout - Raw stdout from `nemotron-stack.sh status --json`.
 * @param utility - Utility name for diagnostics.
 * @returns The validated health payload.
 * @throws CliPayloadError When the payload is unusable.
 */
export function parseNemotronStackStatus(stdout: string, utility: string): NemotronStackStatus {
  return parseCliJson(NemotronStackStatusSchema, stdout, utility);
}

/**
 * Parse the Open WebUI catalog.
 * @param stdout - Raw stdout from `open-webui-stack.sh catalog --json`.
 * @param utility - Utility name for diagnostics.
 * @returns The validated catalog.
 * @throws CliPayloadError When the payload is unusable.
 */
export function parseOpenWebUICatalog(stdout: string, utility: string): OpenWebUICatalog {
  return parseCliJson(OpenWebUICatalogSchema, stdout, utility);
}

/**
 * Parse the Open WebUI status.
 * @param stdout - Raw stdout from `open-webui-stack.sh status --json`.
 * @param utility - Utility name for diagnostics.
 * @returns The validated status payload.
 * @throws CliPayloadError When the payload is unusable.
 */
export function parseOpenWebUIStatus(stdout: string, utility: string): OpenWebUIStatus {
  return parseCliJson(OpenWebUIStatusSchema, stdout, utility);
}

/**
 * Parse the `kubectl get secret -o json` document the key-removal flow reads.
 * @param stdout - Raw stdout from `kubectl get secret -o json`.
 * @param utility - Command name for diagnostics.
 * @returns The validated payload; `data` is absent for a Secret with no keys.
 * @throws CliPayloadError When the document is unusable. A `data` map holding a
 *   non-string value is rejected rather than coerced, because the value is passed
 *   straight back to `kubectl` when the Secret is rewritten.
 */
export function parseK8sSecretPayload(stdout: string, utility: string): K8sSecretPayload {
  return parseCliJson(K8sSecretPayloadSchema, stdout, utility);
}
