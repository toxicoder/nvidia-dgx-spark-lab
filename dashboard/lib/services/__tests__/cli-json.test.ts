/**
 * Tests for the boundary that turns utility stdout into domain types.
 *
 * The point of `cli-json.ts` is that a malformed payload fails loudly at the
 * edge instead of arriving as a half-shaped object. These tests hold both halves
 * of that: a good payload survives with its types intact, and every way a payload
 * can be wrong produces a `CliPayloadError` that names the offending field.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { CapacityCheck } from "@/lib/types";
import {
  CapacityCheckSchema,
  CapacityVerdictSchema,
  CliPayloadError,
  ClusterCapacitySchema,
  FreeResourceSuggestionSchema,
  parseCapacityCheck,
  parseCliJson,
  parseClusterCapacity,
  parseDevWorkspacesStatus,
  parseDockerContainers,
  parseFreeResourceSuggestions,
  parseK8sSecretPayload,
  parseMonitoringStackStatus,
  parseNemotronCatalog,
  parseNemotronStackStatus,
  parseOpenWebUICatalog,
  parseOpenWebUIStatus,
  parseUtilityStatus
} from "../cli-json";

const UTILITY = "cluster-resources.sh";

/** A Resource Guard verdict in the shape the utility actually prints. */
function validCheck(): Record<string, unknown> {
  return {
    ok: false,
    verdict: "insufficient_gpu",
    action: "model:kimi",
    heavy: true,
    required: { gpus: 8, cpu: "32", memory: "128Gi" },
    available: { gpus: 0, cpu: "7.7", memory: "0Gi" },
    deficit: { gpus: 8 }
  };
}

function validCapacity(): Record<string, unknown> {
  return {
    node_count: 1,
    allocatable: { gpus: 2, cpu: "20", memory: "119Gi" },
    requested: { gpus: 1, cpu: "8", memory: "32Gi" },
    headroom: { cpu: 15, memory: 15 },
    free: { gpus: 1, cpu: "12", memory: "87Gi" },
    available: { gpus: 1, cpu: "10", memory: "70Gi" },
    utilization: { gpu_pct: 50, cpu_pct: 40, memory_pct: 33 }
  };
}

function validSuggestion(): Record<string, unknown> {
  return {
    id: "stop-coder",
    label: "Stop Coder workspaces",
    action: "dev:coder",
    reversible: true,
    impact: "Frees dev environments",
    applicable: true,
    frees: { cpu: "2", memory: "4Gi", gpus: 0, gpus_note: "approx" }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseCliJson", () => {
  it("returns the payload when it matches the schema", () => {
    const schema = z.object({ name: z.string(), count: z.number() });
    const result = parseCliJson(schema, '{"name":"kimi","count":2}', UTILITY);
    expect(result).toEqual({ name: "kimi", count: 2 });
  });

  it("rejects stdout that is not JSON and says so", () => {
    expect(() => parseCliJson(z.object({ a: z.string() }), "not json", UTILITY)).toThrow(CliPayloadError);
    expect(() => parseCliJson(z.object({ a: z.string() }), "not json", UTILITY)).toThrow(/stdout is not JSON/);
  });

  it("names the utility and the failing field when the shape is wrong", () => {
    let error: unknown;
    try {
      parseCliJson(CapacityCheckSchema, JSON.stringify({ ok: true }), UTILITY);
    } catch (e: unknown) {
      error = e;
    }
    expect(error).toBeInstanceOf(CliPayloadError);
    const payloadError = error as CliPayloadError;
    expect(payloadError.utility).toBe(UTILITY);
    expect(payloadError.message).toContain(UTILITY);
    expect(payloadError.reason).toContain("verdict");
  });

  it("reports <root> when the whole document is the wrong kind", () => {
    let reason = "";
    try {
      parseCliJson(CapacityCheckSchema, '"just a string"', UTILITY);
    } catch (e: unknown) {
      reason = (e as CliPayloadError).reason;
    }
    expect(reason).toContain("<root>");
  });

  it("summarises a throw from the parser that is not an Error instance", () => {
    vi.spyOn(JSON, "parse").mockImplementation(() => {
      // Throwing a bare value is how the summariser is exercised: a utility can die
      // in a way that surfaces a non-Error, and the payload must still be reported.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw "raw string thrown";
    });
    expect(() => parseCliJson(z.object({ a: z.string() }), "{}", UTILITY)).toThrow(/raw string thrown/);
  });
});

describe("CapacityVerdictSchema", () => {
  it("accepts a verdict the domain type allows", () => {
    expect(CapacityVerdictSchema.safeParse("insufficient_gpu_memory").success).toBe(true);
  });

  it("rejects a verdict the domain type does not allow", () => {
    expect(CapacityVerdictSchema.safeParse("still_insufficient").success).toBe(false);
  });
});

describe("parseCapacityCheck", () => {
  it("passes a complete verdict through unchanged", () => {
    const check = parseCapacityCheck(JSON.stringify(validCheck()), UTILITY);
    expect(check).toEqual<CapacityCheck>({
      ok: false,
      verdict: "insufficient_gpu",
      action: "model:kimi",
      heavy: true,
      required: { gpus: 8, cpu: "32", memory: "128Gi" },
      available: { gpus: 0, cpu: "7.7", memory: "0Gi" },
      deficit: { gpus: 8 }
    });
  });

  it("fills zero totals for a verdict that rejects before totalling", () => {
    const early = { ok: false, verdict: "unknown_model", action: "model:banana" };
    const check = parseCapacityCheck(JSON.stringify(early), UTILITY);
    expect(check.required).toEqual({ gpus: 0, cpu: "0", memory: "0" });
    expect(check.available).toEqual({ gpus: 0, cpu: "0", memory: "0" });
    expect(check.deficit).toEqual({});
    expect(check.heavy).toBeUndefined();
  });

  it("normalises a numeric cpu quantity to the string the domain type declares", () => {
    const payload = validCheck();
    payload.required = { gpus: 8, cpu: 32, memory: "128Gi" };
    const check = parseCapacityCheck(JSON.stringify(payload), UTILITY);
    expect(check.required.cpu).toBe("32");
  });

  it("refuses a payload with no ok flag rather than reading it as allowed", () => {
    const payload = validCheck();
    delete payload.ok;
    expect(() => parseCapacityCheck(JSON.stringify(payload), UTILITY)).toThrow(CliPayloadError);
  });

  it("refuses an invented verdict rather than defaulting it", () => {
    const payload = validCheck();
    payload.verdict = "probably_fine";
    expect(() => parseCapacityCheck(JSON.stringify(payload), UTILITY)).toThrow(/verdict/);
  });
});

describe("parseClusterCapacity", () => {
  it("parses a full capacity snapshot", () => {
    const capacity = parseClusterCapacity(JSON.stringify(validCapacity()), UTILITY);
    expect(capacity.node_count).toBe(1);
    expect(capacity.allocatable.memory).toBe("119Gi");
    expect(capacity.utilization.gpu_pct).toBe(50);
    expect(capacity.error).toBeUndefined();
  });

  it("keeps the error reason when the utility reports one", () => {
    const payload = { ...validCapacity(), error: "kubectl unavailable" };
    expect(parseClusterCapacity(JSON.stringify(payload), UTILITY).error).toBe("kubectl unavailable");
  });

  it("rejects a snapshot missing a totals block", () => {
    const payload = validCapacity();
    delete payload.requested;
    expect(() => parseClusterCapacity(JSON.stringify(payload), UTILITY)).toThrow(CliPayloadError);
  });
});

describe("parseFreeResourceSuggestions", () => {
  it("parses a full suggestion row", () => {
    const rows = parseFreeResourceSuggestions(JSON.stringify([validSuggestion()]), UTILITY);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("stop-coder");
  });

  it("keeps numeric frees numeric and string frees as strings", () => {
    const row = validSuggestion();
    row.frees = { gpus: 0, memory: "all", gpus_note: "approx" };
    const rows = parseFreeResourceSuggestions(JSON.stringify([row]), UTILITY);
    expect(rows[0]?.frees.gpus).toBe(0);
    expect(rows[0]?.frees.memory).toBe("all");
    expect(rows[0]?.frees.gpus_note).toBe("approx");
  });

  it("rejects a row that is missing required keys", () => {
    expect(() => parseFreeResourceSuggestions(JSON.stringify([{ action: "dev:coder" }]), UTILITY)).toThrow(
      CliPayloadError
    );
  });

  it("rejects a document that is an object rather than a list", () => {
    expect(() => parseFreeResourceSuggestions(JSON.stringify(validSuggestion()), UTILITY)).toThrow(
      /<root>: Invalid input: expected array, received object/
    );
  });

  it("rejects a frees value that is neither string nor number", () => {
    const row = validSuggestion();
    row.frees = { gpus: { nested: true } };
    expect(() => parseFreeResourceSuggestions(JSON.stringify([row]), UTILITY)).toThrow(/frees/);
  });
});

describe("schema exports", () => {
  it("expose the same contract the parsers use", () => {
    expect(ClusterCapacitySchema.safeParse(validCapacity()).success).toBe(true);
    expect(FreeResourceSuggestionSchema.safeParse(validSuggestion()).success).toBe(true);
    expect(CapacityCheckSchema.safeParse(validCheck()).success).toBe(true);
  });
});

// --- the panel payloads -------------------------------------------------------
//
// Each shape below is what the corresponding utility prints today. A test that
// passed on a thinner object before these parsers existed is exactly the bug the
// boundary exists to catch, so the shapes here are the documented contract.

/** One docker `--format '{{json .}}'` line. */
function validContainer(): Record<string, unknown> {
  return { ID: "abc123def456", Names: "kimi-inference", Status: "Up 3 hours", Image: "vllm:latest" };
}

/** One dev-workspace row. */
function workspace(name: "coder" | "kasm"): Record<string, unknown> {
  return {
    name,
    state: "running",
    readyPods: 2,
    totalPods: 2,
    url: `http://10.0.0.9:30${name === "coder" ? "80" : "88"}`,
    helmInstalled: true
  };
}

/** One monitoring service row. */
function monitoringService(name: string): Record<string, unknown> {
  return {
    name,
    state: "running",
    readyPods: 1,
    totalPods: 1,
    helmInstalled: true,
    urls: { sso: `https://${name}.lab.local`, nodeport: "http://10.0.0.9:3000" }
  };
}

/** The monitoring status payload, all seven services present. */
function validMonitoring(): Record<string, unknown> {
  return {
    grafana: monitoringService("grafana"),
    headlamp: monitoringService("headlamp"),
    prometheus: monitoringService("prometheus"),
    nodeExporter: monitoringService("node-exporter"),
    kubeStateMetrics: monitoringService("kube-state-metrics"),
    blackboxExporter: monitoringService("blackbox-exporter"),
    dcgmExporter: monitoringService("dcgm-exporter"),
    dashboards: [
      {
        uid: "spark-overview",
        title: "Lab Overview",
        url: "https://grafana.lab.local/d/spark-overview",
        nodeportUrl: "http://10.0.0.9:3000/d/spark-overview"
      }
    ]
  };
}

/** The Nemotron catalog payload. */
function validNemotronCatalog(): Record<string, unknown> {
  return {
    models: { "nemotron-3-ultra": { display_name: "Ultra", family: "llm", runtime: "vllm" } },
    pillars: { reasoning: { label: "Reasoning", icon: "brain" } },
    stacks: { "nemotron-agentic-spark-1": { label: "Agentic Spark", heavy: true, min_nodes: 1 } }
  };
}

describe("parseDockerContainers", () => {
  it("accepts every line the table renders", () => {
    const stdout = `${JSON.stringify(validContainer())}\n${JSON.stringify({ ...validContainer(), ID: "def456", Names: "storage" })}\n`;
    const parsed = parseDockerContainers(stdout, "docker ps");
    expect(Array.isArray(parsed) && parsed.length).toBe(2);
  });

  it("rejects a line that lost a column the table renders", () => {
    const line = validContainer();
    delete line.Names;
    const parsed = parseDockerContainers(JSON.stringify(line), "docker ps");
    expect(!Array.isArray(parsed) && parsed.error).toMatch(/Names/);
  });

  it("rejects a line that is not JSON at all", () => {
    const parsed = parseDockerContainers("not json", "docker ps");
    expect(!Array.isArray(parsed) && parsed.error).toMatch(/not JSON/);
  });

  it("returns an empty list for an empty document", () => {
    expect(parseDockerContainers("  \n ", "docker ps")).toEqual([]);
  });
});

describe("parseDevWorkspacesStatus", () => {
  it("accepts both workspace rows", () => {
    const payload = { coder: workspace("coder"), kasm: workspace("kasm") };
    expect(parseDevWorkspacesStatus(JSON.stringify(payload), "dev-workspaces.sh").kasm.state).toBe("running");
  });

  it("rejects a payload that lost a row rather than rendering half a panel", () => {
    const payload = { coder: workspace("coder") };
    expect(() => parseDevWorkspacesStatus(JSON.stringify(payload), "dev-workspaces.sh")).toThrow(/kasm/);
  });

  it("rejects a state outside the closed set", () => {
    const payload = { coder: workspace("coder"), kasm: workspace("kasm") };
    payload.coder = { ...payload.coder, state: "draining" };
    expect(() => parseDevWorkspacesStatus(JSON.stringify(payload), "dev-workspaces.sh")).toThrow(/state/);
  });
});

describe("parseMonitoringStackStatus", () => {
  it("accepts the full seven-service payload", () => {
    const status = parseMonitoringStackStatus(JSON.stringify(validMonitoring()), "monitoring-stack.sh");
    expect(status.dashboards[0]?.uid).toBe("spark-overview");
  });

  it("rejects a payload that dropped a service the panel renders", () => {
    const payload = validMonitoring();
    delete payload.dcgmExporter;
    expect(() => parseMonitoringStackStatus(JSON.stringify(payload), "monitoring-stack.sh")).toThrow(/dcgmExporter/);
  });

  it("accepts a service that has no urls yet", () => {
    const grafana = monitoringService("grafana");
    delete grafana.urls;
    const payload = { ...validMonitoring(), grafana };
    expect(parseMonitoringStackStatus(JSON.stringify(payload), "monitoring-stack.sh").grafana.urls).toBeUndefined();
  });
});

describe("parseUtilityStatus", () => {
  it("keeps utility-specific keys the contract does not name", () => {
    const payload = { name: "spark-clock", status: "ok", nextRun: "2026-11-07T00:00:00Z" };
    const parsed = parseUtilityStatus(JSON.stringify(payload), "spark-clock");
    expect(parsed.nextRun).toBe("2026-11-07T00:00:00Z");
  });

  it("rejects a contract key that holds the wrong type", () => {
    expect(() => parseUtilityStatus(JSON.stringify({ name: 7 }), "spark-clock")).toThrow(/name/);
  });
});

describe("parseNemotronCatalog", () => {
  it("accepts the catalog the utility prints", () => {
    const catalog = parseNemotronCatalog(JSON.stringify(validNemotronCatalog()), "nemotron-stack.sh");
    expect(catalog.models["nemotron-3-ultra"]?.runtime).toBe("vllm");
  });

  it("rejects a model entry with no runtime", () => {
    const payload = validNemotronCatalog();
    payload.models = { "nemotron-3-ultra": { display_name: "Ultra", family: "llm" } };
    expect(() => parseNemotronCatalog(JSON.stringify(payload), "nemotron-stack.sh")).toThrow(/runtime/);
  });
});

describe("parseNemotronStackStatus", () => {
  it("accepts stack health with the namespace it was read from", () => {
    const payload = {
      stacks: [
        {
          id: "nemotron-agentic-spark-1",
          label: "Agentic Spark",
          healthy: false,
          components: [{ model: "nemotron-3-ultra", state: "Progressing" }]
        }
      ],
      namespace: "ai-inference"
    };
    const status = parseNemotronStackStatus(JSON.stringify(payload), "nemotron-stack.sh");
    expect(status.stacks[0]?.components[0]?.state).toBe("Progressing");
  });

  it("rejects a status with no namespace", () => {
    expect(() => parseNemotronStackStatus(JSON.stringify({ stacks: [] }), "nemotron-stack.sh")).toThrow(/namespace/);
  });
});

describe("parseOpenWebUICatalog", () => {
  /** A backend entry in the shape `config/open-webui-policy.json` writes. */
  function backend(namespace: string): Record<string, unknown> {
    return { service: "hermes-gateway", namespace, port: 8642, path: "/v1" };
  }

  /** The catalog payload with one backend and one stack. */
  function catalog(namespace: string): Record<string, unknown> {
    return {
      helm: { release: "open-webui", namespace: "dev" },
      ports: { nodeport: 32085, container: 8080 },
      sso: { host: "chat.lab.local" },
      backends: { hermes_gateway: backend(namespace) },
      stacks: { "open-webui-lab": { label: "Chat", requires_hermes_stack: "hermes-lab" } }
    };
  }

  it("accepts a catalog whose backend names an allowed namespace", () => {
    const parsed = parseOpenWebUICatalog(JSON.stringify(catalog("dev")), "open-webui-stack.sh");
    expect(parsed.backends.hermes_gateway?.port).toBe(8642);
  });

  it("rejects a backend that points at a namespace the dashboard may not name", () => {
    expect(() => parseOpenWebUICatalog(JSON.stringify(catalog("kube-public")), "open-webui-stack.sh")).toThrow(
      /namespace/
    );
  });
});

describe("parseOpenWebUIStatus", () => {
  /** The status payload, with the URL block the panel links out to. */
  function validStatus(): Record<string, unknown> {
    return {
      release: "open-webui",
      namespace: "dev",
      state: "running",
      helm_installed: true,
      pod_ready: true,
      urls: { sso: "https://chat.lab.local", nodeport: "http://10.0.0.9:32085" },
      backend: { hermes_gateway: { url: "http://10.0.0.9:8642", reachable: true } },
      prerequisites: { hermes_stack: "hermes-lab" }
    };
  }

  it("accepts a running stack", () => {
    expect(parseOpenWebUIStatus(JSON.stringify(validStatus()), "open-webui-stack.sh").state).toBe("running");
  });

  it("rejects a state outside the closed set", () => {
    const payload = validStatus();
    payload.state = "degraded";
    expect(() => parseOpenWebUIStatus(JSON.stringify(payload), "open-webui-stack.sh")).toThrow(/state/);
  });

  it("rejects a status with no URL block to link out to", () => {
    const payload = validStatus();
    delete payload.urls;
    expect(() => parseOpenWebUIStatus(JSON.stringify(payload), "open-webui-stack.sh")).toThrow(/urls/);
  });
});

describe("parseK8sSecretPayload", () => {
  it("accepts a secret whose keys are base64 strings", () => {
    const payload = { metadata: { name: "lab-hf-token", namespace: "ai-inference" }, data: { HF_TOKEN: "eDI=" } };
    expect(parseK8sSecretPayload(JSON.stringify(payload), "kubectl get secret").data?.HF_TOKEN).toBe("eDI=");
  });

  it("accepts a secret with no data at all", () => {
    expect(parseK8sSecretPayload('{"metadata":{}}', "kubectl get secret").data).toBeUndefined();
  });

  it("rejects a data map holding a non-string, which would be written straight back", () => {
    const payload = { data: { HF_TOKEN: 7 } };
    expect(() => parseK8sSecretPayload(JSON.stringify(payload), "kubectl get secret")).toThrow(/HF_TOKEN/);
  });
});
