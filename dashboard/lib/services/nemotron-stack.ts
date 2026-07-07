/** Nemotron agentic stack control via `scripts/utilities/nemotron-stack.sh`. */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";
import { mockNemotronCatalog, mockNemotronStackStatus } from "../mocks/fixtures";
import type { NemotronCatalog, NemotronStackStatus } from "../types";
import { withMock } from "../host";

const execFileAsync = promisify(execFile);

function resolveNemotronStackScript(): string {
  const ws = process.env.BUILD_WORKSPACE_DIRECTORY;
  if (ws) {
    const fromWs = path.join(ws, "scripts", "utilities", "nemotron-stack.sh");
    if (existsSync(fromWs)) return fromWs;
  }
  const candidates = [
    path.resolve(process.cwd(), "../scripts/utilities/nemotron-stack.sh"),
    path.resolve(process.cwd(), "../../scripts/utilities/nemotron-stack.sh"),
    "/app/scripts/utilities/nemotron-stack.sh",
    path.resolve(__dirname, "../../../scripts/utilities/nemotron-stack.sh")
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), "../scripts/utilities/nemotron-stack.sh");
}

async function runNemotronStack(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const script = resolveNemotronStackScript();
  try {
    const { stdout, stderr } = await execFileAsync(script, args, {
      env: { ...process.env, REPO_ROOT: path.dirname(path.dirname(path.dirname(script))) },
      timeout: 600_000,
      maxBuffer: 10 * 1024 * 1024
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? String(e),
      exitCode: typeof err.code === "number" ? err.code : 1
    };
  }
}

/**
 * Fetch Nemotron agentic stack catalog JSON.
 * @returns Stack definitions, pillars, and model endpoints.
 * @throws When `nemotron-stack.sh catalog` exits non-zero.
 */
export async function getNemotronCatalog(): Promise<NemotronCatalog> {
  return withMock(mockNemotronCatalog(), async () => {
    const { stdout, exitCode } = await runNemotronStack(["catalog", "--json"]);
    if (exitCode !== 0) throw new Error(stdout || "nemotron-stack catalog failed");
    return JSON.parse(stdout.trim()) as NemotronCatalog;
  });
}

/**
 * Fetch running Nemotron stack status and pillar health.
 * @returns Active stack id, pod counts, and pillar states.
 * @throws When `nemotron-stack.sh status` exits non-zero.
 */
export async function getNemotronStackStatus(): Promise<NemotronStackStatus> {
  return withMock(mockNemotronStackStatus(), async () => {
    const { stdout, exitCode } = await runNemotronStack(["status", "--json"]);
    if (exitCode !== 0) throw new Error(stdout || "nemotron-stack status failed");
    return JSON.parse(stdout.trim()) as NemotronStackStatus;
  });
}

/**
 * Start a Nemotron agentic stack.
 * @param stackId - Stack id to deploy.
 * @param confirm - Heavy-stack confirmation (`yes`).
 * @returns Script stdout, stderr, and exit code.
 */
export async function startNemotronStack(
  stackId: string,
  confirm: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runNemotronStack(["start", stackId, "--confirm", confirm]);
}

/**
 * Stop a Nemotron agentic stack (or `all`).
 * @param stackId - Stack id or `all`.
 * @returns Script stdout, stderr, and exit code.
 */
export async function stopNemotronStack(
  stackId: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runNemotronStack(["stop", stackId]);
}
