/** Inference Job lifecycle via `scripts/utilities/inference-workloads.sh`. */
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { withMock } from "../host";
import { mockInferenceWorkloadsStatus } from "../mocks/fixtures";
import type { InferenceModelName, InferenceWorkloadsStatus } from "../types";

const execFileAsync = promisify(execFile);

function getUtilityPath(): string {
  const ws = process.env.BUILD_WORKSPACE_DIRECTORY;
  if (ws) {
    const fromWs = path.join(ws, "scripts", "utilities", "inference-workloads.sh");
    if (fs.existsSync(fromWs)) return fromWs;
  }
  const candidates = [
    path.resolve(process.cwd(), "../scripts/utilities/inference-workloads.sh"),
    path.resolve(process.cwd(), "../../scripts/utilities/inference-workloads.sh"),
    "/app/scripts/utilities/inference-workloads.sh",
    path.resolve(__dirname, "../../../scripts/utilities/inference-workloads.sh"),
    path.resolve(__dirname, "../../../../scripts/utilities/inference-workloads.sh")
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), "../scripts/utilities/inference-workloads.sh");
}

/**
 * Fetch inference workload (K8s job) status for all models.
 * @returns Per-model job state and Ray head status.
 */
export async function getInferenceWorkloadsStatus(): Promise<InferenceWorkloadsStatus> {
  const mockStatus = mockInferenceWorkloadsStatus();
  return withMock(mockStatus, async () => {
    const utility = getUtilityPath();
    if (!fs.existsSync(utility)) {
      return { ...mockStatus, error: `Utility not found: ${utility}` };
    }
    try {
      const { stdout } = await execFileAsync(utility, ["status", "--json"], {
        timeout: 20000,
        maxBuffer: 1024 * 256
      });
      return JSON.parse(stdout.trim()) as InferenceWorkloadsStatus;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ...mockStatus, error: message };
    }
  });
}

/**
 * Start an inference workload for a model.
 * @param model - Model id to deploy.
 * @param confirm - Heavy-model confirmation (`yes` or empty).
 * @returns Script stdout, stderr, and exit code.
 */
export async function startInferenceWorkload(
  model: InferenceModelName,
  confirm: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (process.env.USE_MOCKS === "1") {
    return { stdout: JSON.stringify({ ok: true, action: "start", model }), stderr: "", exitCode: 0 };
  }
  const utility = getUtilityPath();
  try {
    const result = await execFileAsync(utility, ["start", model, "--confirm", confirm], {
      timeout: 600000,
      maxBuffer: 1024 * 512
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string; code?: number };
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || err.message || String(e),
      exitCode: err.code ?? 1
    };
  }
}

/**
 * Stop an inference workload, Ray head, or all workloads.
 * @param target - Model id, `all`, or `ray`.
 * @returns Script stdout, stderr, and exit code.
 */
export async function stopInferenceWorkload(
  target: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (process.env.USE_MOCKS === "1") {
    return { stdout: JSON.stringify({ ok: true, action: "stop", target }), stderr: "", exitCode: 0 };
  }
  const utility = getUtilityPath();
  try {
    const result = await execFileAsync(utility, ["stop", target], {
      timeout: 120000,
      maxBuffer: 1024 * 256
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string; code?: number };
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || err.message || String(e),
      exitCode: err.code ?? 1
    };
  }
}
