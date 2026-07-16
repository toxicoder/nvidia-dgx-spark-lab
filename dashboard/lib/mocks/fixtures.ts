/**
 * Mock data for dashboard unit tests and visual golden renders (USE_MOCKS=1).
 * Production services import from here — not from tests/.
 */
import type {
  ClusterCapacity,
  CapacityCheck,
  InferenceWorkloadsStatus,
  LabSecretMeta,
  NemotronCatalog,
  NemotronStackStatus,
  MonitoringStackStatus,
  OpenWebUICatalog,
  OpenWebUIStatus,
  TreeNode
} from "@/lib/types";

export const fakeMachineIdentity = {
  hostname: "spark0",
  nvidia: "NVIDIA GB10 / DGX Spark (mock driver)"
};

/**
 * DGX Spark per-node baseline (GB10 Grace Blackwell SoC) — see root AGENTS.md.
 * 2-node lab allocatable after kubelet reservations (system 4 CPU + 64Gi, kube 2 CPU + 8Gi).
 */
const SPARK_NODES = 2;
const SPARK_ALLOCATABLE = { gpus: SPARK_NODES, cpu: 14 * SPARK_NODES, memoryGi: 56 * SPARK_NODES };
/** Policy headroom: max(4 CPU, 15%) and max(64Gi, 15%) per node — mirrors resource-policy.json. */
const SPARK_HEADROOM = { cpu: 4 * SPARK_NODES, memoryBytes: 64 * 1073741824 * SPARK_NODES };

export const fakeServices = {
  services: ["docker.service (mock)", "k3s.service (mock)", "ollama.service (mock)"]
};

export const fakePackages = {
  packages: ["k3s (mock)", "docker (mock)", "nvidia-driver (mock)"]
};

export const fakeContainers = [
  { ID: "abc123", Names: "kimi-test", Status: "Up 2 hours", Image: "vllm" },
  { ID: "def456", Names: "storage", Status: "Up 1 hour", Image: "minio" }
];

export const fakeOllamaRaw =
  "NAME\tID\tSIZE\tMODIFIED\nllama3\tabc\t4.7GB\t2 weeks ago (mock)\nkimi-test\tdef\t8.2GB\t1 week ago (mock)";

export const fakeOllama = { raw: fakeOllamaRaw };

/** Balanced tree for Playwright goldens (VISUAL_TEST=1) — legible treemap mosaic. */
export const fakeVisualTree: TreeNode = {
  name: "models",
  path: "/mnt/models",
  size: 0,
  isDir: true,
  children: [
    {
      name: "llama-3-70b",
      path: "/mnt/models/llama-3-70b",
      size: 8_000_000_000,
      isDir: true,
      children: [
        {
          name: "model.gguf",
          path: "/mnt/models/llama-3-70b/model.gguf",
          size: 8_000_000_000,
          isDir: false,
          ext: "gguf"
        }
      ]
    },
    {
      name: "mistral-7b.gguf",
      path: "/mnt/models/mistral-7b.gguf",
      size: 4_200_000_000,
      isDir: false,
      ext: "gguf"
    },
    {
      name: "qwen-14b",
      path: "/mnt/models/qwen-14b",
      size: 7_000_000_000,
      isDir: true,
      children: [
        {
          name: "weights.safetensors",
          path: "/mnt/models/qwen-14b/weights.safetensors",
          size: 7_000_000_000,
          isDir: false,
          ext: "safetensors"
        }
      ]
    },
    {
      name: "mixtral-8x7b",
      path: "/mnt/models/mixtral-8x7b",
      size: 6_000_000_000,
      isDir: true,
      children: []
    },
    {
      name: "phi-3-mini.gguf",
      path: "/mnt/models/phi-3-mini.gguf",
      size: 5_000_000_000,
      isDir: false,
      ext: "gguf"
    },
    {
      name: "data-cache.bin",
      path: "/mnt/models/data-cache.bin",
      size: 500_000_000,
      isDir: false,
      ext: "bin"
    },
    {
      name: "small1.bin",
      path: "/mnt/models/small1.bin",
      size: 100_000_000,
      isDir: false,
      ext: "bin"
    },
    {
      name: "small2.bin",
      path: "/mnt/models/small2.bin",
      size: 80_000_000,
      isDir: false,
      ext: "bin"
    },
    {
      name: "tiny",
      path: "/mnt/models/tiny",
      size: 20_000_000,
      isDir: false,
      ext: "bin"
    },
    {
      name: "medium-a.safetensors",
      path: "/mnt/models/medium-a.safetensors",
      size: 1_200_000_000,
      isDir: false,
      ext: "safetensors"
    },
    {
      name: "medium-b.pt",
      path: "/mnt/models/medium-b.pt",
      size: 950_000_000,
      isDir: false,
      ext: "pt"
    }
  ]
};

fakeVisualTree.size = fakeVisualTree.children?.reduce((sum, c) => sum + (c.size || 0), 0) ?? 0;

export const fakeEmptyDuplicates = { groups: [] as { size: number; files: string[] }[] };

export const fakeTree: TreeNode = {
  name: "models",
  path: "/mnt/models",
  size: 1234567890,
  isDir: true,
  children: [
    {
      name: "llama-3-70b",
      path: "/mnt/models/llama-3-70b",
      size: 40000000000,
      isDir: true,
      children: [
        {
          name: "model.gguf",
          path: "/mnt/models/llama-3-70b/model.gguf",
          size: 40000000000,
          isDir: false,
          ext: "gguf"
        }
      ]
    },
    {
      name: "mistral-7b.gguf",
      path: "/mnt/models/mistral-7b.gguf",
      size: 4200000000,
      isDir: false,
      ext: "gguf"
    },
    {
      name: "data",
      path: "/mnt/models/data",
      size: 500000000,
      isDir: true,
      children: []
    },
    {
      name: "small1.bin",
      path: "/mnt/models/small1.bin",
      size: 100000000,
      isDir: false,
      ext: "bin"
    },
    {
      name: "small2.bin",
      path: "/mnt/models/small2.bin",
      size: 80000000,
      isDir: false,
      ext: "bin"
    },
    {
      name: "tiny",
      path: "/mnt/models/tiny",
      size: 20000000,
      isDir: false,
      ext: "bin"
    },
    {
      name: "medium-a.safetensors",
      path: "/mnt/models/medium-a.safetensors",
      size: 1200000000,
      isDir: false,
      ext: "safetensors"
    },
    {
      name: "medium-b.pt",
      path: "/mnt/models/medium-b.pt",
      size: 950000000,
      isDir: false,
      ext: "pt"
    }
  ]
};

export const fakeUtilities = [
  { name: "spark-clock", path: "scripts/utilities/spark-clock.sh" },
  { name: "system-update", path: "scripts/utilities/system-update.sh" },
  { name: "sync-ollama-models", path: "scripts/utilities/sync-ollama-models.sh" }
];

export const fakeUtilityStatus = {
  name: "spark-clock",
  status: "ok (mock)",
  lastRun: "2026-06-24T12:00:00Z",
  target_mhz: 2200,
  floor_mhz: 300,
  ceiling_mhz: 2200,
  current_mhz: 208,
  locked: true,
  at_target: true,
  health: "ok",
  temperature_c: 68,
  power_w: 7.0,
  utilization_pct: 0,
  service: "ACTIVE"
};

/** Mostly idle 2-node Spark cluster — management/monitoring pods only (unit tests). */
export const fakeClusterCapacity: ClusterCapacity = {
  node_count: SPARK_NODES,
  allocatable: {
    gpus: SPARK_ALLOCATABLE.gpus,
    cpu: String(SPARK_ALLOCATABLE.cpu),
    memory: `${SPARK_ALLOCATABLE.memoryGi}Gi`
  },
  requested: { gpus: 0, cpu: "2.3", memory: "3.2Gi" },
  headroom: { cpu: SPARK_HEADROOM.cpu, memory: SPARK_HEADROOM.memoryBytes },
  free: { gpus: 2, cpu: "25.7", memory: "108.8Gi" },
  available: { gpus: 2, cpu: "17.7", memory: "0Gi" },
  utilization: { gpu_pct: 0, cpu_pct: 8.2, memory_pct: 2.9 }
};

/**
 * Busy 2-node DGX Spark lab for Playwright goldens (VISUAL_TEST=1).
 * kimi-test (2 GPU) saturates the cluster; Coder + monitoring add CPU/RAM requests.
 * Numbers mirror `cluster-resources.sh status --json` output shape.
 */
export const fakeVisualClusterCapacity: ClusterCapacity = {
  node_count: SPARK_NODES,
  allocatable: {
    gpus: SPARK_ALLOCATABLE.gpus,
    cpu: String(SPARK_ALLOCATABLE.cpu),
    memory: `${SPARK_ALLOCATABLE.memoryGi}Gi`
  },
  requested: { gpus: 2, cpu: "12.3", memory: "39.2Gi" },
  headroom: { cpu: SPARK_HEADROOM.cpu, memory: SPARK_HEADROOM.memoryBytes },
  free: { gpus: 0, cpu: "15.7", memory: "72.8Gi" },
  available: { gpus: 0, cpu: "7.7", memory: "0Gi" },
  utilization: { gpu_pct: 100, cpu_pct: 43.9, memory_pct: 35 }
};

export function mockClusterCapacity(): ClusterCapacity {
  return process.env.VISUAL_TEST === "1" ? fakeVisualClusterCapacity : fakeClusterCapacity;
}

export const fakeCapacityCheck: CapacityCheck = {
  ok: true,
  verdict: "ok",
  action: "model:kimi-test",
  heavy: false,
  required: { gpus: 2, cpu: "8", memory: "32Gi" },
  available: { gpus: 2, cpu: "17.7", memory: "0Gi" },
  deficit: {}
};

/** Full kimi (8 GPU manifest) blocked while kimi-test holds both Spark GPUs. */
export const fakeVisualCapacityCheck: CapacityCheck = {
  ok: false,
  verdict: "insufficient_gpu",
  action: "model:kimi",
  heavy: true,
  required: { gpus: 8, cpu: "32", memory: "128Gi" },
  available: { gpus: 0, cpu: "7.7", memory: "0Gi" },
  deficit: { gpus: 8 }
};

export function mockCapacityCheck(action: string): CapacityCheck {
  const base = process.env.VISUAL_TEST === "1" ? fakeVisualCapacityCheck : fakeCapacityCheck;
  return { ...base, action };
}

export const fakeFreeResourceSuggestions = [
  {
    id: "stop-coder",
    label: "Stop Coder workspaces",
    action: "dev:coder",
    reversible: true,
    impact: "Frees VS Code dev environments (~2 CPU, 4Gi RAM)",
    applicable: true,
    frees: { cpu: "2", memory: "4Gi", gpus: 0 }
  }
];

export const fakeInferenceWorkloadsStatus: InferenceWorkloadsStatus = {
  namespace: "ai-inference",
  jobs: [
    { model: "kimi-test", job: "kimi-test", active: 1, state: "running" },
    { model: "kimi", job: "kimi", active: 0, state: "absent" },
    { model: "ray-head", job: "ray-head", active: 0, state: "absent" },
    { model: "ray-worker", job: "ray-worker", active: 0, state: "absent" },
    { model: "nemotron-3-ultra", job: "nemotron-3-ultra", active: 0, state: "absent" },
    { model: "glm-5.2", job: "glm-5.2", active: 0, state: "absent" },
    { model: "glm-5.2-rpc", job: "glm-5.2-rpc", active: 0, state: "absent" }
  ]
};

/** Matches fakeVisualClusterCapacity — kimi-test validation job on a saturated 2-GPU cluster. */
export const fakeVisualInferenceWorkloadsStatus: InferenceWorkloadsStatus = {
  namespace: "ai-inference",
  jobs: [
    { model: "kimi-test", job: "kimi-test", active: 1, state: "running" },
    { model: "kimi", job: "kimi", active: 0, state: "absent" },
    { model: "ray-head", job: "ray-head", active: 0, state: "absent" },
    { model: "ray-worker", job: "ray-worker", active: 0, state: "absent" },
    { model: "nemotron-3-ultra", job: "nemotron-3-ultra", active: 0, state: "absent" },
    { model: "glm-5.2", job: "glm-5.2", active: 0, state: "absent" },
    { model: "glm-5.2-rpc", job: "glm-5.2-rpc", active: 0, state: "absent" }
  ]
};

export function mockInferenceWorkloadsStatus(): InferenceWorkloadsStatus {
  return process.env.VISUAL_TEST === "1" ? fakeVisualInferenceWorkloadsStatus : fakeInferenceWorkloadsStatus;
}

export const fakeNemotronCatalog: NemotronCatalog = {
  models: {
    "nemotron-3-nano-omni-30b": {
      display_name: "Nemotron 3 Nano Omni 30B",
      family: "multimodal",
      runtime: "vllm",
      openai_svc: "nemotron-3-nano-omni-30b",
      port: 8000
    },
    "nemotron-retriever-embed": {
      display_name: "Nemotron Retriever Embed",
      family: "retrieval",
      runtime: "nim",
      cpu_only: true,
      openai_svc: "nemotron-retriever-embed",
      port: 8000
    },
    "nemotron-safety-guard": {
      display_name: "Nemotron Safety",
      family: "safety",
      runtime: "nim",
      cpu_only: true,
      openai_svc: "nemotron-safety-guard",
      port: 8000
    }
  },
  pillars: {
    orchestrator: { label: "Orchestrator", icon: "brain" },
    document_intel: { label: "Document intel", icon: "file-text" },
    rag: { label: "RAG retrieval", icon: "search" },
    safety: { label: "Safety guard", icon: "shield" }
  },
  stacks: {
    "nemotron-agentic-spark-1": {
      label: "Full Agentic Stack (1× Spark)",
      min_nodes: 1,
      max_nodes: 1,
      heavy: true,
      description: "Omni orchestrator + CPU RAG + safety",
      stack_with: [
        "nemotron-3-nano-omni-30b",
        "nemotron-retriever-embed",
        "nemotron-retriever-rerank",
        "nemotron-safety-guard"
      ],
      pillars: ["orchestrator", "document_intel", "rag", "safety"],
      quality_notes: "~25 tok/s orchestrator"
    },
    "nemotron-agentic-spark-2-agent": {
      label: "Full Agentic — Dual Nano (2× Spark)",
      min_nodes: 2,
      max_nodes: 2,
      heavy: true,
      stack_with: ["nemotron-3-nano-30b", "nemotron-3-nano-omni-30b"],
      pillars: ["orchestrator", "document_intel", "rag", "safety"]
    },
    "nemotron-agentic-spark-2-reasoning": {
      label: "Full Agentic — Super + Nano (2× Spark)",
      min_nodes: 2,
      max_nodes: 2,
      heavy: true,
      stack_with: ["nemotron-3-super-120b", "nemotron-3-nano-30b"],
      pillars: ["orchestrator", "document_intel", "rag", "safety", "speech"]
    },
    "nemotron-agentic-spark-3": {
      label: "Full Agentic Stack (3× Spark)",
      min_nodes: 3,
      max_nodes: 3,
      heavy: true,
      stack_with: [],
      pillars: ["orchestrator", "document_intel", "rag", "safety", "speech"]
    },
    "nemotron-agentic-spark-4": {
      label: "Full Agentic Stack (4× Spark)",
      min_nodes: 4,
      max_nodes: 4,
      heavy: true,
      stack_with: [],
      pillars: ["orchestrator", "document_intel", "rag", "safety", "speech"]
    },
    "qwen-agentic-spark-1": {
      label: "Qwen 3.5 NVFP4 + RAG (1× Spark)",
      min_nodes: 1,
      max_nodes: 1,
      heavy: true,
      description: "Qwen 122B NVFP4 orchestrator + CPU RAG + safety",
      stack_with: [
        "qwen3.5-122b-a10b-nvfp4",
        "nemotron-retriever-embed",
        "nemotron-retriever-rerank",
        "nemotron-safety-guard"
      ],
      pillars: ["orchestrator", "rag", "safety"],
      quality_notes: "122B NVFP4 substitute for 397B NVFP4"
    },
    "qwen-agentic-spark-2": {
      label: "Qwen 397B + RAG (2× Spark)",
      min_nodes: 2,
      max_nodes: 2,
      heavy: true,
      stack_with: ["qwen3.5-397b-spark2"],
      pillars: ["orchestrator", "rag", "safety"]
    },
    "qwen-agentic-spark-4": {
      label: "Qwen 397B NVFP4 + RAG (4× Spark)",
      min_nodes: 4,
      max_nodes: 4,
      heavy: true,
      stack_with: ["qwen3.5-397b-nvfp4"],
      pillars: ["orchestrator", "rag", "safety"]
    },
    "qwen36-dual-spark-1": {
      label: "Qwen3.6 dual (27B + 35B-A3B NVFP4)",
      min_nodes: 1,
      max_nodes: 1,
      heavy: true,
      description: "Concurrent dense 27B + MoE 35B-A3B on one Spark via GPU time-slicing",
      stack_with: ["qwen3.6-27b-nvfp4", "qwen3.6-35b-a3b-nvfp4"],
      pillars: ["orchestrator"],
      quality_notes: "NVFP4 dual; mid ctx default; exclusive for 256K"
    }
  },
  qwen_tiers: {
    frontier_target: "nvidia/Qwen3.5-397B-A17B-NVFP4",
    spark_1: { model: "qwen3.5-122b-a10b-nvfp4", hf_path: "RedHatAI/Qwen3.5-122B-A10B-NVFP4" },
    spark_2: { model: "qwen3.5-397b-spark2", hf_path: "Intel/Qwen3.5-397B-A17B-int4-AutoRound" },
    spark_4: { model: "qwen3.5-397b-nvfp4", hf_path: "nvidia/Qwen3.5-397B-A17B-NVFP4" }
  }
};

export const fakeNemotronStackStatus: NemotronStackStatus = {
  namespace: "ai-inference",
  stacks: [
    {
      id: "nemotron-agentic-spark-1",
      label: "Full Agentic Stack (1× Spark)",
      healthy: false,
      components: [
        { model: "nemotron-3-nano-omni-30b", state: "absent" },
        { model: "nemotron-retriever-embed", state: "absent" },
        { model: "nemotron-safety-guard", state: "absent" }
      ]
    }
  ]
};

export function mockNemotronCatalog(): NemotronCatalog {
  return fakeNemotronCatalog;
}

export function mockNemotronStackStatus(): NemotronStackStatus {
  return fakeNemotronStackStatus;
}

export const fakeOpenWebUICatalog: OpenWebUICatalog = {
  helm: { release: "open-webui", namespace: "dev", chart: "open-webui" },
  ports: { nodeport: 32085, container: 8080, service: 80 },
  sso: { host: "chat" },
  backends: {
    hermes_gateway: { port: 8642, path: "/v1", requires_hermes_stack: "hermes-lab" }
  },
  stacks: {
    "open-webui-lab": {
      label: "Open WebUI (Hermes agent chat)",
      description: "Browser chat UI backed by Hermes gateway",
      requires_hermes_stack: "hermes-lab"
    }
  }
};

export const fakeOpenWebUIStatus: OpenWebUIStatus = {
  release: "open-webui",
  namespace: "dev",
  state: "stopped",
  helm_installed: false,
  pod_ready: false,
  urls: {
    sso: "https://chat.lab.local:32443",
    nodeport: "http://localhost:32085"
  },
  backend: {
    hermes_gateway: {
      url: "http://hermes-gateway.dev.svc.cluster.local:8642/v1",
      reachable: false,
      endpoint_ip: ""
    }
  },
  prerequisites: { hermes_stack: "hermes-lab" }
};

export function mockOpenWebUICatalog(): OpenWebUICatalog {
  return fakeOpenWebUICatalog;
}

export function mockOpenWebUIStatus(): OpenWebUIStatus {
  return fakeOpenWebUIStatus;
}

const grafanaDashboards = [
  { uid: "spark-overview", title: "Lab Overview", path: "/d/spark-overview" },
  { uid: "spark-nodes", title: "DGX Nodes", path: "/d/spark-nodes" },
  { uid: "spark-gpu", title: "GPU Cluster", path: "/d/spark-gpu" },
  { uid: "spark-k8s", title: "Kubernetes", path: "/d/spark-k8s" },
  { uid: "spark-inference", title: "Inference", path: "/d/spark-inference" },
  { uid: "spark-platform", title: "Platform Services", path: "/d/spark-platform" },
  { uid: "spark-dev-agent", title: "Dev & Agent Stack", path: "/d/spark-dev-agent" },
  { uid: "spark-storage-net", title: "Storage & Network", path: "/d/spark-storage-net" }
];

export const fakeMonitoringStackStatus: MonitoringStackStatus = {
  grafana: {
    name: "grafana",
    state: "running",
    readyPods: 1,
    totalPods: 1,
    helmInstalled: true,
    urls: { sso: "https://grafana.lab.local:32443", nodeport: "http://localhost:32083" }
  },
  headlamp: {
    name: "headlamp",
    state: "running",
    readyPods: 1,
    totalPods: 1,
    helmInstalled: true,
    urls: { sso: "https://headlamp.lab.local:32443", nodeport: "http://localhost:32084" }
  },
  prometheus: { name: "prometheus", state: "running", readyPods: 1, totalPods: 1, helmInstalled: true },
  nodeExporter: { name: "node-exporter", state: "running", readyPods: 2, totalPods: 2, helmInstalled: true },
  kubeStateMetrics: { name: "kube-state-metrics", state: "running", readyPods: 1, totalPods: 1, helmInstalled: true },
  blackboxExporter: { name: "blackbox-exporter", state: "running", readyPods: 1, totalPods: 1, helmInstalled: true },
  dcgmExporter: { name: "dcgm-exporter", state: "running", readyPods: 2, totalPods: 2, helmInstalled: true },
  dashboards: grafanaDashboards.map((d) => ({
    uid: d.uid,
    title: d.title,
    url: `https://grafana.lab.local:32443${d.path}?orgId=1&refresh=30s`,
    nodeportUrl: `http://localhost:32083${d.path}?orgId=1&refresh=30s`
  }))
};

export function mockMonitoringStackStatus(): MonitoringStackStatus {
  return fakeMonitoringStackStatus;
}

/** Metadata only — no ciphertext or real values. */
export const fakeSecrets: LabSecretMeta[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "hf-token",
    category: "api_key",
    description: "Hugging Face API token for model downloads",
    valueHint: "x7k9",
    k8sSync: {
      namespace: "ai-inference",
      secretName: "lab-hf-token",
      key: "HF_TOKEN"
    },
    createdAt: 1700000000000,
    updatedAt: 1700001000000,
    createdBy: "admin@lab.local"
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "openai-key",
    category: "api_key",
    description: "OpenAI API key for agentic stacks",
    valueHint: "ab12",
    k8sSync: null,
    createdAt: 1700002000000,
    updatedAt: 1700002000000,
    createdBy: "admin@lab.local"
  }
];

export const fakeDevWorkspacesStatus = {
  coder: {
    name: "coder" as const,
    state: "running" as const,
    readyPods: 1,
    totalPods: 1,
    url: "http://localhost:32080",
    helmInstalled: true
  },
  kasm: {
    name: "kasm" as const,
    state: "stopped" as const,
    readyPods: 0,
    totalPods: 0,
    url: "http://localhost:32081",
    helmInstalled: false
  }
};
