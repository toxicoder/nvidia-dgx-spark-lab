/**
 * Cluster capacity and Resource Guard checks via `scripts/utilities/cluster-resources.sh`.
 * Returns mock Spark-realistic numbers when `USE_MOCKS=1`.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { withMock } from "../host";
import { mockClusterCapacity, mockCapacityCheck, fakeFreeResourceSuggestions } from "../mocks/fixtures";
import type { CapacityCheck, ClusterCapacity, FreeResourceSuggestion } from "../types";

const execFileAsync = promisify(execFile);

function getUtilityPath(): string {
  const ws = process.env.BUILD_WORKSPACE_DIRECTORY;
  if (ws) {
    const fromWs = path.join(ws, "scripts", "utilities", "cluster-resources.sh");
    if (fs.existsSync(fromWs)) return fromWs;
  }
  const candidates = [
    path.resolve(process.cwd(), "../scripts/utilities/cluster-resources.sh"),
    path.resolve(process.cwd(), "../../scripts/utilities/cluster-resources.sh"),
    "/app/scripts/utilities/cluster-resources.sh",
    path.resolve(__dirname, "../../../scripts/utilities/cluster-resources.sh"),
    path.resolve(__dirname, "../../../../scripts/utilities/cluster-resources.sh")
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), "../scripts/utilities/cluster-resources.sh");
}

/**
 * Fetch cluster GPU, CPU, and memory capacity snapshot.
 * @returns Node count and utilization from `cluster-resources.sh status`.
 */
export async function getClusterCapacity(): Promise<ClusterCapacity> {
  const mockCapacity = mockClusterCapacity();
  return withMock(mockCapacity, async () => {
    const utility = getUtilityPath();
    if (!fs.existsSync(utility)) {
      return { ...mockCapacity, error: `Utility not found: ${utility}` };
    }
    try {
      const { stdout } = await execFileAsync(utility, ["status", "--json"], {
        timeout: 20000,
        maxBuffer: 1024 * 256
      });
      return JSON.parse(stdout.trim()) as ClusterCapacity;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ...mockCapacity, error: message };
    }
  });
}

/**
 * Check whether a planned action fits current cluster capacity.
 * @param action - Capacity action token (e.g. `model:kimi`, `dev:coder`).
 * @returns Verdict with required vs available resources.
 */
export async function checkCapacity(action: string): Promise<CapacityCheck> {
  return withMock(mockCapacityCheck(action), async () => {
    const utility = getUtilityPath();
    try {
      const { stdout } = await execFileAsync(utility, ["check", "--action", action, "--json"], {
        timeout: 20000,
        maxBuffer: 1024 * 128
      });
      return JSON.parse(stdout.trim()) as CapacityCheck;
    } catch (e: unknown) {
      const err = e as { stdout?: string; message?: string };
      if (err.stdout) {
        try {
          return JSON.parse(err.stdout.trim()) as CapacityCheck;
        } catch {
          /* fall through */
        }
      }
      return {
        ok: false,
        verdict: "error",
        action,
        required: { gpus: 0, cpu: "0", memory: "0" },
        available: { gpus: 0, cpu: "0", memory: "0" },
        deficit: {}
      };
    }
  });
}

/**
 * Suggest workloads to stop in order to free resources for an action.
 * @param action - Capacity action token.
 * @returns Ordered list of stop suggestions (empty on script failure).
 */
export async function suggestFreeResources(action: string): Promise<FreeResourceSuggestion[]> {
  return withMock(fakeFreeResourceSuggestions as FreeResourceSuggestion[], async () => {
    const utility = getUtilityPath();
    try {
      const { stdout } = await execFileAsync(utility, ["suggest", "--action", action, "--json"], {
        timeout: 15000,
        maxBuffer: 1024 * 128
      });
      return JSON.parse(stdout.trim()) as FreeResourceSuggestion[];
    } catch {
      return [];
    }
  });
}
